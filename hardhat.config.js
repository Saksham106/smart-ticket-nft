require("@nomicfoundation/hardhat-toolbox");
require("hardhat-gas-reporter");

module.exports = {
  solidity: "0.8.19",
  gasReporter: {
    enabled: process.env.REPORT_GAS ? true : false
  }
};
