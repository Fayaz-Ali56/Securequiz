// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./PlayToken.sol";

/// @title SecurityQuizGame
/// @notice Play-to-earn: answer blockchain-security questions correctly to
///         earn PLAY tokens. Skill-based on purpose - not chance-based -
///         which keeps this out of gambling territory and ties the "game"
///         directly to the course content.
///
/// @dev SECURITY NOTES (put these in your report - this is the good stuff):
///
///   1. ANSWERS ARE STORED AS HASHES, NOT PLAINTEXT.
///      We never store the correct answer directly - only keccak256(answer).
///      Exposing the hash publicly is fine (that's the whole point of a
///      one-way hash); what would NOT be fine is exposing the plaintext.
///
///      IMPORTANT CAVEAT TO WRITE UP: a common beginner mistake is to think
///      marking a variable `private` makes it secret. It doesn't. Anyone can
///      read raw contract storage off-chain with `eth_getStorageAt`
///      regardless of the `private`/`internal` keyword - those keywords only
///      restrict access from OTHER CONTRACTS, not from the outside world. If
///      we had instead tried to hide the plaintext answer behind `private`
///      visibility, it would have been readable anyway. Hashing (combined
///      with the answer having enough entropy to resist brute-forcing) is
///      what actually protects it. A fully rigorous version would verify
///      answers via an off-chain signer instead of an on-chain hash compare.
///
///   2. CHECKS-EFFECTS-INTERACTIONS + REENTRANCY GUARD.
///      State (hasAnswered, streak) is updated BEFORE the external call to
///      PlayToken.mintReward(). The nonReentrant modifier is a second layer
///      of defense in case that ordering is ever broken by a future edit.
///
///   3. ACCESS CONTROL.
///      Only the owner can add questions, deactivate them, or pause the
///      contract. Players can only call the read-only and submitAnswer
///      functions.
///
///   4. RATE LIMITING.
///      A per-player, per-question cooldown limits brute-force guessing
///      and bot spam. Built on block.timestamp, which miners/validators can
///      nudge by a few seconds - fine for a 60-second cooldown, but NOT
///      something to rely on for anything security-critical at second-level
///      precision. Worth a line in your report.
///
///   5. PAUSABLE.
///      Owner can pause the game (e.g. if a question's answer leaks) without
///      needing to redeploy or touch the token contract.
contract SecurityQuizGame is Ownable, ReentrancyGuard, Pausable {
    struct Question {
        string text;
        bytes32 answerHash;
        uint96 reward;      // base PLAY reward (in wei units, 18 decimals)
        bool active;
    }

    PlayToken public immutable playToken;

    Question[] public questions;

    // player => questionId => answered correctly already?
    mapping(address => mapping(uint256 => bool)) public hasAnswered;
    // player => questionId => last attempt timestamp (any attempt, right or wrong)
    mapping(address => mapping(uint256 => uint256)) public lastAttemptAt;

    mapping(address => uint256) public streak;
    mapping(address => uint256) public totalCorrect;

    uint256 public constant ATTEMPT_COOLDOWN = 60 seconds;
    uint256 public constant STREAK_BONUS_EVERY = 3;       // every 3rd consecutive correct answer...
    uint256 public constant STREAK_BONUS_PERCENT = 50;    // ...pays an extra 50%

    event QuestionAdded(uint256 indexed questionId, string text, uint96 reward);
    event QuestionDeactivated(uint256 indexed questionId);
    event AnswerCorrect(address indexed player, uint256 indexed questionId, uint256 reward, uint256 newStreak);
    event AnswerIncorrect(address indexed player, uint256 indexed questionId);
    event StreakReset(address indexed player);

    constructor(address _playToken) Ownable(msg.sender) {
        require(_playToken != address(0), "SecurityQuizGame: zero address");
        playToken = PlayToken(_playToken);
    }

    // ---------- Owner functions ----------

    /// @notice Add a new question. `answer` is hashed here and never stored in plaintext.
    /// @dev Pass the raw answer string (e.g. "reentrancy"); normalize casing/whitespace
    ///      in your frontend before both adding questions and submitting answers, since
    ///      the hash comparison is exact-match.
    function addQuestion(string calldata text, string calldata answer, uint96 reward) external onlyOwner {
        require(reward > 0, "SecurityQuizGame: reward must be > 0");
        bytes32 answerHash = keccak256(abi.encodePacked(answer));
        questions.push(Question({text: text, answerHash: answerHash, reward: reward, active: true}));
        emit QuestionAdded(questions.length - 1, text, reward);
    }

    /// @notice Pull a question if its answer leaks or it turns out to be flawed.
    function deactivateQuestion(uint256 questionId) external onlyOwner {
        require(questionId < questions.length, "SecurityQuizGame: bad questionId");
        questions[questionId].active = false;
        emit QuestionDeactivated(questionId);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // ---------- Player functions ----------

    /// @notice Submit an answer to a question. Wrong answers do NOT revert - they
    ///         still cost gas and reset the caller's streak, which is enough of a
    ///         brake on brute forcing without punishing genuine wrong guesses with
    ///         a failed-transaction popup in the player's wallet.
    function submitAnswer(uint256 questionId, string calldata answer) external nonReentrant whenNotPaused {
        require(questionId < questions.length, "SecurityQuizGame: bad questionId");
        Question storage q = questions[questionId];
        require(q.active, "SecurityQuizGame: question not active");
        require(!hasAnswered[msg.sender][questionId], "SecurityQuizGame: already solved this one");
        require(
            block.timestamp >= lastAttemptAt[msg.sender][questionId] + ATTEMPT_COOLDOWN,
            "SecurityQuizGame: slow down, cooldown active"
        );

        lastAttemptAt[msg.sender][questionId] = block.timestamp;

        bool correct = keccak256(abi.encodePacked(answer)) == q.answerHash;

        if (!correct) {
            streak[msg.sender] = 0;
            emit AnswerIncorrect(msg.sender, questionId);
            emit StreakReset(msg.sender);
            return;
        }

        // --- Effects (before interaction) ---
        hasAnswered[msg.sender][questionId] = true;
        totalCorrect[msg.sender] += 1;
        streak[msg.sender] += 1;
        uint256 newStreak = streak[msg.sender];

        uint256 reward = q.reward;
        if (newStreak % STREAK_BONUS_EVERY == 0) {
            reward = reward + (reward * STREAK_BONUS_PERCENT / 100);
        }

        emit AnswerCorrect(msg.sender, questionId, reward, newStreak);

        // --- Interaction (external call last) ---
        playToken.mintReward(msg.sender, reward);
    }

    // ---------- Views ----------

    function questionCount() external view returns (uint256) {
        return questions.length;
    }

    /// @notice Convenience getter for a question's public-facing fields, plus whether
    ///         the caller has already solved it. (The raw hash is also readable via the
    ///         auto-generated `questions(uint256)` getter since `questions` is public -
    ///         that's fine, see security note #1: the hash isn't the secret.)
    function getQuestionInfo(uint256 questionId)
        external
        view
        returns (string memory text, uint96 reward, bool active, bool solvedByCaller)
    {
        require(questionId < questions.length, "SecurityQuizGame: bad questionId");
        Question storage q = questions[questionId];
        return (q.text, q.reward, q.active, hasAnswered[msg.sender][questionId]);
    }
}
