require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

// Put your real values in a .env file (never commit this file!):
// SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
// POLYGON_RPC_URL=https://polygon-rpc.com
// PRIVATE_KEY=your_wallet_private_key_without_0x_prefix
// ETHERSCAN_API_KEY=your_etherscan_api_key
// POLYGONSCAN_API_KEY=your_polygonscan_api_key

const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || "";
const POLYGON_RPC_URL = process.env.POLYGON_RPC_URL || "https://polygon-rpc.com";
const PRIVATE_KEY = process.env.PRIVATE_KEY || "0x" + "1".repeat(64); // dummy fallback so config never crashes
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "";
const POLYGONSCAN_API_KEY = process.env.POLYGONSCAN_API_KEY || "";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      evmVersion: "cancun",
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      // local in-memory network, used automatically by `npx hardhat test`
    },
    sepolia: {
      url: SEPOLIA_RPC_URL,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      chainId: 11155111,
    },
    polygon: {
      url: POLYGON_RPC_URL,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      chainId: 137,
    },
  },
  etherscan: {
    apiKey: {
      sepolia: ETHERSCAN_API_KEY,
      polygon: POLYGONSCAN_API_KEY,
    },
  },
};
