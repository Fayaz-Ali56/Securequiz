const { ethers } = require("hardhat");

// Usage: npx hardhat run scripts/rotate-question.js --network sepolia
// Edit OLD_QUESTION_ID and NEW_QUESTION below, then run.
//
// WHY THIS EXISTS: once a player answers a question correctly, their
// transaction's calldata contains the plaintext answer, permanently visible
// on any block explorer. The on-chain hash itself stays protected, but the
// answer is no longer meaningfully secret once it's been used once. This
// script is the intended mitigation: periodically retire questions that have
// been answered and replace them with fresh ones, rather than treating any
// single question as reusable forever.

const OLD_QUESTION_ID = 0;
const NEW_QUESTION = {
  text: "What does the acronym CEI stand for in smart contract security?",
  answer: "checks-effects-interactions",
  reward: "10",
};

async function main() {
  const gameAddress = process.env.GAME_ADDRESS;
  if (!gameAddress) {
    throw new Error("Set GAME_ADDRESS env var to your deployed SecurityQuizGame address first.");
  }

  const game = await ethers.getContractAt("SecurityQuizGame", gameAddress);

  const deactivateTx = await game.deactivateQuestion(OLD_QUESTION_ID);
  await deactivateTx.wait();
  console.log(`Deactivated question #${OLD_QUESTION_ID}.`);

  const addTx = await game.addQuestion(NEW_QUESTION.text, NEW_QUESTION.answer, ethers.parseEther(NEW_QUESTION.reward));
  await addTx.wait();
  console.log(`Added replacement question: "${NEW_QUESTION.text}"`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
