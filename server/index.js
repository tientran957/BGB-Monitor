require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const WebSocket = require('ws');
const http = require('http');
const path = require('path');

const app = express();
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;

// Create HTTP + WebSocket server
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let clients = [];
wss.on('connection', ws => {
  clients.push(ws);
  ws.on('close', () => { clients = clients.filter(c => c !== ws); });
});

function broadcast(obj) {
  const s = JSON.stringify(obj);
  clients.forEach(c => {
    if (c.readyState === WebSocket.OPEN) c.send(s);
  });
}

// Health check
app.get('/health', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// TradingView webhook
app.post('/webhook', async (req, res) => {
  const payload = req.body || {};
  console.log('Webhook received:', payload);

  // Forward to telegram
  if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
    try {
      const text = `[ALERT] ${payload.message || ''} Price: ${payload.price || ''}`;
      await axios.post(
        `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
        { chat_id: process.env.TELEGRAM_CHAT_ID, text }
      );
    } catch (err) {
      console.log("Telegram error:", err.message);
    }
  }

  broadcast({ type: 'alert', payload });
  res.json({ ok: true });
});

// Poll Bitget orderbook every 10 sec
async function pollOrderbook() {
  try {
    const url = `https://api.bitget.com/api/spot/v1/market/depth?symbol=BGBUSDT&limit=200`;
    const r = await axios.get(url);
    const d = r.data?.data;

    if (!d) return;

    const bids = d.bids || [];
    const asks = d.asks || [];

    const bestBid = bids.length ? Number(bids[0][0]) : null;
    const bestAsk = asks.length ? Number(asks[0][0]) : null;

    if (!bestBid || !bestAsk) return;

    const mid = (bestBid + bestAsk) / 2;
    const buyTarget = mid * 0.98;
    const sellTarget = mid * 1.02;

    let buySum = 0;
    let sellSum = 0;

    bids.forEach(([p, q]) => {
      p = Number(p); q = Number(q);
      if (p >= buyTarget) buySum += p * q;
    });

    asks.forEach(([p, q]) => {
      p = Number(p); q = Number(q);
      if (p <= sellTarget) sellSum += p * q;
    });

    broadcast({
      type: 'orderbook',
      buy: Math.round(buySum),
      sell: Math.round(sellSum),
      ts: new Date().toISOString()
    });

  } catch (err) {
    console.log("Orderbook error:", err.message);
  }
}
setInterval(pollOrderbook, 10000);

// Serve frontend
app.use('/', express.static(path.join(__dirname, '..', 'frontend')));

server.listen(PORT, () => {
  console.log('Server running on port', PORT);
});
