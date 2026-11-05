// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../SecurityQuizGame.sol";

/// @title MaliciousReentrantToken
/// @notice TEST-ONLY mock, never deployed in the real game. PlayToken (a
///         standard OpenZeppelin ERC20) has no transfer hooks, so today
///         there is no live reentrancy path through mintReward(). This mock
///         stands in for what would happen if the reward token were instead
///         something like ERC777, which DOES call a hook on the recipient
///         during transfers/mints.
///
///         When "minting" a reward, instead of just crediting a balance,
///         this fake token immediately calls BACK into
///         SecurityQuizGame.submitAnswer() - for a DIFFERENT, not-yet-solved
///         question. That detail matters: checks-effects-interactions alone
///         would NOT stop this specific attack, because `hasAnswered` is
///         only set for the question being answered, not for others. It's
///         the `nonReentrant` guard on the whole function that has to catch
///         it. This test proves the guard is doing real work, not just
///         riding on CEI's coattails.
contract MaliciousReentrantToken {
    SecurityQuizGame public game;
    uint256 public reentryQuestionId;
    string public reentryAnswer;

    function configure(address _game, uint256 _reentryQuestionId, string calldata _reentryAnswer) external {
        game = SecurityQuizGame(_game);
        reentryQuestionId = _reentryQuestionId;
        reentryAnswer = _reentryAnswer;
    }

    /// @dev Matches PlayToken's mintReward(address,uint256) selector so
    ///      SecurityQuizGame can call this mock exactly as it would the real token.
    function mintReward(address /* to */, uint256 /* amount */) external {
        game.submitAnswer(reentryQuestionId, reentryAnswer);
    }
}
