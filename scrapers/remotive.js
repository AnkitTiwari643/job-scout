/**
 * Remotive job scraper — uses the free public API (no auth needed).
 * Great for remote DevOps/SRE roles.
 */

const log = (msg) => console.log(`[${new Date().toLocaleTimeString()}] [remotive] ${msg}`);

async function scrapeRemotive(searchKeywords) {
  const allJobs = [];

  for (const keyword of searchKeywords) {
    try {
      const q = encodeURIComponent(keyword);
      const res = await fetch(`https://remotive.com/api/remote-jobs?search=${q}&limit=50`);
      if (!res.ok) { log(`HTTP ${res.status} for ${keyword}`); continue; }

      const data = await res.json();
      const jobs = (data.jobs || []).map(j => ({
        title: j.title || '',
        company: j.company_name || '',
        location: j.candidate_required_location || 'Remote',
        link: j.url || '',
        salary: j.salary || '',
        posted: j.publication_date || '',
        tags: (j.tags || []),
        experience: '',
        source: 'remotive',
        searchKeyword: keyword,
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

module.exports = { scrapeRemotive };
