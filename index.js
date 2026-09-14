const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();
app.use(cors());
app.use(express.json());

let premiumDevices = new Set();
let pendingPayments = [];
let downloadCounts = {};

app.get('/', (req, res) => res.send("Backend Running - OneClick Vault"));

app.post('/api/get_qr', (req, res) => {
  res.json({
    upi_id: "s.maddheshia@ptaxis",
    amount: "10",
    name: "OneClick Vault",
    qr_url: "https://api.qrserver.com/v1/create-qr-code/?data=upi://pay?pa=s.maddheshia@ptaxis&pn=OneClick&am=10&cu=INR"
  });
});

app.post('/api/verify_payment', (req, res) => {
  const { device_id, utr } = req.body;
  pendingPayments.push({ device_id, utr, time: new Date().toLocaleString() });
  console.log("Pending:", device_id, utr);
  res.json({ status: "pending" });
});

app.post('/api/check_premium', (req, res) => {
  res.json({ is_premium: premiumDevices.has(req.body.device_id) });
});

// MAIN DOWNLOADER - IG + FB DONO KE LIYE
app.post('/api/download', async (req, res) => {
  const { device_id, url } = req.body;
  console.log("Request URL:", url, "Device:", device_id);

  if (!premiumDevices.has(device_id)) {
    downloadCounts[device_id] = (downloadCounts[device_id] || 0) + 1;
    if (downloadCounts[device_id] > 3 &&!url) {
       return res.status(403).json({ error: "limit over" });
    }
  }
  if (!url) return res.json({ ok: true });

  try {
    // Cobalt API - free aur sabse stable hai
    const cobaltRes = await axios.post('https://api.cobalt.tools/',
      { url: url },
      { headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' } }
    );

    if (cobaltRes.data && cobaltRes.data.url) {
      console.log("Cobalt Success:", cobaltRes.data.url);
      return res.json({
        ok: true,
        download_url: cobaltRes.data.url,
        url: cobaltRes.data.url
      });
    }

    // Agar cobalt fail ho to backup method
    throw new Error("Cobalt no url");

  } catch (e) {
    console.log("Cobalt Error, trying backup:", e.message);
    try {
      // Backup: Direct Instagram regex
      const instaUrl = url.split('?')[0];
      const resp = await axios.get(instaUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      let match = resp.data.match(/"video_url":"([^"]+)"/);
      if (match && match[1]) {
        let videoUrl = match[1].replace(/\\u0026/g, '&').replace(/\\/g, '');
        return res.json({ ok: true, download_url: videoUrl, url: videoUrl });
      }
    } catch (e2) {
      console.log("Backup also failed:", e2.message);
    }

    return res.json({ ok: false, url: null, error: "Direct link nahi mila" });
  }
});

app.get('/admin', (req, res) => {
  let html = `<h1>Admin - Pending: ${pendingPayments.length}</h1>`;
  pendingPayments.forEach((p, i) => {
    html += `<div style="border:1px solid #000;padding:10px;margin:10px;">
      Device: ${p.device_id}<br>UTR: <b>${p.utr}</b><br>
      <a href="/approve?i=${i}"><button style="background:green;color:white;padding:10px;">APPROVE</button></a>
    </div>`;
  });
  res.send(html);
});

app.get('/approve', (req, res) => {
  const item = pendingPayments[req.query.i];
  if(item){ premiumDevices.add(item.device_id); pendingPayments.splice(req.query.i, 1); }
  res.redirect('/admin');
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("Server running on " + PORT));
