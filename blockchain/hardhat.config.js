require("@nomicfoundation/hardhat-toolbox");

module.exports = {
  solidity: {
    compilers: [
      {
        version: "0.8.28",
        settings: {
          optimizer: { enabled: true, runs: 200 },
          viaIR: true
        }
      },
      {
        version: "0.8.20",
        settings: {
          optimizer: { enabled: true, runs: 200 },
          viaIR: true
        }
      }
    ]
  },
  networks: {
    localhost: {
      url: "http://127.0.0.1:8545"
    }
  }
};