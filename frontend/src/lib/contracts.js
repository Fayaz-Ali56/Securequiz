// Fill these in your .env file after deploying (see .env.example).
export const GAME_ADDRESS = import.meta.env.VITE_GAME_ADDRESS || "";
export const PLAY_TOKEN_ADDRESS = import.meta.env.VITE_PLAY_TOKEN_ADDRESS || "";
export const BADGE_ADDRESS = import.meta.env.VITE_BADGE_ADDRESS || "";
export const EXPECTED_CHAIN_ID = Number(import.meta.env.VITE_CHAIN_ID || 11155111); // Sepolia
export const EXPECTED_CHAIN_NAME = import.meta.env.VITE_CHAIN_NAME || "Sepolia";

// Human-readable ABIs - only the functions/events the frontend actually calls.
export const PLAY_TOKEN_ABI = [
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
];

export const GAME_ABI = [
  "function questionCount() view returns (uint256)",
  "function getQuestionInfo(uint256 questionId) view returns (string text, uint96 reward, bool active, bool solvedByCaller)",
  "function submitAnswer(uint256 questionId, string answer)",
  "function streak(address player) view returns (uint256)",
  "function totalCorrect(address player) view returns (uint256)",
  // Auto-generated public getters on the contract. App.jsx calls both of these,
  // and ethers only creates methods that are declared here - without these two
  // lines, gameRead.questions is undefined and question loading throws.
  "function questions(uint256) view returns (string text, bytes32 answerHash, uint96 reward, bool active)",
  "function hasAnswered(address player, uint256 questionId) view returns (bool)",
  "event AnswerCorrect(address indexed player, uint256 indexed questionId, uint256 reward, uint256 newStreak)",
  "event AnswerIncorrect(address indexed player, uint256 indexed questionId)",
];

export const BADGE_ABI = [
  "function tierCount() view returns (uint256)",
  "function getTierInfo(uint256 tierIndex) view returns (uint256 threshold, string name)",
  "function getClaimStatus(address player) view returns (bool[] claimedTiers)",
  "function claimBadge(uint256 tierIndex)",
  "event BadgeClaimed(address indexed player, uint256 indexed tier, uint256 tokenId)",
];

// Reward-based severity tiers, borrowed from real security-audit conventions.
// Purely a frontend display choice - the reward amount itself lives on-chain.
export function severityForReward(rewardWei) {
  const reward = Number(rewardWei) / 1e18;
  if (reward >= 20) return "critical";
  if (reward >= 15) return "high";
  if (reward >= 10) return "medium";
  return "low";
}

export const SEVERITY_LABELS = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

// Questions are stored on-chain as plain text. Category is encoded as an
// optional "[Category] " prefix so we don't need a contract schema change to
// add this - older questions without a prefix fall back to "General".
export function parseQuestionText(rawText) {
  const match = rawText.match(/^\[([^\]]+)\]\s*(.*)$/s);
  if (match) {
    return { category: match[1], text: match[2] };
  }
  return { category: "General", text: rawText };
}
