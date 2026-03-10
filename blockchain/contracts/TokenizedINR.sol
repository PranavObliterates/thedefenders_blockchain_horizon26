// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title TokenizedINR - Digital INR token for on-chain settlement
/// @notice 1 token represents 1 INR for the PoC. Minted when UPI deposit is confirmed.
contract TokenizedINR is ERC20, Ownable {

    struct Transaction {
        address trader;
        uint256 amount;
        string txType;    // "DEPOSIT" or "WITHDRAWAL"
        string upiTxnId;  // UPI transaction reference or backend ref
        uint256 timestamp;
    }

    Transaction[] public transactionHistory;

    event Deposited(address indexed trader, uint256 amount, string upiTxnId);
    event Withdrawn(address indexed trader, uint256 amount, string upiTxnId);

    // NOTE: pass msg.sender to Ownable base constructor
    constructor() ERC20("Tokenized Indian Rupee", "tINR") Ownable(msg.sender) {}

    /// @notice Mint tINR when UPI deposit is confirmed by backend (onlyOwner)
    function deposit(
        address trader,
        uint256 amount,
        string calldata upiTxnId
    ) external onlyOwner {
        require(trader != address(0), "Invalid trader address");
        require(amount > 0, "Amount must be greater than zero");

        _mint(trader, amount * 10**decimals());

        transactionHistory.push(Transaction({
            trader: trader,
            amount: amount,
            txType: "DEPOSIT",
            upiTxnId: upiTxnId,
            timestamp: block.timestamp
        }));

        emit Deposited(trader, amount, upiTxnId);
    }

    /// @notice Burn tINR when trader withdraws to bank via backend (onlyOwner)
    function withdraw(
        address trader,
        uint256 amount,
        string calldata upiTxnId
    ) external onlyOwner {
        require(trader != address(0), "Invalid trader address");
        require(amount > 0, "Amount must be greater than zero");
        require(balanceOf(trader) >= amount * 10**decimals(), "Insufficient tINR balance");

        _burn(trader, amount * 10**decimals());

        transactionHistory.push(Transaction({
            trader: trader,
            amount: amount,
            txType: "WITHDRAWAL",
            upiTxnId: upiTxnId,
            timestamp: block.timestamp
        }));

        emit Withdrawn(trader, amount, upiTxnId);
    }

    /// @notice Number of on-chain deposit/withdraw records
    function getTransactionCount() external view returns (uint256) {
        return transactionHistory.length;
    }

    /// @notice Simplified mint for tests and demo (onlyOwner)
    function depositSimple(address trader, uint256 amount) external onlyOwner {
        require(trader != address(0), "Invalid trader address");
        require(amount > 0, "Amount must be greater than zero");
        _mint(trader, amount * 10**decimals());
        emit Deposited(trader, amount, "DIRECT_MINT");
    }
}