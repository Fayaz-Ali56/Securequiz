const { ethers } = require("hardhat");

// Usage: npx hardhat run scripts/seed-more-questions.js --network sepolia
//
// Adds 20 new questions across 5 categories, and fixes question #2 from the
// original seed set ("onlyOwner") which used mixed case - since the frontend
// now lowercases answers before submitting (so players aren't wrongly marked
// incorrect over capitalization), that old mixed-case answer would no longer
// match. We deactivate it and replace it with a lowercase equivalent.
//
// Categories are encoded as a "[Category] " prefix on the question text,
// which the frontend parses out - no contract changes needed for this.

const QUESTION_TO_FIX = 2; // original "onlyOwner" question

const NEW_QUESTIONS = [
  // Reentrancy
  { text: "[Reentrancy] What Solidity modifier restricts a function to only the contract owner (OpenZeppelin's Ownable)?", answer: "onlyowner", reward: "10" },
  { text: "[Reentrancy] What 2016 exploit of a reentrancy bug caused Ethereum to fork into ETH and ETC?", answer: "thedao", reward: "15" },
  { text: "[Reentrancy] What is the general programming term for a lock that prevents a function from being re-entered while it's already executing?", answer: "mutex", reward: "10" },
  { text: "[Reentrancy] Which arithmetic issue, common before Solidity 0.8, let a uint wrap from 0 to its max value on subtraction?", answer: "underflow", reward: "10" },
  { text: "[Reentrancy] What is it called when a number exceeds its maximum storage size and wraps back to zero?", answer: "overflow", reward: "5" },
  // Access Control
  { text: "[Access Control] What OpenZeppelin contract lets you define custom named permissions instead of a single owner?", answer: "accesscontrol", reward: "15" },
  { text: "[Access Control] What is the general vulnerability category for missing permission checks on a sensitive function?", answer: "access control", reward: "25" },
  { text: "[Access Control] What vulnerability lets an attacker call an upgradeable contract's initializer before the legitimate deployer does?", answer: "uninitialized proxy", reward: "25" },
  { text: "[Access Control] What Solidity visibility keyword was the risky default for functions in versions before Solidity 0.5?", answer: "public", reward: "5" },
  // Wallet Security
  { text: "[Wallet Security] What 12 or 24 word backup lets you restore a crypto wallet if you lose your device?", answer: "seed phrase", reward: "5" },
  { text: "[Wallet Security] What type of wallet stores private keys on a device that's never connected to the internet?", answer: "cold wallet", reward: "5" },
  { text: "[Wallet Security] What social-engineering attack tricks someone into revealing their seed phrase via a fake but convincing website?", answer: "phishing", reward: "10" },
  { text: "[Wallet Security] What is the process called where a wallet signs a transaction without ever exposing the private key to the connected computer?", answer: "hardware wallet", reward: "10" },
  // DeFi Security
  { text: "[DeFi Security] What manipulation involves inserting your own transaction between someone else's transaction and its confirmation, to profit from it?", answer: "front-running", reward: "10" },
  { text: "[DeFi Security] What term describes borrowing a huge sum with no collateral, using and repaying it within a single transaction?", answer: "flash loan", reward: "10" },
  { text: "[DeFi Security] What kind of price feed vulnerability lets an attacker temporarily distort an asset's price to drain a protocol?", answer: "oracle manipulation", reward: "15" },
  { text: "[DeFi Security] What decentralized service provides smart contracts with reliable external data like price feeds?", answer: "oracle", reward: "5" },
  // Auditing
  { text: "[Auditing] What's the term for a professional, systematic review of smart contract code to find vulnerabilities before deployment?", answer: "audit", reward: "5" },
  { text: "[Auditing] What program pays independent researchers for responsibly disclosing vulnerabilities in a protocol?", answer: "bug bounty", reward: "5" },
  { text: "[Auditing] What widely used static-analysis tool (from Trail of Bits) scans Solidity code for common vulnerability patterns?", answer: "slither", reward: "15" },
  { text: "[Auditing] What is it called when a project's smart contracts cannot be changed or upgraded after deployment, for better or worse?", answer: "immutable", reward: "5" },
];

async function main() {
  const gameAddress = process.env.GAME_ADDRESS;
  if (!gameAddress) {
    throw new Error("Set GAME_ADDRESS env var to your deployed SecurityQuizGame address first.");
  }
  const game = await ethers.getContractAt("SecurityQuizGame", gameAddress);

  console.log(`Deactivating old question #${QUESTION_TO_FIX} (mixed-case answer)...`);
  await (await game.deactivateQuestion(QUESTION_TO_FIX)).wait();

  console.log(`Adding ${NEW_QUESTIONS.length} new questions...`);
  for (const q of NEW_QUESTIONS) {
    const tx = await game.addQuestion(q.text, q.answer, ethers.parseEther(q.reward));
    await tx.wait();
    console.log(`  added: "${q.text.slice(0, 70)}..."`);
  }

  console.log("\nDone.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
