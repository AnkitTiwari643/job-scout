/**
 * Naukri job scraper — scrapes job listings from Naukri search pages using Playwright.
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

const log = (msg) => console.log(`[${new Date().toLocaleTimeString()}] [naukri] ${msg}`);

async function scrapeNaukri(searchUrls) {
  const jobs = [];
  let ctx;

  try {
    ctx = await chromium.launchPersistentContext(path.join(__dirname, '..', '.naukri-chrome-profile'), {
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

    for (const url of searchUrls) {
      log(`Scraping: ${url}`);
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(3000);

        const pageJobs = await page.evaluate(() => {
          const results = [];
          // Naukri job cards
          const cards = document.querySelectorAll('.srp-jobtuple-wrapper, .cust-job-tuple, article.jobTuple');

          for (const card of cards) {
            try {
              const titleEl = card.querySelector('.title, a.title, .row1 a, .info h2 a');
              const companyEl = card.querySelector('.comp-name, .subTitle a, .row2 .comp-dtls-header a, .info .comp-name');
              const salaryEl = card.querySelector('.sal-wrap .ni-job-tuple-icon-srp-rupee, .salary, .row3 .sal, .info .salary');
              const expEl = card.querySelector('.exp-wrap .ni-job-tuple-icon-srp-briefcase, .experience, .row3 .exp, .info .experience');
              const locationEl = card.querySelector('.loc-wrap .ni-job-tuple-icon-srp-location, .location, .row3 .loc, .info .location');
              const linkEl = card.querySelector('a.title, a[href*="job-listings"], .row1 a, .info h2 a');
              const tagsEls = card.querySelectorAll('.tag-li, .tags-gt li, .key-skill span');
              const postedEl = card.querySelector('.job-post-day, .posting-date, .row5 .posted');

              const title = titleEl?.textContent?.trim() || '';
              const company = companyEl?.textContent?.trim() || '';
              const salary = salaryEl?.closest('.sal-wrap, .salary')?.textContent?.trim() || salaryEl?.textContent?.trim() || '';
              const experience = expEl?.closest('.exp-wrap, .experience')?.textContent?.trim() || expEl?.textContent?.trim() || '';
              const location = locationEl?.closest('.loc-wrap, .location')?.textContent?.trim() || locationEl?.textContent?.trim() || '';
              const link = linkEl?.href || '';
              const tags = [...tagsEls].map(t => t.textContent.trim()).filter(Boolean);
              const posted = postedEl?.textContent?.trim() || '';

              if (title && link) {
                results.push({ title, company, salary, experience, location, link, tags, posted, source: 'naukri' });
              }
            } catch (e) { /* skip bad card */ }
          }
          return results;
        });

        log(`  Found ${pageJobs.length} jobs`);
        jobs.push(...pageJobs);
      } catch (e) {
        log(`  Error scraping ${url}: ${e.message}`);
      }

      // small delay between pages
      await page.waitForTimeout(2000);
    }
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

module.exports = { scrapeNaukri };
