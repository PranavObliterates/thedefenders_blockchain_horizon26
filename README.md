# 🏦 SettleX — Instant (T+0) Atomic Settlement for Indian Equities

> **Hackathon:** Horizon26 | **Team:** The Defenders

A proof-of-concept demonstrating **atomic Delivery-versus-Payment (DVP)** for tokenized Indian equities using blockchain. Trades settle instantly — shares and INR swap in a single atomic transaction with zero counterparty risk.

---

## ✨ Key Features

- **⚛️ Atomic DVP Settlement** — Shares + INR swap in one transaction; either both succeed or both revert
- **📒 On-chain Order Book** — Place buy/sell orders with automatic matching and settlement
- **🛡️ Circuit Breakers** — NSE-style price band protection per stock
- **💰 Tokenized INR (tINR)** — 1:1 digital rupee simulation with UPI transaction references
- **📊 Regulator Dashboard** — Real-time analytics, audit trail, and circuit breaker monitoring
- **⚠️ Failure Tracking** — Traders flagged after repeated failed settlements

---

## 🏗️ Architecture

```
┌──────────────┐     REST API      ┌──────────────┐     Ethers.js     ┌────────���─────────┐
│   Frontend   │ ◄──────────────► │   Backend    │ ◄──────────────► │  Hardhat Local   │
│  (HTML/JS)   │   localhost:3001  │  (Express)   │   localhost:8545  │   Blockchain     │
│              │                   │              │                   │                  │
│ • Trader UI  │                   │ • /api/deposit│                  │ • TokenizedINR   │
│ • Regulator  │                   │ • /api/order │                   │ • ShareToken (×4)│
│   Dashboard  │                   │ • /api/settle│                   │ • SettlementEngine│
└──────────────┘                   │ • /api/portfolio               │                  │
                                   │ • /api/analytics               └──────────────────┘
                                   └──────────────┘
```

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart Contracts | Solidity 0.8.x, OpenZeppelin 5.x |
| Blockchain | Hardhat 2.x (local node) |
| Backend | Node.js, Express, Ethers.js v5 |
| Frontend | Vanilla HTML/CSS/JavaScript |
| Testing | Mocha, Chai, Hardhat Chai Matchers |

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** v18 or higher
- **npm** or **yarn**

### Step 1: Clone & Install

```bash
git clone https://github.com/PranavObliterates/thedefenders_blockchain_horizon26.git
cd thedefenders_blockchain_horizon26
```

Install dependencies for blockchain and backend:

```bash
# Blockchain
cd blockchain
npm install --legacy-peer-deps
npx hardhat compile

# Backend
cd ../backend
npm install
```

### Step 2: Start the Local Blockchain (Terminal 1)

```bash
cd blockchain
npx hardhat node
```

> Keep this terminal running. It provides a local Ethereum node at `http://127.0.0.1:8545`.

### Step 3: Deploy Smart Contracts (Terminal 2)

```bash
cd blockchain
npx hardhat run scripts/deploy.js --network localhost
```

This deploys all contracts and seeds 3 demo traders with tINR and shares. It outputs `deployed-addresses.json`.

### Step 4: Start the Backend (Terminal 3)

```bash
cd backend
node server.js
```

> Backend starts at `http://localhost:3001`

### Step 5: Open the Frontend

Open `frontend/index.html` in your browser. The trader dashboard will connect to the backend automatically.

Open `frontend/regulator.html` for the regulator/audit view.

---

## 📂 Project Structure

```
├── blockchain/
│   ├── contracts/
│   │   ├── TokenizedINR.sol      # ERC20 digital INR (mint on deposit, burn on withdrawal)
│   │   ├── ShareToken.sol        # ERC20 per stock (RELIANCE, TCS, INFY, HDFCBANK)
│   │   └── SettlementEngine.sol  # Atomic DVP, orderbook, circuit breakers, penalties
│   ├── scripts/
│   │   └── deploy.js             # Deploy all contracts + seed demo data
│   ├── test/
│   │   └── SettleX.test.js       # Full test suite for settlement flows
│   ├── hardhat.config.js
│   └── package.json
├── backend/
│   ├── server.js                 # Express REST API
│   ├── contract.js               # Ethers.js contract bindings
│   └── package.json
├── frontend/
│   ├── index.html                # Trader dashboard
│   ├── regulator.html            # Regulator dashboard
│   ├── regulator.js              # Regulator page logic
│   └── style.css                 # Shared styles
└── README.md
```

---

## 🔄 How It Works

1. **Deposit INR** → Backend calls `TokenizedINR.deposit()` → Mints tINR to trader's wallet
2. **Place Order** → Trader places buy/sell order on `SettlementEngine` → Stored on-chain
3. **Auto-Match** → Engine finds matching buy/sell orders → Automatically triggers settlement
4. **Atomic Settlement** → `settleTrade()` transfers shares (seller → buyer) AND tINR (buyer → seller) in one transaction
5. **Circuit Breaker** → If trade price exceeds band limits, transaction is rejected
6. **Audit Trail** → All trades are permanently recorded on-chain with timestamps

---

## 🧪 Running Tests

```bash
cd blockchain
npx hardhat test
```

Tests cover:
- ✅ Atomic swap success (shares + INR swap)
- ✅ Atomic rollback on failure (insufficient balance)
- ✅ Circuit breaker triggering (price band violations)
- ✅ Auto-matching buy/sell orders
- ✅ tINR minting simulation

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/deposit` | Mint tINR to a trader |
| POST | `/api/order` | Place buy/sell order |
| POST | `/api/settle` | Manually settle a trade |
| GET | `/api/portfolio/:address` | Get trader's tINR + stock balances |
| GET | `/api/orders` | Get all orders in the order book |
| GET | `/api/trades` | Get trade history |
| GET | `/api/analytics` | Get settlement stats + circuit breaker status |
| GET | `/api/traders` | Get demo trader addresses |

---

## ⚠️ Known Limitations (PoC Scope)

- No real UPI/Razorpay integration (deposit is simulated)
- No KYC/identity verification
- No production-grade key management
- No integration with CDSL/NSDL depositories
- Circuit breaker cooldown values are demo-only
- Hardhat local node only (not deployed to testnet)

---

## 🔒 Security Notice

This is a **demo/hackathon project**. Do NOT use real private keys, real money, or real API secrets with this code.

---

## 📜 License

MIT — Free to fork and experiment.

---

## 👥 Team — The Defenders

Built for the **Horizon26 Hackathon**.
