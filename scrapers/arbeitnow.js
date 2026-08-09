/**
 * Arbeitnow job scraper — uses the free public API (no auth needed).
 * Good coverage of DevOps roles globally.
 */

const log = (msg) => console.log(`[${new Date().toLocaleTimeString()}] [arbeitnow] ${msg}`);

async function scrapeArbeitnow(searchKeywords) {
  const allJobs = [];

  for (const keyword of searchKeywords) {
    try {
      const q = encodeURIComponent(keyword);
      const res = await fetch(`https://www.arbeitnow.com/api/job-board-api?search=${q}&per_page=50`);
      if (!res.ok) { log(`HTTP ${res.status} for ${keyword}`); continue; }

      const data = await res.json();
      const jobs = (data.data || []).map(j => ({
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

  log(`Total: ${allJobs.length} jobs`);

  // deduplicate by link
  const seen = new Set();
  return allJobs.filter(j => {
    if (seen.has(j.link)) return false;
    seen.add(j.link);
    return true;
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

module.exports = { scrapeArbeitnow };
