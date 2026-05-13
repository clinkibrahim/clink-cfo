// ═══════════════════════════════════════════════════════════
//  CLink · Daftra OAuth Callback — api/callback.js
// ═══════════════════════════════════════════════════════════

export default async function handler(req, res) {
  const { code, error } = req.query;

  if (error) return res.redirect(`/?auth=error&reason=${encodeURIComponent(error)}`);
  if (!code)  return res.redirect("/?auth=error&reason=no_code");

  const CLIENT_ID     = process.env.DAFTRA_CLIENT_ID     || "555";
  const CLIENT_SECRET = process.env.DAFTRA_CLIENT_SECRET;
  const REDIRECT_URI  = process.env.DAFTRA_REDIRECT_URI  || "https://clink-menu.vercel.app/callback";

  if (!CLIENT_SECRET) return res.redirect("/?auth=error&reason=missing_secret");

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
    console.log("Daftra token response:", tokenRes.status, raw);

    if (!tokenRes.ok) {
      // إذا فشل التبادل — أرسل الـ code مباشرة للتطبيق
      return res.redirect(`/?auth=code&code=${encodeURIComponent(code)}`);
    }

    let tokenData;
    try { tokenData = JSON.parse(raw); } 
    catch { return res.redirect(`/?auth=code&code=${encodeURIComponent(code)}`); }

    const access_token = tokenData.access_token || tokenData.token || tokenData.apikey;
    const subdomain    = tokenData.subdomain || tokenData.store_url || "";
    const token_type   = tokenData.token_type === "bearer" ? "bearer" : "apikey";

    if (!access_token) {
      return res.redirect(`/?auth=code&code=${encodeURIComponent(code)}`);
    }

    const params = new URLSearchParams({
      auth: "success",
      token: access_token,
      subdomain: subdomain,
      token_type,
    });

    return res.redirect(`/?${params.toString()}`);

  } catch(err) {
    console.error("Callback error:", err);
    // Fallback: أرسل الـ code للتطبيق
    return res.redirect(`/?auth=code&code=${encodeURIComponent(code)}`);
  }
}
