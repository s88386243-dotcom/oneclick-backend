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

app.get('/', (req, res) => res.send("Backend Running - OneClick Vault 2.0 - 1800+ Sites Fixed"));

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
  res.json({ status: "pending" });
});
app.post('/api/check_premium', (req, res) => {
  res.json({ is_premium: premiumDevices.has(req.body.device_id) });
});
app.post('/api/info', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "url missing" });
  try {
    const { stdout } = await execAsync(`yt-dlp --dump-json --no-playlist "${url}"`);
    const data = JSON.parse(stdout);
    res.json({ ok: true, title: data.title, thumbnail: data.thumbnail, duration: data.duration_string || data.duration, qualities: [...new Set((data.formats || []).map(f => f.height).filter(Boolean))].sort((a,b)=>b-a) });
  } catch (e) { res.json({ ok: false, error: e.message }); }
});
app.post('/api/download', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.json({ ok: true });
  try {
    const { stdout } = await execAsync(`yt-dlp --dump-json --no-playlist "${url}"`);
    const data = JSON.parse(stdout);
    let muxed = (data.formats || []).filter(f => f.vcodec!== 'none' && f.acodec!== 'none' && f.ext === 'mp4').sort((a,b) => (b.height||0)-(a.height||0))[0];
    if (muxed?.url) return res.json({ ok: true, download_url: muxed.url, url: muxed.url, title: data.title, source: "yt-dlp-muxed" });
    if (data.url) return res.json({ ok: true, download_url: data.url, url: data.url, title: data.title, source: "yt-dlp-direct" });
  } catch (e) {}
  try {
    const { stdout: direct } = await execAsync(`yt-dlp -f "best[ext=mp4]/best" --get-url --no-playlist "${url}"`);
    let u = direct.trim().split('\n')[0];
    if (u.startsWith('http')) return res.json({ ok: true, download_url: u, url: u, source: "yt-dlp-best" });
  } catch (e) {}
  try {
    const cobaltRes = await axios.post('https://api.cobalt.tools/', { url }, { headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' } });
    if (cobaltRes.data?.url) return res.json({ ok: true, download_url: cobaltRes.data.url, url: cobaltRes.data.url, source: "cobalt" });
  } catch (e) {}
  return res.json({ ok: false, error: "Link nahi mila" });
});
app.get('/admin', (req, res) => {
  let html = `<h1>Pending: ${pendingPayments.length}</h1>`;
  pendingPayments.forEach((p, i) => { html += `<div>Device: ${p.device_id} | UTR: ${p.utr} <a href="/approve?i=${i}"><button>APPROVE</button></a></div>`; });
  res.send(html);
});
app.get('/approve', (req, res) => {
  const item = pendingPayments[req.query.i];
  if(item){ premiumDevices.add(item.device_id); pendingPayments.splice(req.query.i, 1); }
  res.redirect('/admin');
});
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("Server running FIXED on " + PORT));
