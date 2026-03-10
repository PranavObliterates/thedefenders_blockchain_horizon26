// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title SettlementEngine - Atomic DVP with automation for PoC
/// @notice Executes atomic Delivery-versus-Payment swaps and simple automation.
contract SettlementEngine is ReentrancyGuard, Ownable {

    IERC20 public immutable tokenizedINR;

    enum TradeStatus { Executed, Failed }
    enum OrderSide { Buy, Sell }

    struct TradeRecord {
        uint256 tradeId;
        address buyer;
        address seller;
        address shareToken;
        string stockSymbol;
        uint256 quantity;
        uint256 pricePerShare;
        uint256 totalValue;
        uint256 timestamp;
        uint256 settlementDuration;
        TradeStatus status;
    }

    struct Order {
        uint256 orderId;
        address trader;
        address shareToken;
        string stockSymbol;
        OrderSide side;
        uint256 quantity;
        uint256 pricePerShare;
        uint256 timestamp;
        bool isActive;
    }

    struct CircuitBreaker {
        uint256 lastPrice;
        uint256 upperLimit;
        uint256 lowerLimit;
        bool isHalted;
        uint256 haltedAt;
        uint256 cooldownPeriod;
    }

    TradeRecord[] public tradeHistory;
    Order[] public orderBook;

    uint256 public totalTradesSettled;
    uint256 public totalTradesFailed;
    uint256 public totalVolumeINR;

    mapping(address => CircuitBreaker) public circuitBreakers;
    mapping(address => uint256) public failureCount;
    uint256 public constant MAX_FAILURES = 3;
    mapping(address => bool) public isFlagged;

    event TradeSettled(
        uint256 indexed tradeId,
        address indexed buyer,
        address indexed seller,
        string stockSymbol,
        uint256 quantity,
        uint256 totalValue,
        uint256 settlementDuration,
        uint256 timestamp
    );

    event TradeFailed(address indexed buyer, address indexed seller, string reason, uint256 timestamp);
    event OrderPlaced(uint256 indexed orderId, address indexed trader, string stockSymbol, string side, uint256 quantity, uint256 price);
    event OrderMatched(uint256 indexed buyOrderId, uint256 indexed sellOrderId, uint256 matchedQuantity, uint256 matchedPrice);
    event CircuitBreakerTriggered(address indexed shareToken, string stockSymbol, uint256 triggerPrice, string direction, uint256 timestamp);
    event CircuitBreakerReset(address indexed shareToken, uint256 timestamp);
    event TraderFlagged(address indexed trader, uint256 failureCount);

    constructor(address _tokenizedINR) Ownable(msg.sender){
        tokenizedINR = IERC20(_tokenizedINR);
    }

    modifier notFlagged(address trader) {
        require(!isFlagged[trader], "Trader is flagged due to repeated failures");
        _;
    }

    modifier notHalted(address shareToken) {
        CircuitBreaker storage cb = circuitBreakers[shareToken];
        if (cb.isHalted && block.timestamp >= cb.haltedAt + cb.cooldownPeriod) {
            cb.isHalted = false;
            emit CircuitBreakerReset(shareToken, block.timestamp);
        }
        require(!cb.isHalted, "Trading halted: circuit breaker active");
        _;
    }

    /// @notice Set circuit breaker parameters for a stock (onlyOwner)
    function setCircuitBreaker(address shareToken, uint256 referencePrice, uint256 cooldownSeconds) external onlyOwner {
        circuitBreakers[shareToken] = CircuitBreaker({
            lastPrice: referencePrice,
            upperLimit: referencePrice * 110 / 100,
            lowerLimit: referencePrice * 90 / 100,
            isHalted: false,
            haltedAt: 0,
            cooldownPeriod: cooldownSeconds
        });
    }

    /// @notice Execute atomic DVP: tokenized INR and shares swap in one tx
    function settleTrade(
        address buyer,
        address seller,
        address shareToken,
        string calldata stockSymbol,
        uint256 quantity,
        uint256 pricePerShare
    ) external nonReentrant notFlagged(buyer) notFlagged(seller) notHalted(shareToken) returns (uint256 tradeId) {
        require(buyer != seller, "Buyer and seller cannot be the same");
        require(quantity > 0, "Quantity must be greater than zero");
        require(pricePerShare > 0, "Price must be greater than zero");

        uint256 totalCost = quantity * pricePerShare * 10**18;
        uint256 shareAmount = quantity * 10**18;

        CircuitBreaker storage cb = circuitBreakers[shareToken];
        if (cb.lastPrice > 0) {
            if (pricePerShare > cb.upperLimit) {
                cb.isHalted = true;
                cb.haltedAt = block.timestamp;
                emit CircuitBreakerTriggered(shareToken, stockSymbol, pricePerShare, "UPPER_LIMIT", block.timestamp);
                revert("Circuit breaker triggered: price above upper limit");
            }
            if (pricePerShare < cb.lowerLimit) {
                cb.isHalted = true;
                cb.haltedAt = block.timestamp;
                emit CircuitBreakerTriggered(shareToken, stockSymbol, pricePerShare, "LOWER_LIMIT", block.timestamp);
                revert("Circuit breaker triggered: price below lower limit");
            }
        }

        require(tokenizedINR.allowance(buyer, address(this)) >= totalCost, "Buyer has not approved enough tINR");
        require(tokenizedINR.balanceOf(buyer) >= totalCost, "Buyer has insufficient tINR balance");
        require(IERC20(shareToken).allowance(seller, address(this)) >= shareAmount, "Seller has not approved enough shares");
        require(IERC20(shareToken).balanceOf(seller) >= shareAmount, "Seller has insufficient share balance");

        uint256 startGas = gasleft();

        // Step 1: Transfer INR from buyer to seller
        bool inrOk = tokenizedINR.transferFrom(buyer, seller, totalCost);
        require(inrOk, "INR transfer failed - entire trade reverted");

        // Step 2: Transfer shares from seller to buyer
        bool sharesOk = IERC20(shareToken).transferFrom(seller, buyer, shareAmount);
        require(sharesOk, "Share transfer failed - entire trade reverted");

        uint256 gasUsed = startGas - gasleft();

        if (cb.lastPrice > 0) {
            cb.lastPrice = pricePerShare;
            cb.upperLimit = pricePerShare * 110 / 100;
            cb.lowerLimit = pricePerShare * 90 / 100;
        }

        tradeId = tradeHistory.length;
        tradeHistory.push(TradeRecord({
            tradeId: tradeId,
            buyer: buyer,
            seller: seller,
            shareToken: shareToken,
            stockSymbol: stockSymbol,
            quantity: quantity,
            pricePerShare: pricePerShare,
            totalValue: quantity * pricePerShare,
            timestamp: block.timestamp,
            settlementDuration: gasUsed,
            status: TradeStatus.Executed
        }));

        totalTradesSettled++;
        totalVolumeINR += quantity * pricePerShare;

        emit TradeSettled(tradeId, buyer, seller, stockSymbol, quantity, quantity * pricePerShare, gasUsed, block.timestamp);

        return tradeId;
    }

    /// @notice Place an order; attempts auto-match and auto-settle
    function placeOrder(
        address shareToken,
        string calldata stockSymbol,
        OrderSide side,
        uint256 quantity,
        uint256 pricePerShare
    ) external notFlagged(msg.sender) notHalted(shareToken) returns (uint256 orderId) {
        orderId = orderBook.length;

        orderBook.push(Order({
            orderId: orderId,
            trader: msg.sender,
            shareToken: shareToken,
            stockSymbol: stockSymbol,
            side: side,
            quantity: quantity,
            pricePerShare: pricePerShare,
            timestamp: block.timestamp,
            isActive: true
        }));

        emit OrderPlaced(orderId, msg.sender, stockSymbol, side == OrderSide.Buy ? "BUY" : "SELL", quantity, pricePerShare);

        _tryAutoMatch(orderId);

        return orderId;
    }

    function _tryAutoMatch(uint256 newOrderId) internal {
        Order storage newOrder = orderBook[newOrderId];

        for (uint256 i = 0; i < orderBook.length; i++) {
            if (i == newOrderId) continue;
            Order storage existing = orderBook[i];

            if (!existing.isActive) continue;
            if (existing.shareToken != newOrder.shareToken) continue;

            bool isBuyVsSell = (newOrder.side == OrderSide.Buy && existing.side == OrderSide.Sell);
            bool isSellVsBuy = (newOrder.side == OrderSide.Sell && existing.side == OrderSide.Buy);

            if (!isBuyVsSell && !isSellVsBuy) continue;
            if (existing.trader == newOrder.trader) continue;

            address buyer;
            address seller;
            uint256 settlementPrice;

            if (newOrder.side == OrderSide.Buy) {
                if (newOrder.pricePerShare < existing.pricePerShare) continue;
                buyer = newOrder.trader;
                seller = existing.trader;
                settlementPrice = existing.pricePerShare;
            } else {
                if (existing.pricePerShare < newOrder.pricePerShare) continue;
                buyer = existing.trader;
                seller = newOrder.trader;
                settlementPrice = newOrder.pricePerShare;
            }

            if (existing.quantity != newOrder.quantity) continue;

            emit OrderMatched(newOrder.side == OrderSide.Buy ? newOrderId : i, newOrder.side == OrderSide.Sell ? newOrderId : i, newOrder.quantity, settlementPrice);

            newOrder.isActive = false;
            existing.isActive = false;

            // auto-settle via external call; if it fails we record failures
            try this.settleTrade(buyer, seller, newOrder.shareToken, newOrder.stockSymbol, newOrder.quantity, settlementPrice) {
                // success
            } catch {
                _recordFailure(buyer);
                _recordFailure(seller);
                newOrder.isActive = true;
                existing.isActive = true;
            }

            return;
        }
    }

    function _recordFailure(address trader) internal {
        failureCount[trader]++;
        if (failureCount[trader] >= MAX_FAILURES) {
            isFlagged[trader] = true;
            emit TraderFlagged(trader, failureCount[trader]);
        }
    }

    function unflagTrader(address trader) external onlyOwner {
        isFlagged[trader] = false;
        failureCount[trader] = 0;
    }

    function getTradeCount() external view returns (uint256) {
        return tradeHistory.length;
    }

    function getTrade(uint256 tradeId) external view returns (TradeRecord memory) {
        require(tradeId < tradeHistory.length, "Trade does not exist");
        return tradeHistory[tradeId];
    }

    function getOrderCount() external view returns (uint256) {
        return orderBook.length;
    }

    function getOrder(uint256 orderId) external view returns (Order memory) {
        require(orderId < orderBook.length, "Order does not exist");
        return orderBook[orderId];
    }

    function getActiveOrderCount(address shareToken) external view returns (uint256 buyCount, uint256 sellCount) {
        for (uint256 i = 0; i < orderBook.length; i++) {
            if (orderBook[i].isActive && orderBook[i].shareToken == shareToken) {
                if (orderBook[i].side == OrderSide.Buy) buyCount++;
                else sellCount++;
            }
        }
    }

    function getAnalytics() external view returns (uint256 _totalSettled, uint256 _totalFailed, uint256 _totalVolume, uint256 _orderBookSize) {
        return (totalTradesSettled, totalTradesFailed, totalVolumeINR, orderBook.length);
    }
}