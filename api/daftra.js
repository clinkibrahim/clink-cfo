// CLink CFO — Daftra API Proxy with Pagination
// Fetches ALL pages automatically for complete data

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { apikey, endpoint, subdomain, token_type } = req.query;

  if (!apikey || !endpoint) {
    return res.status(400).json({ error: 'Missing apikey or endpoint' });
  }

  // Build base URL
  const base = subdomain
    ? `https://${subdomain}.daftra.com/api2`
    : 'https://app.daftra.com/api2';

  // Build headers
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'apikey': apikey,
  };
  if (token_type === 'bearer' || token_type === 'Bearer') {
    headers['Authorization'] = `Bearer ${apikey}`;
  }

  // Endpoints that benefit from pagination (potentially many records)
  const PAGINATED = [
    'invoices', 'expenses', 'incomes', 'purchase_invoices',
    'credit_notes', 'clients', 'suppliers', 'journals'
  ];
  const needsPagination = PAGINATED.includes(endpoint);

  try {
    // ── Fetch page 1 ──────────────────────────────────────────
    const url1 = `${base}/${endpoint}.json?page=1&limit=100`;
    const res1 = await fetch(url1, { headers });

    if (!res1.ok) {
      const errText = await res1.text();
      return res.status(res1.status).json({
        error: `Daftra API error: ${res1.status}`,
        detail: errText.substring(0, 200)
      });
    }

    const data1 = await res1.json();

    // No pagination needed or only one page
    if (!needsPagination || !data1.pagination || data1.pagination.page_count <= 1) {
      return res.status(200).json(data1);
    }

    const totalPages = parseInt(data1.pagination.page_count) || 1;
    const totalRecords = parseInt(data1.pagination.total_results) || 0;

    // Cap at 20 pages (~2000 records) to avoid Vercel timeout
    const maxPages = Math.min(totalPages, 20);

    // ── Fetch remaining pages in parallel ─────────────────────
    const pageNums = [];
    for (let p = 2; p <= maxPages; p++) pageNums.push(p);

    // Batch in groups of 5 to avoid overwhelming the API
    const BATCH = 5;
    let allData = [...(data1.data || [])];

    for (let i = 0; i < pageNums.length; i += BATCH) {
      const batch = pageNums.slice(i, i + BATCH);
      const results = await Promise.all(
        batch.map(async (page) => {
          try {
            const r = await fetch(`${base}/${endpoint}.json?page=${page}&limit=100`, { headers });
            if (!r.ok) return [];
            const d = await r.json();
            return Array.isArray(d.data) ? d.data : [];
          } catch {
            return [];
          }
        })
      );
      results.forEach(records => { allData = allData.concat(records); });
    }

    // Return merged response
    return res.status(200).json({
      code: 200,
      result: 'successful',
      data: allData,
      pagination: {
        page: 1,
        page_count: totalPages,
        total_results: totalRecords,
        fetched_pages: maxPages,
        total_fetched: allData.length,
        truncated: totalPages > maxPages
      }
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
