const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const app = express();
app.use(cors());
app.use(express.json());

let premiumDevices = new Set();
let pendingPayments = [];
let downloadCounts = {};

app.get('/', (req, res) => res.send("Backend Running - OneClick Vault 2.0 - 1800+ Sites"));

// UPI QR - same as before
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

// NEW: INFO endpoint - 1800+ sites ke liye title/thumbnail/quality
app.post('/api/info', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "url missing" });
  try {
    const { stdout } = await execAsync(`yt-dlp --dump-json --no-playlist "${url}"`);
    const data = JSON.parse(stdout);
    res.json({
      ok: true,
      title: data.title,
      thumbnail: data.thumbnail,
      duration: data.duration_string || data.duration,
      qualities: [...new Set((data.formats || []).map(f => f.height).filter(Boolean))].sort((a,b)=>b-a)
    });
  } catch (e) {
    console.log("info error", e.message);
    res.json({ ok: false, error: e.message });
  }
});

// MAIN DOWNLOADER - UPGRADED TO 1800+ SITES
app.post('/api/download', async (req, res) => {
  const { device_id, url, quality = "1080" } = req.body;
  console.log("Request URL:", url, "Device:", device_id);

  if (!premiumDevices.has(device_id)) {
    downloadCounts[device_id] = (downloadCounts[device_id] || 0) + 1;
    if (downloadCounts[device_id] > 3 && !url) {
       return res.status(403).json({ error: "limit over" });
    }
  }
  if (!url) return res.json({ ok: true });

  // 1st Try: yt-dlp -> 1800+ sites (YouTube, X, Pinterest, Bilibili, etc)
  try {
    const { stdout } = await execAsync(`yt-dlp --no-playlist -f "bestvideo[height<=${quality}]+bestaudio/best" --get-url "${url}"`);
    const directUrl = stdout.trim().split('\n')[0];
    if (directUrl && directUrl.startsWith('http')) {
      console.log("yt-dlp Success:", directUrl.substring(0,80));
      return res.json({ ok: true, download_url: directUrl, url: directUrl, source: "yt-dlp" });
    }
    throw new Error("no url from yt-dlp");
  } catch (e) {
    console.log("yt-dlp failed, trying cobalt:", e.message);
  }

  // 2nd Try: Cobalt (tera purana wala stable)
  try {
    const cobaltRes = await axios.post('https://api.cobalt.tools/', { url: url },
      { headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' } }
    );
    if (cobaltRes.data && cobaltRes.data.url) {
      console.log("Cobalt Success");
      return res.json({ ok: true, download_url: cobaltRes.data.url, url: cobaltRes.data.url, source: "cobalt" });
    }
  } catch (e) {
    console.log("Cobalt Error:", e.message);
  }

  // 3rd Try: Backup IG regex
  try {
    const instaUrl = url.split('?')[0];
    const resp = await axios.get(instaUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    let match = resp.data.match(/"video_url":"([^"]+)"/);
    if (match && match[1]) {
      let videoUrl = match[1].replace(/\\u0026/g, '&').replace(/\\/g, '');
      return res.json({ ok: true, download_url: videoUrl, url: videoUrl, source: "backup" });
    }
  } catch (e2) {
    console.log("Backup also failed");
  }

  return res.json({ ok: false, url: null, error: "Direct link nahi mila" });
});

app.get('/admin', (req, res) => {
  let html = `<h1>Admin - Pending: ${pendingPayments.length} | Premium: ${premiumDevices.size}</h1>`;
  pendingPayments.forEach((p, i) => {
    html += `<div style="border:1px solid #000;padding:10px;margin:10px;">
      Device: ${p.device_id}<br>UTR: <b>${p.utr}</b> - ${p.time}<br>
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
app.listen(PORT, () => console.log("Server running on " + PORT + " with 1800+ sites"));
