require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const privateKey =
  process.env.MST_PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY || "";
const accounts = privateKey ? [privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`] : [];

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    testnet: {
      url: process.env.MST_RPC_URL || "https://testnetrpc.mstblockchain.com",
      chainId: parseInt(process.env.MST_CHAIN_ID || "91562037", 10),
      accounts: accounts,
    },
    mstTestnet: {
      url: process.env.MST_RPC_URL || "https://testnetrpc.mstblockchain.com",
      chainId: parseInt(process.env.MST_CHAIN_ID || "91562037", 10),
      accounts: accounts,
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};
