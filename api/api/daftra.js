// ═══════════════════════════════════════════════════════════
//  CLink · Daftra API Proxy
//  Vercel Serverless Function — api/daftra.js
// ═══════════════════════════════════════════════════════════

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { subdomain, apikey, endpoint, token_type } = req.query;

  if (!apikey || !endpoint) {
    return res.status(400).json({ success:false, error:"missing_params" });
  }

  // بناء الـ headers حسب نوع التوثيق
  const headers = { Accept: "application/json", "Content-Type": "application/json" };
  
  if (token_type === "bearer") {
    // OAuth Access Token
    headers["Authorization"] = `Bearer ${apikey}`;
  } else {
    // API Key العادي
    headers["apikey"] = apikey;
  }

  // محاولة مع subdomain أو بدونه
  const urls = subdomain
    ? [`https://${subdomain}.daftra.com/api2/${endpoint}`, `https://app.daftra.com/api2/${endpoint}`]
    : [`https://app.daftra.com/api2/${endpoint}`];

  let lastErr = null;
  for (const url of urls) {
    try {
      const r = await fetch(url, { headers });
      if (r.status === 401) {
        return res.status(401).json({ success:false, error:"invalid_token", message:"التوثيق فشل — تحقق من البيانات" });
      }
      if (r.status === 404) continue; // جرب الـ URL التالي
      if (!r.ok) {
        lastErr = `HTTP ${r.status}`;
        continue;
      }
      const data = await r.json();
      return res.status(200).json(data);
    } catch(e) {
      lastErr = e.message;
    }
  }

  return res.status(500).json({ success:false, error:"failed", message: lastErr || "فشل الاتصال" });
}
