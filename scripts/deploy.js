const { ethers } = require("hardhat");

// Starter question bank. Answers are case-sensitive exact matches - keep them
// short, lowercase, one word/phrase, and normalize user input the same way
// in your frontend before calling submitAnswer.
const STARTER_QUESTIONS = [
  {
    text: "What is it called when an external call lets an attacker call back into a function before its state updates finish?",
    answer: "reentrancy",
    reward: "10",
  },
  {
    text: "What coding pattern updates state BEFORE making external calls, to prevent reentrancy?",
    answer: "checks-effects-interactions",
    reward: "10",
  },
  {
    text: "What Solidity modifier restricts a function to only the contract owner (OpenZeppelin's Ownable)?",
    answer: "onlyOwner",
    reward: "10",
  },
  {
    text: "True or false: marking a Solidity variable 'private' hides its value from anyone reading raw blockchain storage.",
    answer: "false",
    reward: "15",
  },
  {
    text: "What OpenZeppelin contract, when inherited, lets an owner halt all state-changing functions in an emergency?",
    answer: "pausable",
    reward: "10",
  },
];

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)));

  const PlayToken = await ethers.getContractFactory("PlayToken");
  const playToken = await PlayToken.deploy();
  await playToken.waitForDeployment();
  console.log("PlayToken deployed to:", await playToken.getAddress());

  const SecurityQuizGame = await ethers.getContractFactory("SecurityQuizGame");
  const game = await SecurityQuizGame.deploy(await playToken.getAddress());
  await game.waitForDeployment();
  console.log("SecurityQuizGame deployed to:", await game.getAddress());

  const setTx = await playToken.setGameContract(await game.getAddress());
  await setTx.wait();
  console.log("PlayToken wired to game contract.");

  console.log(`Seeding ${STARTER_QUESTIONS.length} starter questions...`);
  for (const q of STARTER_QUESTIONS) {
    const tx = await game.addQuestion(q.text, q.answer, ethers.parseEther(q.reward));
    await tx.wait();
    console.log(`  added: "${q.text.slice(0, 60)}..."`);
  }

  console.log("\nDone. Save these addresses for your frontend and Etherscan verification:");
  console.log("  PLAY_TOKEN_ADDRESS =", await playToken.getAddress());
  console.log("  GAME_ADDRESS       =", await game.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
