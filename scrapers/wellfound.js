/**
 * Wellfound job scraper — scrapes job listings from Wellfound using saved session.
 */
const path = require('path');

let chromium;
try {
  const { addExtra } = require('playwright-extra');
  chromium = addExtra(require('playwright-core').chromium);
  chromium.use(require('puppeteer-extra-plugin-stealth')());
} catch (e) {
  ({ chromium } = require('playwright-core'));
}

const log = (msg) => console.log(`[${new Date().toLocaleTimeString()}] [wellfound] ${msg}`);

async function scrapeWellfound() {
  const jobs = [];
  let ctx;

  try {
    ctx = await chromium.launchPersistentContext(path.join(__dirname, '..', '.wellfound-chrome-profile'), {
      channel: process.env.CHROME_CHANNEL || 'chrome',
      headless: false,
      viewport: { width: 1280, height: 900 },
      args: [
        '--disable-blink-features=AutomationControlled',
        '--window-position=-32000,-32000',
        '--no-sandbox',
        '--disable-dev-shm-usage',
      ],
    });

    const page = ctx.pages()[0] || await ctx.newPage();
    await page.goto('https://wellfound.com/jobs', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(5000);

    // scroll a few times to load more jobs
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(2000);
    }

    const pageJobs = await page.evaluate(() => {
      const results = [];
      const links = document.querySelectorAll('a[href*="/jobs/"]');

      for (const a of links) {
        if (!/\/jobs\/\d/.test(a.getAttribute('href') || '')) continue;
        const row = a.closest('div')?.parentElement?.parentElement || a.parentElement;
        if (!row) continue;

        const rawText = a.textContent.trim();
        // extract title (before location/salary markers)
        const title = rawText
          .replace(/\s+/g, ' ')
          .split(/remote only|on-?site|hybrid|₹|\$\d|€|posted \d/i)[0]
          .replace(/\(?\s*remote\s*\)?$/i, '')
          .replace(/[\s\-–—|(,/]+$/g, '')
          .trim();

        const rowText = row.textContent || '';
        const company = (row.querySelector('img[alt*="logo" i]')?.alt || '')
          .replace(/company logo/i, '').trim();
        const salary = (rowText.match(/(?:₹|\$|€)\s?[\d.,k]+(?:\s?[–-]\s?(?:₹|\$|€)?\s?[\d.,k]+)?(?:\s?L(?:PA)?|\s?k)?/i) || [''])[0].trim();
        const link = 'https://wellfound.com' + a.getAttribute('href');

        // check if already applied
        const applied = [...row.querySelectorAll('button, span')].some(e => /^applied$/i.test(e.textContent.trim()));

        if (title && !applied) {
          results.push({ title, company, salary, experience: '', location: '', link, tags: [], posted: '', source: 'wellfound' });
        }
      }
      return results;
    });

    log(`Found ${pageJobs.length} jobs`);
    jobs.push(...pageJobs);
  } catch (e) {
    log(`Browser error: ${e.message}`);
  } finally {
    if (ctx) await ctx.close().catch(() => {});
  }

  // deduplicate by link
  const seen = new Set();
  return jobs.filter(j => {
    if (seen.has(j.link)) return false;
    seen.add(j.link);
    return true;
  });
}

module.exports = { scrapeWellfound };
