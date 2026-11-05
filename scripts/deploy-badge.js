const { ethers } = require("hardhat");

// Usage: GAME_ADDRESS=0x... npx hardhat run scripts/deploy-badge.js --network sepolia
// (or set GAME_ADDRESS in your .env file instead of passing it inline)
//
// Deploys SecureQuizBadge pointing at your EXISTING SecurityQuizGame contract.
// This does not touch or redeploy the game contract - your players' PLAY
// balances and progress are completely unaffected.

async function main() {
  const gameAddress = process.env.GAME_ADDRESS;
  if (!gameAddress) {
    throw new Error("Set GAME_ADDRESS to your deployed SecurityQuizGame address first.");
  }

  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const SecureQuizBadge = await ethers.getContractFactory("SecureQuizBadge");
  const badge = await SecureQuizBadge.deploy(gameAddress);
  await badge.waitForDeployment();

  console.log("SecureQuizBadge deployed to:", await badge.getAddress());
  console.log("\nAdd this to your frontend .env as VITE_BADGE_ADDRESS:");
  console.log("  VITE_BADGE_ADDRESS =", await badge.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
