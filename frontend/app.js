const API = "http://localhost:3001";
let traders = {};

async function init() {
  const res = await fetch(`${API}/api/traders`);
  traders = await res.json();
  updateTraderAddress();
  loadPortfolio();
  loadOrders();
  loadTrades();
}

function updateTraderAddress() {
  const idx = document.getElementById("traderSelect").value;
  const key = `trader${idx}`;
  document.getElementById("traderAddress").textContent = traders[key] || "";
}

document.getElementById("traderSelect").addEventListener("change", () => {
  updateTraderAddress();
  loadPortfolio();
});

async function loadPortfolio() {
  const idx = document.getElementById("traderSelect").value;
  const addr = traders[`trader${idx}`];
  const div = document.getElementById("portfolio");
  div.innerHTML = '<p class="loading">Loading...</p>';

  try {
    const res = await fetch(`${API}/api/portfolio/${addr}`);
    const data = await res.json();
    div.innerHTML = `
      <p><strong>tINR:</strong> ₹${parseFloat(data.tINR).toLocaleString()}</p>
      ${Object.entries(data.stocks).map(([s, v]) =>
        `<p><strong>${s}:</strong> ${parseFloat(v).toLocaleString()} shares</p>`
      ).join("")}
    `;
  } catch (err) {
    div.innerHTML = `<p class="error">Error loading portfolio</p>`;
  }
}

async function deposit() {
  const idx = document.getElementById("traderSelect").value;
  const addr = traders[`trader${idx}`];
  const amount = document.getElementById("depositAmount").value;
  const resultDiv = document.getElementById("depositResult");

  if (!amount) {
    resultDiv.className = "result error";
    resultDiv.textContent = "Enter an amount";
    return;
  }

  try {
    const res = await fetch(`${API}/api/deposit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ traderAddress: addr, amount: parseInt(amount) }),
    });
    const data = await res.json();
    if (data.success) {
      resultDiv.className = "result success";
      resultDiv.textContent = `Deposited ₹${amount} | Tx: ${data.txHash.slice(0, 20)}...`;
      loadPortfolio();
    } else {
      resultDiv.className = "result error";
      resultDiv.textContent = data.error;
    }
  } catch (err) {
    resultDiv.className = "result error";
    resultDiv.textContent = err.message;
  }
}

async function placeOrder() {
  const traderIndex = parseInt(document.getElementById("traderSelect").value);
  const stockSymbol = document.getElementById("orderStock").value;
  const side = document.getElementById("orderSide").value;
  const quantity = parseInt(document.getElementById("orderQty").value);
  const price = parseInt(document.getElementById("orderPrice").value);
  const resultDiv = document.getElementById("orderResult");

  if (!quantity || !price) {
    resultDiv.className = "result error";
    resultDiv.textContent = "Enter quantity and price";
    return;
  }

  try {
    const res = await fetch(`${API}/api/order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ traderIndex, stockSymbol, side, quantity, price }),
    });
    const data = await res.json();
    if (data.success) {
      resultDiv.className = "result success";
      resultDiv.textContent = `Order placed: ${side.toUpperCase()} ${quantity} ${stockSymbol} @ ₹${price} | Tx: ${data.txHash.slice(0, 20)}...`;
      loadOrders();
      loadTrades();
      loadPortfolio();
    } else {
      resultDiv.className = "result error";
      resultDiv.textContent = data.error;
    }
  } catch (err) {
    resultDiv.className = "result error";
    resultDiv.textContent = err.message;
  }
}

async function loadOrders() {
  try {
    const res = await fetch(`${API}/api/orders`);
    const orders = await res.json();
    const tbody = document.querySelector("#orderBookTable tbody");
    tbody.innerHTML = orders.length === 0
      ? '<tr><td colspan="7" style="text-align:center;color:#666">No orders yet</td></tr>'
      : orders.map(o => `
        <tr>
          <td>${o.orderId}</td>
          <td>${o.trader.slice(0, 8)}...${o.trader.slice(-4)}</td>
          <td>${o.stockSymbol}</td>
          <td style="color:${o.side === 'buy' ? '#00ff64' : '#ff4444'}">${o.side.toUpperCase()}</td>
          <td>${o.quantity}</td>
          <td>₹${o.pricePerShare.toLocaleString()}</td>
          <td class="${o.isActive ? 'status-active' : ''}">${o.isActive ? 'Active' : 'Filled'}</td>
        </tr>
      `).join("");
  } catch (err) {
    console.error(err);
  }
}

async function loadTrades() {
  try {
    const res = await fetch(`${API}/api/trades`);
    const trades = await res.json();
    const tbody = document.querySelector("#tradeTable tbody");
    tbody.innerHTML = trades.length === 0
      ? '<tr><td colspan="8" style="text-align:center;color:#666">No trades yet</td></tr>'
      : trades.map(t => `
        <tr>
          <td>${t.tradeId}</td>
          <td>${t.buyer.slice(0, 8)}...${t.buyer.slice(-4)}</td>
          <td>${t.seller.slice(0, 8)}...${t.seller.slice(-4)}</td>
          <td>${t.stockSymbol}</td>
          <td>${t.quantity}</td>
          <td>₹${t.pricePerShare.toLocaleString()}</td>
          <td>₹${t.totalValue.toLocaleString()}</td>
          <td class="status-active">${t.status}</td>
        </tr>
      `).join("");
  } catch (err) {
    console.error(err);
  }
}

init();