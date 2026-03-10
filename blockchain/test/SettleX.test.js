const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("SettleX: Complete Test Suite", function () {
  let tINR, reliance, tcs, engine;
  let owner, trader1, trader2, trader3;

  beforeEach(async function () {
    [owner, trader1, trader2, trader3] = await ethers.getSigners();

    const TokenizedINR = await ethers.getContractFactory("TokenizedINR");
    tINR = await TokenizedINR.deploy();
    await tINR.deployed();

    const ShareToken = await ethers.getContractFactory("ShareToken");
    reliance = await ShareToken.deploy("Reliance Industries", "RELIANCE", "NSE", 10000);
    await reliance.deployed();
    tcs = await ShareToken.deploy("Tata Consultancy Services", "TCS", "NSE", 10000);
    await tcs.deployed();

    const SettlementEngine = await ethers.getContractFactory("SettlementEngine");
    engine = await SettlementEngine.deploy(tINR.address);
    await engine.deployed();

    await engine.setCircuitBreaker(reliance.address, 2500, 300);
    await engine.setCircuitBreaker(tcs.address, 3800, 300);

    await tINR.depositSimple(trader1.address, 500000);
    await tINR.depositSimple(trader2.address, 500000);
    await tINR.depositSimple(trader3.address, 100000);

    await reliance.allocateShares(trader2.address, 200);
    await tcs.allocateShares(trader1.address, 100);

    const maxApproval = ethers.utils.parseEther("999999999");
    await tINR.connect(trader1).approve(engine.address, maxApproval);
    await tINR.connect(trader2).approve(engine.address, maxApproval);
    await tINR.connect(trader3).approve(engine.address, maxApproval);
    await reliance.connect(trader1).approve(engine.address, maxApproval);
    await reliance.connect(trader2).approve(engine.address, maxApproval);
    await tcs.connect(trader1).approve(engine.address, maxApproval);
    await tcs.connect(trader2).approve(engine.address, maxApproval);
  });

  it("should settle a trade atomically - shares and money swap in one tx", async function () {
    await engine.settleTrade(trader1.address, trader2.address, reliance.address, "RELIANCE", 50, 2500);

    const buyerShares = await reliance.balanceOf(trader1.address);
    const sellerINR = await tINR.balanceOf(trader2.address);

    expect(buyerShares).to.equal(ethers.utils.parseEther("50"));
    expect(sellerINR).to.equal(ethers.utils.parseEther("625000"));
    expect(await engine.totalTradesSettled()).to.equal(1);
  });

  it("should revert when trade exceeds available balances", async function () {
    // 500 shares × 2500 price × 10^18 exceeds buyer's tINR balance,
    // so contract reverts on the buyer balance check first
    await expect(
      engine.settleTrade(trader1.address, trader2.address, reliance.address, "RELIANCE", 500, 2500)
    ).to.be.revertedWith("Buyer has insufficient tINR balance");
  });

  it("should revert when price exceeds circuit breaker upper limit", async function () {
    // Price 3000 > upperLimit (2500 * 110 / 100 = 2750)
    // The revert rolls back all state changes including isHalted
    await expect(
      engine.settleTrade(trader1.address, trader2.address, reliance.address, "RELIANCE", 10, 3000)
    ).to.be.revertedWith("Circuit breaker triggered: price above upper limit");
  });

  it("should auto-match and settle when buy and sell orders align", async function () {
    await engine.connect(trader2).placeOrder(reliance.address, "RELIANCE", 1, 30, 2500);
    await engine.connect(trader1).placeOrder(reliance.address, "RELIANCE", 0, 30, 2500);

    const buyerSharesAfter = await reliance.balanceOf(trader1.address);
    const tradesSettled = await engine.totalTradesSettled();

    expect(buyerSharesAfter).to.equal(ethers.utils.parseEther("30"));
    expect(tradesSettled).to.equal(1);
  });

  it("should mint tINR with UPI transaction reference", async function () {
    const balanceBefore = await tINR.balanceOf(trader3.address);

    await tINR.deposit(trader3.address, 50000, "UPI-TXN-RAZORPAY-TEST-123");

    const balanceAfter = await tINR.balanceOf(trader3.address);
    expect(balanceAfter).to.be.gt(balanceBefore);
  });
});