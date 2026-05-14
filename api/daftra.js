// ═══════════════════════════════════════════════════════════
//  CLink · Daftra API Proxy — api/daftra.js
//  Fix: Daftra REST API uses apikey header for ALL auth
// ═══════════════════════════════════════════════════════════
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { subdomain, apikey, endpoint, token_type } = req.query;

  if (!apikey || !endpoint) {
    return res.status(400).json({
      success: false,
      error: "missing_params",
      required: ["apikey", "endpoint"],
    });
  }

  // ✅ Daftra REST API uses apikey header for ALL requests
  // including OAuth Bearer tokens — Authorization: Bearer is NOT supported
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
    "apikey": apikey,
  };

  console.log("[CLink] Calling endpoint:", endpoint, "| token_type:", token_type);

  // ✅ Build URL list to try
  const urls = [];
  if (subdomain && subdomain.trim()) {
    const clean = subdomain
      .replace(/https?:\/\//i, "")
      .replace(/\.daftra\.com.*/i, "")
      .trim();
    if (clean) {
      urls.push(`https://${clean}.daftra.com/api2/${endpoint}`);
    }
  }
  urls.push(`https://app.daftra.com/api2/${endpoint}`);

  console.log("[CLink] Trying URLs:", urls);

  let lastErr = null;
  let lastStatus = null;

  for (const url of urls) {
    try {
      const r = await fetch(url, { headers });
      lastStatus = r.status;
      console.log("[CLink] Response from", url, "→ status:", r.status);

      if (r.status === 401) {
        return res.status(401).json({
          success: false,
          error: "invalid_token",
          message: "التوثيق فشل — تحقق من التوكن أو أعد تسجيل الدخول",
          url,
        });
      }

      if (r.status === 403) {
        return res.status(403).json({
          success: false,
          error: "forbidden",
          message: "لا توجد صلاحية لهذه البيانات — تحقق من الصلاحيات في دفترة",
          url,
        });
      }

      if (r.status === 404) {
        lastErr = `404 — not found: ${url}`;
        continue;
      }

      if (!r.ok) {
        lastErr = `HTTP ${r.status} from ${url}`;
        continue;
      }

      const data = await r.json();
      return res.status(200).json(data);

    } catch (e) {
      lastErr = e.message;
      console.error("[CLink] Fetch error for", url, ":", e.message);
    }
  }

  return res.status(500).json({
    success: false,
    error: "all_urls_failed",
    message: lastErr || "فشل الاتصال بجميع endpoints",
    tried: urls,
    last_status: lastStatus,
  });
}
