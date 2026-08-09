/**
 * Arbeitnow job scraper — uses the free public API (no auth needed).
 * Only includes jobs posted in the last 24 hours.
 */

const log = (msg) => console.log(`[${new Date().toLocaleTimeString()}] [arbeitnow] ${msg}`);

async function scrapeArbeitnow(searchKeywords) {
  const allJobs = [];
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

  for (const keyword of searchKeywords) {
    try {
      const q = encodeURIComponent(keyword);
      const res = await fetch(`https://www.arbeitnow.com/api/job-board-api?search=${q}&per_page=50`);
      if (!res.ok) { log(`HTTP ${res.status} for ${keyword}`); continue; }

      const data = await res.json();
      const jobs = (data.data || [])
        .filter(j => {
          // Filter: only jobs posted in the last 24 hours
          if (!j.created_at) return false;
          // created_at can be unix timestamp or ISO string
          const ts = typeof j.created_at === 'number' ? j.created_at * 1000 : new Date(j.created_at).getTime();
          return ts > oneDayAgo;
        })
        .map(j => ({
          title: j.title || '',
          company: j.company_name || '',
          location: j.location || '',
          link: j.url || '',
          salary: '',
          posted: j.created_at || '',
          tags: (j.tags || []),
          experience: '',
          source: 'arbeitnow',
          searchKeyword: keyword,
          remote: j.remote || false,
        }));

      allJobs.push(...jobs);
      await sleep(500);
    } catch (e) {
      log(`Error fetching ${keyword}: ${e.message}`);
    }
  }

  log(`Total (last 24h): ${allJobs.length} jobs`);

  const seen = new Set();
  return allJobs.filter(j => {
    if (seen.has(j.link)) return false;
    seen.add(j.link);
    return true;
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

module.exports = { scrapeArbeitnow };
