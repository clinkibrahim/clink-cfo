// ═══════════════════════════════════════════════════════════
//  CLink · Daftra API Proxy — api/daftra.js
//  Fix: better logging + token_type validation
// ═══════════════════════════════════════════════════════════
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { subdomain, apikey, endpoint, token_type } = req.query;

  if (!apikey || !endpoint) {
    return res.status(400).json({ success: false, error: "missing_params", required: ["apikey", "endpoint"] });
  }

  // ✅ بناء الـ headers حسب نوع التوثيق
  const headers = { Accept: "application/json", "Content-Type": "application/json" };

  // token_type=bearer → OAuth | غيره → API Key
  if ((token_type || "").toLowerCase() === "bearer") {
    headers["Authorization"] = `Bearer ${apikey}`;
    console.log("[CLink] Using Bearer token for endpoint:", endpoint);
  } else {
    headers["apikey"] = apikey;
    console.log("[CLink] Using apikey for endpoint:", endpoint);
  }

  // ✅ ترتيب محاولات الـ URL
  const urls = [];
  if (subdomain && subdomain.trim()) {
    // نظف الـ subdomain من أي http أو .daftra.com لو جاء كامل
    const clean = subdomain.replace(/https?:\/\//i, "").replace(/\.daftra\.com.*/i, "").trim();
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
          error:   "invalid_token",
          message: "التوثيق فشل — تحقق من التوكن أو أعد تسجيل الدخول",
          url,
        });
      }

      if (r.status === 403) {
        return res.status(403).json({
          success: false,
          error:   "forbidden",
          message: "لا توجد صلاحية لهذه البيانات — تحقق من الـ scopes في دفترة",
          url,
        });
      }

      if (r.status === 404) {
        lastErr = `404 — endpoint not found: ${url}`;
        continue; // جرب الـ URL التالي
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
    error:   "all_urls_failed",
    message: lastErr || "فشل الاتصال بجميع endpoints",
    tried:   urls,
    last_status: lastStatus,
  });
}
