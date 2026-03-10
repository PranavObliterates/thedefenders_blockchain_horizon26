// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title ShareToken - Tokenized equity shares (PoC)
/// @notice Deploy one instance per stock symbol for the demo.
contract ShareToken is ERC20, Ownable {

    string public stockSymbol;
    string public exchange;        // "NSE" or "BSE"
    uint256 public totalIssuedShares;

    struct Allocation {
        address trader;
        uint256 quantity;
        uint256 timestamp;
    }

    Allocation[] public allocationHistory;

    event SharesAllocated(address indexed trader, uint256 quantity);
    event SharesRevoked(address indexed trader, uint256 quantity);

    constructor(
        string memory _companyName,
        string memory _symbol,
        string memory _exchange,
        uint256 _totalShares
    ) ERC20(_companyName, _symbol) Ownable(msg.sender) {
        
        stockSymbol = _symbol;
        exchange = _exchange;
        totalIssuedShares = _totalShares;
        // Mint all shares to deployer (simulates depository)
        _mint(msg.sender, _totalShares * 10**decimals());
    }

    /// @notice Allocate shares to a trader (onlyOwner simulates depository)
    function allocateShares(address trader, uint256 quantity) external onlyOwner {
        require(trader != address(0), "Invalid trader address");
        require(quantity > 0, "Quantity must be greater than zero");
        require(balanceOf(owner()) >= quantity * 10**decimals(), "Not enough shares in depository");

        _transfer(owner(), trader, quantity * 10**decimals());

        allocationHistory.push(Allocation({
            trader: trader,
            quantity: quantity,
            timestamp: block.timestamp
        }));

        emit SharesAllocated(trader, quantity);
    }

    /// @notice Human-readable share balance
    function shareBalanceOf(address trader) external view returns (uint256) {
        return balanceOf(trader) / 10**decimals();
    }

    function getAllocationCount() external view returns (uint256) {
        return allocationHistory.length;
    }
}