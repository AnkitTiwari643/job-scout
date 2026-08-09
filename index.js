/**
 * Job Scout — scrapes DevOps jobs, matches with your profile, sends to Telegram.
 * No browser needed. Runs every 2 hours via cron.
 *
 * Usage:
 *   node index.js              full run (scrape + match + send)
 *   node index.js --dry-run    scrape + match, print results, don't send Telegram
 */
const fs = require('fs');
const path = require('path');

const { scrapeLinkedIn } = require('./scrapers/linkedin');
const { scrapeRemotive } = require('./scrapers/remotive');
const { scrapeArbeitnow } = require('./scrapers/arbeitnow');
const { filterAndRankJobs } = require('./matcher');
const { sendBatchAlert, sendSummary, sendMessage } = require('./telegram');
const config = require('./config');

const DRY_RUN = process.argv.includes('--dry-run');
const SEEN_FILE = path.join(__dirname, 'seen-jobs.json');
const LOG_FILE = path.join(__dirname, 'scout.log');

const log = (msg) => {
  const line = `[${new Date().toLocaleString()}] ${msg}`;
  console.log(line);
  try { fs.appendFileSync(LOG_FILE, line + '\n'); } catch (e) {}
};

// Track seen jobs so we don't send duplicates
function loadSeen() {
  try {
    const data = JSON.parse(fs.readFileSync(SEEN_FILE, 'utf8'));
    // Clean entries older than 14 days
    const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
    const cleaned = {};
    for (const [k, v] of Object.entries(data)) {
      if (v > cutoff) cleaned[k] = v;
    }
    return cleaned;
  } catch (e) {
    return {};
  }
}

function saveSeen(seen) {
  try { fs.writeFileSync(SEEN_FILE, JSON.stringify(seen, null, 2)); } catch (e) {}
}

function jobKey(job) {
  // Primary key: normalized URL
  return (job.link || '').split('?')[0].toLowerCase().replace(/\/$/, '');
}

function jobTitleKey(job) {
  // Secondary key: company + title (catches same job posted with different URLs or across sources)
  const company = (job.company || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const title = (job.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return `${company}::${title}`;
}

(async () => {
  log('=== Job Scout starting ===');
  log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);

  // 1. Scrape all sources in parallel
  log('Scraping jobs from all sources...');
  const searchKw = config.searchKeywords;
  const shortKw = ['devops', 'sre', 'platform engineer', 'cloud engineer'];

  const [linkedInJobs, remotiveJobs, arbeitnowJobs] = await Promise.all([
    scrapeLinkedIn(searchKw, ['India']).catch(e => { log('LinkedIn error: ' + e.message); return []; }),
    scrapeRemotive(shortKw).catch(e => { log('Remotive error: ' + e.message); return []; }),
    scrapeArbeitnow(shortKw).catch(e => { log('Arbeitnow error: ' + e.message); return []; }),
  ]);

  const allJobs = [...linkedInJobs, ...remotiveJobs, ...arbeitnowJobs];
  log(`Total scraped: ${allJobs.length} (LinkedIn: ${linkedInJobs.length}, Remotive: ${remotiveJobs.length}, Arbeitnow: ${arbeitnowJobs.length})`);

  // 2. Match against profile
  const matched = filterAndRankJobs(allJobs);
  log(`Matched profile: ${matched.length} jobs`);

  // 3. Filter out already-seen jobs (by URL and by company+title)
  const seen = loadSeen();
  const seenTitles = new Set();
  // Build title keys from already-seen URLs isn't possible, so we track within this run too
  const newJobs = matched.filter(j => {
    const urlKey = jobKey(j);
    const tKey = jobTitleKey(j);
    // Skip if URL already seen in previous runs
    if (seen[urlKey]) return false;
    // Skip if same company+title already seen in previous runs (different URL, same job)
    if (seen[tKey]) return false;
    // Skip if same company+title already in this batch (duplicate within one scrape)
    if (seenTitles.has(tKey)) return false;
    seenTitles.add(tKey);
    return true;
  });
  log(`New (unseen): ${newJobs.length} jobs`);

  // 4. Print results
  if (newJobs.length > 0) {
    log('\n--- Matched Jobs ---');
    for (const job of newJobs) {
      const badge = job.isProductCompany ? ' ⭐ PRODUCT' : '';
      const skills = job.skillsMatched?.length ? ` [${job.skillsMatched.join(', ')}]` : '';
      log(`  ${job.title} @ ${job.company}${badge}${skills} (${job.source})`);
      log(`    ${job.link}`);
    }
    log('---\n');
  }

  // 5. Send to Telegram
  if (!DRY_RUN && newJobs.length > 0) {
    log('Sending to Telegram...');
    await sendBatchAlert(newJobs);
    await sendSummary(allJobs.length, matched.length, newJobs.length);

    // Mark as seen (both URL and company+title keys)
    for (const job of newJobs) {
      seen[jobKey(job)] = Date.now();
      seen[jobTitleKey(job)] = Date.now();
    }
    saveSeen(seen);
    log('Done. Jobs marked as seen.');
  } else if (!DRY_RUN && newJobs.length === 0) {
    log('No new jobs found this run.');
  } else {
    log('DRY RUN — not sending to Telegram.');
    // still mark as seen for dry run so next real run doesn't re-send
  }

  log(`=== Job Scout finished ===\n`);
})().catch(e => {
  log('FATAL: ' + e.message);
  sendMessage(`❌ <b>Job Scout Error</b>\n${e.message}`).catch(() => {});
  process.exit(1);
});
