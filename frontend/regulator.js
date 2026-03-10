const API = "http://localhost:3001";
let traders = {};

async function loadAll() {
  await loadAnalytics();
  await loadCircuitBreakers();
  await loadPortfolios();
  await loadAuditTrail();
}

async function loadAnalytics() {
  try {
    const res = await fetch(`${API}/api/analytics`);
    const data = await res.json();
    document.getElementById("totalSettled").textContent = data.totalTradesSettled;
    document.getElementById("totalFailed").textContent = data.totalTradesFailed;
    document.getElementById("totalVolume").textContent = `₹${data.totalVolumeINR.toLocaleString()}`;
    document.getElementById("orderBookSize").textContent = data.orderBookSize;
  } catch (err) {
    console.error(err);
  }
}

async function loadCircuitBreakers() {
  try {
    const res = await fetch(`${API}/api/analytics`);
    const data = await res.json();
    const tbody = document.querySelector("#cbTable tbody");
    tbody.innerHTML = Object.entries(data.circuitBreakers).map(([symbol, cb]) => `
      <tr>
        <td><strong>${symbol}</strong></td>
        <td>₹${cb.lastPrice.toLocaleString()}</td>
        <td>₹${cb.upperLimit.toLocaleString()}</td>
        <td>₹${cb.lowerLimit.toLocaleString()}</td>
        <td class="${cb.isHalted ? 'status-halted' : 'status-active'}">
          ${cb.isHalted ? 'HALTED' : 'ACTIVE'}
        </td>
      </tr>
    `).join("");
  } catch (err) {
    console.error(err);
  }
}

async function loadPortfolios() {
  try {
    const res = await fetch(`${API}/api/traders`);
    traders = await res.json();
    const div = document.getElementById("allPortfolios");
    div.innerHTML = "";

    for (const [name, addr] of Object.entries(traders)) {
      const pRes = await fetch(`${API}/api/portfolio/${addr}`);
      const p = await pRes.json();
      const stockInfo = Object.entries(p.stocks)
        .map(([s, v]) => `<span><strong>${s}:</strong> ${parseFloat(v).toLocaleString()}</span>`)
        .join("");

      div.innerHTML += `
        <div class="portfolio-card">
          <h4>${name} — ${addr.slice(0, 10)}...${addr.slice(-4)}</h4>
          <span><strong>tINR:</strong> ₹${parseFloat(p.tINR).toLocaleString()}</span>
          ${stockInfo}
        </div>
      `;
    }
  } catch (err) {
    console.error(err);
  }
}

async function loadAuditTrail() {
  try {
    const res = await fetch(`${API}/api/trades`);
    const trades = await res.json();
    const tbody = document.querySelector("#auditTable tbody");
    tbody.innerHTML = trades.length === 0
      ? '<tr><td colspan="9" style="text-align:center;color:#666">No trades recorded</td></tr>'
      : trades.map(t => `
        <tr>
          <td>${t.tradeId}</td>
          <td>${t.buyer.slice(0, 8)}...${t.buyer.slice(-4)}</td>
          <td>${t.seller.slice(0, 8)}...${t.seller.slice(-4)}</td>
          <td>${t.stockSymbol}</td>
          <td>${t.quantity}</td>
          <td>₹${t.pricePerShare.toLocaleString()}</td>
          <td>₹${t.totalValue.toLocaleString()}</td>
          <td>${new Date(t.timestamp * 1000).toLocaleString()}</td>
          <td class="status-active">${t.status}</td>
        </tr>
      `).join("");
  } catch (err) {
    console.error(err);
  }
}

loadAll();