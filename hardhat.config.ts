// require("dotenv").config();

import "dotenv/config"
import "@nomiclabs/hardhat-etherscan"
import "@nomiclabs/hardhat-waffle"
import "hardhat-gas-reporter"
import "solidity-coverage"
// import "hardhat-ethernal"
import { task } from "hardhat/config";
import '@typechain/hardhat'
import 'hardhat-contract-sizer';

//require("@nomiclabs/hardhat-etherscan");
//require("@nomiclabs/hardhat-waffle");
//require("hardhat-gas-reporter");
//require("solidity-coverage");
//require("hardhat-ethernal");

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more
// "0.8.4"
/**
 * @type import("hardhat/config").HardhatUserConfig
 */
export default {
  solidity: {
    compilers: [
      {
        version: "0.7.6"
      }
    ],
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      },
    },
  },
  networks: {
    hardhat: {
      chainId: 1337,
      blockGasLimit: 100000000000,
      forking: {
        url: process.env.ETHEREUM_URL,
      }
    },
    arbitrum: {
      url: process.env.ARBITRUM_URL,
      accounts:
        process.env.ARBITRUM_PRIVATE_KEY !== undefined ? [process.env.ARBITRUM_PRIVATE_KEY] : [],
    },
    ethereum: {
      url: process.env.ETHEREUM_URL,
      accounts:
        process.env.ETHEREUM_PRIVATE_KEY !== undefined ? [process.env.ETHEREUM_PRIVATE_KEY] : [],
    },
    optimism: {
      url: process.env.OPTIMISM_URL,
      accounts:
        process.env.OPTIMISM_PRIVATE_KEY !== undefined ? [process.env.OPTIMISM_PRIVATE_KEY] : [],
    },
    polygon: {
      url: process.env.POLYGON_URL,
      accounts:
        process.env.POLYGON_PRIVATE_KEY !== undefined ? [process.env.POLYGON_PRIVATE_KEY] : [],
    },
    bsc: {
      url: process.env.BSC_URL,
      accounts:
        process.env.BSC_PRIVATE_KEY !== undefined ? [process.env.BSC_PRIVATE_KEY] : [],
    }
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
  },
  etherscan: {
    apiKey: { 
      mainnet: process.env.ETHEREUM_API_KEY,
      arbitrumOne: process.env.ARBISCAN_API_KEY,
      optimisticEthereum: process.env.OPTIMISM_API_KEY,
      polygon: process.env.POLYGON_API_KEY,
      bsc: process.env.BSC_API_KEY
    }
  },
  typechain: {
    outDir: 'typechain',
    target: 'ethers-v5',
    alwaysGenerateOverloads: false, // should overloads with full signatures like deposit(uint256) be generated always, even if there are no overloads?
    externalArtifacts: ['externalArtifacts/*.json'], // optional array of glob patterns with external artifacts to process (for example external libs from node_modules)
  },
  contractSizer: {
    alphaSort: true,
    disambiguatePaths: false,
    runOnCompile: true,
    strict: true,
    only: [],
  }
};
