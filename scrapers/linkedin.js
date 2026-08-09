/**
 * LinkedIn job scraper — uses the public guest jobs API (no auth needed).
 * Fetches job listings by keyword + location via HTML parsing.
 * Only fetches jobs posted in the last 24 hours (f_TPR=r86400).
 */

const log = (msg) => console.log(`[${new Date().toLocaleTimeString()}] [linkedin] ${msg}`);

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function scrapeLinkedIn(searchKeywords, locations = ['India']) {
  const allJobs = [];

  for (const keyword of searchKeywords) {
    for (const location of locations) {
      // Fetch 2 pages (0, 25) = up to 50 jobs per keyword (less pages since we filter by 24h)
      for (const start of [0, 25]) {
        try {
          const q = encodeURIComponent(keyword);
          const loc = encodeURIComponent(location);
          // f_TPR=r86400 = posted in last 24 hours (86400 seconds = 1 day)
          const url = `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=${q}&location=${loc}&start=${start}&sortBy=DD&f_TPR=r86400`;

          const res = await fetch(url, { headers: { 'User-Agent': UA } });
          if (!res.ok) { log(`HTTP ${res.status} for ${keyword} (page ${start})`); continue; }

          const html = await res.text();
          const jobs = parseLinkedInHTML(html, keyword);
          allJobs.push(...jobs);

          if (jobs.length === 0) break; // no more results for this keyword
          await sleep(1500); // rate limit
        } catch (e) {
          log(`Error fetching ${keyword}: ${e.message}`);
        }
      }
    }
    log(`"${keyword}": ${allJobs.length} total jobs so far`);
  }

  // deduplicate by link
  const seen = new Set();
  return allJobs.filter(j => {
    const key = j.link.split('?')[0];
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function parseLinkedInHTML(html, searchKeyword) {
  const jobs = [];

  const titles = [...html.matchAll(/<h3[^>]*class="base-search-card__title[^"]*"[^>]*>([^<]+)/g)].map(m => m[1].trim());
  const companies = [...html.matchAll(/<h4[^>]*class="base-search-card__subtitle[^"]*"[^>]*>\s*(?:<a[^>]*>)?([^<]+)/g)].map(m => m[1].trim());
  const locations = [...html.matchAll(/<span[^>]*class="job-search-card__location"[^>]*>([^<]+)/g)].map(m => m[1].trim());
  const links = [...html.matchAll(/<a[^>]*class="base-card__full-link[^"]*"[^>]*href="([^"]+)"/g)].map(m => m[1].split('?')[0]);
  const dates = [...html.matchAll(/<time[^>]*datetime="([^"]+)"/g)].map(m => m[1]);
  const salaries = [...html.matchAll(/<span[^>]*class="job-search-card__salary-info[^"]*"[^>]*>([^<]+)/g)].map(m => m[1].trim());
  // Also try to get salary from list items
  const listSalaries = [...html.matchAll(/<li[^>]*class="[^"]*salary[^"]*"[^>]*>([^<]+)/g)].map(m => m[1].trim());

  for (let i = 0; i < titles.length; i++) {
    jobs.push({
      title: titles[i] || '',
      company: companies[i] || '',
      location: locations[i] || '',
      link: links[i] || '',
      salary: salaries[i] || listSalaries[i] || '',
      posted: dates[i] || '',
      tags: [],
      experience: '',
      source: 'linkedin',
      searchKeyword,
    });
  }

  return jobs;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

module.exports = { scrapeLinkedIn };
