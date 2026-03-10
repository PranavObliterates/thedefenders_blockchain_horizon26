const express = require("express");
const cors = require("cors");
const { ethers } = require("ethers");
const { provider, addresses, getSigners, getContracts } = require("./contract");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3001;

async function getTraderSigner(traderIndex) {
  const signers = await getSigners();
  const map = { 1: signers.trader1, 2: signers.trader2, 3: signers.trader3 };
  return map[traderIndex];
}

app.post("/api/deposit", async (req, res) => {
  try {
    const { traderAddress, amount } = req.body;
    if (!traderAddress || !amount) {
      return res.status(400).json({ error: "traderAddress and amount are required" });
    }
    const { tokenizedINR } = await getContracts();
    const tx = await tokenizedINR.depositSimple(traderAddress, amount);
    const receipt = await tx.wait();
    res.json({ success: true, txHash: receipt.transactionHash, traderAddress, amount });
  } catch (err) {
    res.status(500).json({ success: false, error: err.reason || err.message });
  }
});

app.post("/api/order", async (req, res) => {
  try {
    const { traderIndex, stockSymbol, side, quantity, price } = req.body;
    if (!traderIndex || !stockSymbol || side === undefined || !quantity || !price) {
      return res.status(400).json({ error: "traderIndex, stockSymbol, side, quantity, price are required" });
    }
    const { settlementEngine, stocks } = await getContracts();
    const traderSigner = await getTraderSigner(traderIndex);
    const stockAddress = stocks[stockSymbol]?.address;
    if (!stockAddress) {
      return res.status(400).json({ error: `Unknown stock symbol: ${stockSymbol}` });
    }
    const sideEnum = side === "buy" ? 0 : 1;
    const engineWithTrader = settlementEngine.connect(traderSigner);
    const tx = await engineWithTrader.placeOrder(stockAddress, stockSymbol, sideEnum, quantity, price);
    const receipt = await tx.wait();
    res.json({ success: true, txHash: receipt.transactionHash, stockSymbol, side, quantity, price });
  } catch (err) {
    res.status(500).json({ success: false, error: err.reason || err.message });
  }
});

app.post("/api/settle", async (req, res) => {
  try {
    const { buyer, seller, stockSymbol, quantity, price } = req.body;
    if (!buyer || !seller || !stockSymbol || !quantity || !price) {
      return res.status(400).json({ error: "buyer, seller, stockSymbol, quantity, price are required" });
    }
    const { settlementEngine, stocks } = await getContracts();
    const stockAddress = stocks[stockSymbol]?.address;
    if (!stockAddress) {
      return res.status(400).json({ error: `Unknown stock symbol: ${stockSymbol}` });
    }
    const tx = await settlementEngine.settleTrade(buyer, seller, stockAddress, stockSymbol, quantity, price);
    const receipt = await tx.wait();
    res.json({ success: true, txHash: receipt.transactionHash, buyer, seller, stockSymbol, quantity, price });
  } catch (err) {
    res.status(500).json({ success: false, error: err.reason || err.message });
  }
});

app.get("/api/portfolio/:address", async (req, res) => {
  try {
    const addr = req.params.address;
    const { tokenizedINR, stocks } = await getContracts();
    const tINRBalance = await tokenizedINR.balanceOf(addr);
    const portfolio = {
      traderAddress: addr,
      tINR: ethers.utils.formatEther(tINRBalance),
      stocks: {},
    };
    for (const [symbol, contract] of Object.entries(stocks)) {
      const bal = await contract.balanceOf(addr);
      portfolio.stocks[symbol] = ethers.utils.formatEther(bal);
    }
    res.json(portfolio);
  } catch (err) {
    res.status(500).json({ error: err.reason || err.message });
  }
});

app.get("/api/orders", async (req, res) => {
  try {
    const { settlementEngine } = await getContracts();
    const count = await settlementEngine.getOrderCount();
    const orders = [];
    for (let i = 0; i < count; i++) {
      const o = await settlementEngine.getOrder(i);
      orders.push({
        orderId: o.orderId.toNumber(),
        trader: o.trader,
        shareToken: o.shareToken,
        stockSymbol: o.stockSymbol,
        side: o.side === 0 ? "buy" : "sell",
        quantity: o.quantity.toNumber(),
        pricePerShare: o.pricePerShare.toNumber(),
        isActive: o.isActive,
      });
    }
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.reason || err.message });
  }
});

app.get("/api/trades", async (req, res) => {
  try {
    const { settlementEngine } = await getContracts();
    const count = await settlementEngine.getTradeCount();
    const trades = [];
    for (let i = 0; i < count; i++) {
      const t = await settlementEngine.getTrade(i);
      trades.push({
        tradeId: t.tradeId.toNumber(),
        buyer: t.buyer,
        seller: t.seller,
        shareToken: t.shareToken,
        stockSymbol: t.stockSymbol,
        quantity: t.quantity.toNumber(),
        pricePerShare: t.pricePerShare.toNumber(),
        totalValue: t.totalValue.toNumber(),
        timestamp: t.timestamp.toNumber(),
        status: t.status === 0 ? "Executed" : "Failed",
      });
    }
    res.json(trades);
  } catch (err) {
    res.status(500).json({ error: err.reason || err.message });
  }
});

app.get("/api/analytics", async (req, res) => {
  try {
    const { settlementEngine, stocks } = await getContracts();
    const analytics = await settlementEngine.getAnalytics();
    const circuitBreakers = {};
    for (const [symbol, contract] of Object.entries(stocks)) {
      const cb = await settlementEngine.circuitBreakers(contract.address);
      circuitBreakers[symbol] = {
        lastPrice: cb.lastPrice.toNumber(),
        upperLimit: cb.upperLimit.toNumber(),
        lowerLimit: cb.lowerLimit.toNumber(),
        isHalted: cb.isHalted,
      };
    }
    res.json({
      totalTradesSettled: analytics._totalSettled.toNumber(),
      totalTradesFailed: analytics._totalFailed.toNumber(),
      totalVolumeINR: analytics._totalVolume.toNumber(),
      orderBookSize: analytics._orderBookSize.toNumber(),
      circuitBreakers,
    });
  } catch (err) {
    res.status(500).json({ error: err.reason || err.message });
  }
});

app.get("/api/traders", async (req, res) => {
  res.json(addresses.traders);
});

app.listen(PORT, () => {
  console.log(`SettleX Backend running on http://localhost:${PORT}`);
});