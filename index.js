// MAIN DOWNLOADER - FIXED FOR AUDIO+VIDEO
app.post('/api/download', async (req, res) => {
  const { device_id, url, quality = "1080" } = req.body;
  console.log("Request URL:", url);

  if (!url) return res.json({ ok: true });

  // 1st Try: Get MUXED mp4 (video+audio in single file) - fixes mute
  try {
    // Pehle JSON se best muxed format nikalte hain
    const { stdout } = await execAsync(`yt-dlp --dump-json --no-playlist "${url}"`);
    const data = JSON.parse(stdout);

    // Aisa format dhoondo jisme video+audio dono ho
    let bestMuxed = (data.formats || [])
     .filter(f => f.vcodec!== 'none' && f.acodec!== 'none' && f.ext === 'mp4')
     .sort((a,b) => (b.height || 0) - (a.height || 0))[0];

    if (bestMuxed && bestMuxed.url) {
      console.log("Muxed MP4 found:", bestMuxed.height);
      return res.json({ ok: true, download_url: bestMuxed.url, url: bestMuxed.url, title: data.title, source: "yt-dlp-muxed" });
    }

    // Agar muxed na mile to best url hi dedo
    if (data.url) {
      return res.json({ ok: true, download_url: data.url, url: data.url, title: data.title, source: "yt-dlp-direct" });
    }

    // Fallback: get-url with progressive format
    const { stdout: direct } = await execAsync(`yt-dlp --no-playlist -f "best[ext=mp4]/best" --get-url "${url}"`);
    const directUrl = direct.trim().split('\n')[0];
    if (directUrl.startsWith('http')) {
      return res.json({ ok: true, download_url: directUrl, url: directUrl, source: "yt-dlp-best" });
    }
  } catch (e) {
    console.log("yt-dlp failed:", e.message);
  }

  // 2nd Try: Cobalt
  try {
    const cobaltRes = await axios.post('https://api.cobalt.tools/', { url: url },
      { headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' } }
    );
    if (cobaltRes.data?.url) {
      return res.json({ ok: true, download_url: cobaltRes.data.url, url: cobaltRes.data.url, source: "cobalt" });
    }
  } catch (e) {
    console.log("Cobalt Error:", e.message);
  }

  return res.json({ ok: false, url: null, error: "Direct link nahi mila" });
});
