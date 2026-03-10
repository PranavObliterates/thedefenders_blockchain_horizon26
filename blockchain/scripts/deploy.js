const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const [deployer, trader1, trader2, trader3] = await hre.ethers.getSigners();

  console.log("Deploying contracts with:", deployer.address);

  // Deploy TokenizedINR
  const TokenizedINR = await hre.ethers.getContractFactory("TokenizedINR");
  const tINR = await TokenizedINR.deploy();
  await tINR.deployed();
  console.log("TokenizedINR deployed to:", tINR.address);

  // Deploy ShareTokens
  const ShareToken = await hre.ethers.getContractFactory("ShareToken");

  const stocks = [
    { name: "Reliance Industries", symbol: "RELIANCE", exchange: "NSE", supply: 10000 },
    { name: "Tata Consultancy Services", symbol: "TCS", exchange: "NSE", supply: 10000 },
    { name: "Infosys Limited", symbol: "INFY", exchange: "NSE", supply: 10000 },
    { name: "HDFC Bank", symbol: "HDFCBANK", exchange: "NSE", supply: 10000 }
  ];

  const deployed = {};
  for (const stock of stocks) {
    const inst = await ShareToken.deploy(stock.name, stock.symbol, stock.exchange, stock.supply);
    await inst.deployed();
    deployed[stock.symbol] = inst;
    console.log(`${stock.symbol} deployed to: ${inst.address}`);
  }

  // Deploy SettlementEngine
  const SettlementEngine = await hre.ethers.getContractFactory("SettlementEngine");
  const engine = await SettlementEngine.deploy(tINR.address);
  await engine.deployed();
  console.log("SettlementEngine deployed to:", engine.address);

  // Setup circuit breakers (demo values)
  await engine.setCircuitBreaker(deployed.RELIANCE.address, 2500, 300);
  await engine.setCircuitBreaker(deployed.TCS.address, 3800, 300);
  await engine.setCircuitBreaker(deployed.INFY.address, 1800, 300);
  await engine.setCircuitBreaker(deployed.HDFCBANK.address, 1600, 300);

  // Fund demo traders (mint tINR)
  await tINR.depositSimple(trader1.address, 500000);
  await tINR.depositSimple(trader2.address, 500000);
  await tINR.depositSimple(trader3.address, 200000);

  // Allocate demo shares
  await deployed.RELIANCE.allocateShares(trader2.address, 200);
  await deployed.TCS.allocateShares(trader1.address, 150);
  await deployed.INFY.allocateShares(trader3.address, 100);
  await deployed.HDFCBANK.allocateShares(trader2.address, 300);

  // Save addresses for backend/frontend integration
  const config = {
    tokenizedINR: tINR.address,
    settlementEngine: engine.address,
    stocks: {
      RELIANCE: deployed.RELIANCE.address,
      TCS: deployed.TCS.address,
      INFY: deployed.INFY.address,
      HDFCBANK: deployed.HDFCBANK.address
    },
    traders: {
      trader1: trader1.address,
      trader2: trader2.address,
      trader3: trader3.address
    }
  };

  fs.writeFileSync("deployed-addresses.json", JSON.stringify(config, null, 2));
  console.log("Deployment complete. Addresses saved to deployed-addresses.json");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});