// ═══════════════════════════════════════════════════════════
//  CLink · Daftra OAuth Callback — api/callback.js
//  Fix: token_type case-insensitive + subdomain extraction
// ═══════════════════════════════════════════════════════════
export default async function handler(req, res) {
  const { code, error } = req.query;
  if (error) return res.redirect(`/?auth=error&reason=${encodeURIComponent(error)}`);
  if (!code)  return res.redirect("/?auth=error&reason=no_code");

  const CLIENT_ID     = process.env.DAFTRA_CLIENT_ID;
  const CLIENT_SECRET = process.env.DAFTRA_CLIENT_SECRET;
  const REDIRECT_URI  = process.env.DAFTRA_REDIRECT_URI;

  if (!CLIENT_SECRET) return res.redirect("/?auth=error&reason=missing_secret");
  if (!CLIENT_ID)     return res.redirect("/?auth=error&reason=missing_client_id");

  try {
    // تبادل code بـ access_token
    const tokenRes = await fetch("https://app.daftra.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        grant_type:    "authorization_code",
        client_id:     CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri:  REDIRECT_URI,
        code,
      }),
    });

    const raw = await tokenRes.text();
    console.log("[CLink] Daftra token response:", tokenRes.status, raw);

    if (!tokenRes.ok) {
      console.error("[CLink] Token exchange failed:", tokenRes.status, raw);
      return res.redirect(`/?auth=error&reason=token_exchange_failed`);
    }

    let tokenData;
    try {
      tokenData = JSON.parse(raw);
    } catch {
      console.error("[CLink] Failed to parse token response:", raw);
      return res.redirect(`/?auth=error&reason=invalid_json`);
    }

    // ✅ الإصلاح الرئيسي: toLowerCase() لتجنب مشكلة الحرف الكبير "Bearer"
    const raw_token_type = (tokenData.token_type || "").toLowerCase();
    const token_type = raw_token_type === "bearer" ? "bearer" : "apikey";

    // استخراج الـ token من أي حقل يرجعه دفترة
    const access_token =
      tokenData.access_token ||
      tokenData.token        ||
      tokenData.apikey       ||
      null;

    if (!access_token) {
      console.error("[CLink] No access token found in response:", tokenData);
      return res.redirect(`/?auth=error&reason=no_token`);
    }

    // ✅ استخراج الـ subdomain من أي حقل ممكن
    const subdomain =
      tokenData.subdomain  ||
      tokenData.store_url  ||
      tokenData.domain     ||
      tokenData.company_subdomain ||
      "";

    console.log("[CLink] Auth success — token_type:", token_type, "| subdomain:", subdomain || "none");

    const params = new URLSearchParams({
      auth:       "success",
      token:      access_token,
      token_type: token_type,
      subdomain:  subdomain,
    });

    return res.redirect(`/?${params.toString()}`);

  } catch (err) {
    console.error("[CLink] Callback exception:", err.message);
    return res.redirect(`/?auth=error&reason=${encodeURIComponent(err.message)}`);
  }
}
