const express = require('express');
const cors = require('cors');
const app = express();
app.use(cors());
app.use(express.json());

let premiumDevices = new Set(); // jisko premium milega
let pendingPayments = []; // jinka UTR aayega

// 1. QR Dene wala API - YAHAN APNA UPI DAAL DE
app.post('/api/get_qr', (req, res) => {
  res.json({
    upi_id: "s.maddheshia@ptaxis", // <-- APNA UPI ID YAHAN LIKH
    amount: "10",
    name: "OneClick Vault",
    qr_url: "https://api.qrserver.com/v1/create-qr-code/?data=upi://pay?pa=TERA-UPI-YAHAN-DAAL@oksbi&pn=OneClick&am=10&cu=INR"
  });
});

// 2. UTR Verify wala
app.post('/api/verify_payment', (req, res) => {
  const { device_id, utr } = req.body;
  pendingPayments.push({ device_id, utr, time: new Date().toLocaleString() });
  console.log("New Payment Pending:", device_id, utr);
  res.json({ status: "pending" });
});

// 3. Premium Check
app.post('/api/check_premium', (req, res) => {
  res.json({ is_premium: premiumDevices.has(req.body.device_id) });
});

// 4. Download Limit Check (3 free)
let downloadCounts = {};
app.post('/api/download', (req, res) => {
  const { device_id } = req.body;
  if (premiumDevices.has(device_id)) return res.json({ ok: true });
  
  downloadCounts[device_id] = (downloadCounts[device_id] || 0) + 1;
  if (downloadCounts[device_id] > 3) return res.status(403).json({ error: "limit over" });
  res.json({ ok: true, count: downloadCounts[device_id] });
});

// 5. ADMIN PANEL - Jahan tu Approve karega
app.get('/admin', (req, res) => {
  let html = `<h1>OneClick Vault - Admin Panel</h1><h2>Pending Payments: ${pendingPayments.length}</h2>`;
  pendingPayments.forEach((p, i) => {
    html += `<div style="border:1px solid #000;padding:10px;margin:10px;">
      Device: ${p.device_id} <br> UTR: <b>${p.utr}</b> <br> Time: ${p.time} <br>
      <a href="/approve?i=${i}"><button style="background:green;color:white;padding:10px;">APPROVE - Premium Do</button></a>
    </div>`;
  });
  res.send(html);
});

app.get('/approve', (req, res) => {
  const item = pendingPayments[req.query.i];
  if(item){
    premiumDevices.add(item.device_id);
    pendingPayments.splice(req.query.i, 1);
  }
  res.redirect('/admin');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on " + PORT));