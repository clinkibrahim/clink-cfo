// api/daftra.js — CLink CFO v6 | Trial Balance Edition
// Full pagination + date_from/date_to support

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { apikey, endpoint, subdomain, token_type, date_from, date_to } = req.query;

  if (!apikey || !endpoint) {
    return res.status(400).json({ error: "Missing apikey or endpoint" });
  }

  const NO_DATE   = ["journal_accounts", "treasuries"];
  const NO_PAGES  = ["journal_accounts", "treasuries"];

  const base = subdomain
    ? `https://${subdomain}.daftra.com/api2`
    : `https://arabfoodgate.daftra.com/api2`;

  const headers = token_type === "bearer"
    ? { Authorization: `Bearer ${apikey}` }
    : { apikey };

  // Single-page (no pagination needed)
  if (NO_PAGES.includes(endpoint)) {
    try {
      const r = await fetch(`${base}/${endpoint}.json`, { headers });
      if (!r.ok) return res.status(r.status).json({ error: `Daftra ${r.status}` });
      return res.status(200).json(await r.json());
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // Paginated fetch
  const all = [];
  for (let page = 1; page <= 20; page++) {
    const p = new URLSearchParams({ page, limit: 100 });
    if (!NO_DATE.includes(endpoint) && date_from) p.append("date_from", date_from);
    if (!NO_DATE.includes(endpoint) && date_to)   p.append("date_to",   date_to);

    try {
      const r = await fetch(`${base}/${endpoint}.json?${p}`, { headers });
      if (!r.ok) { if (page === 1) return res.status(r.status).json({ error: `Daftra ${r.status}` }); break; }
      const json = await r.json();
      const items = Array.isArray(json.data) ? json.data
                  : Array.isArray(json)       ? json
                  : Object.values(json).find(v => Array.isArray(v)) || [];
      if (!items.length) break;
      all.push(...items);
      if (items.length < 100) break;
    } catch (e) {
      if (page === 1) return res.status(500).json({ error: e.message });
      break;
    }
  }
  return res.status(200).json({ data: all });
}
