const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

const provider = new ethers.providers.JsonRpcProvider("http://127.0.0.1:8545");

const addresses = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "blockchain", "deployed-addresses.json"), "utf8")
);

function loadABI(contractName) {
  const artifactPath = path.join(
    __dirname, "..", "blockchain", "artifacts", "contracts",
    `${contractName}.sol`, `${contractName}.json`
  );
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  return artifact.abi;
}

const tokenizedINR_ABI = loadABI("TokenizedINR");
const shareToken_ABI = loadABI("ShareToken");
const settlementEngine_ABI = loadABI("SettlementEngine");

async function getSigners() {
  const signers = await Promise.all(
    [0, 1, 2, 3].map((i) => provider.getSigner(i))
  );
  return {
    owner: signers[0],
    trader1: signers[1],
    trader2: signers[2],
    trader3: signers[3],
  };
}

async function getContracts() {
  const { owner } = await getSigners();

  const tokenizedINR = new ethers.Contract(addresses.tokenizedINR, tokenizedINR_ABI, owner);
  const settlementEngine = new ethers.Contract(addresses.settlementEngine, settlementEngine_ABI, owner);

  const stocks = {};
  for (const [symbol, addr] of Object.entries(addresses.stocks)) {
    stocks[symbol] = new ethers.Contract(addr, shareToken_ABI, owner);
  }

  return { tokenizedINR, settlementEngine, stocks };
}

module.exports = { provider, addresses, getSigners, getContracts };