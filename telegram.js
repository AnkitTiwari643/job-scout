/**
 * Telegram notifier — sends matched jobs to your phone.
 */
const config = require('./config');

const log = (msg) => console.log(`[${new Date().toLocaleTimeString()}] [telegram] ${msg}`);

async function sendMessage(text) {
  if (!config.telegram.botToken || !config.telegram.chatId) {
    log('Not configured — skipping');
    return;
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${config.telegram.botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: config.telegram.chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) log('Send failed: ' + (await res.text()).slice(0, 200));
  } catch (e) {
    log('Error: ' + e.message);
  }
  await new Promise(r => setTimeout(r, 200));
}

function formatJob(job, idx) {
  const badge = job.isProductCompany ? ' ⭐' : '';
  const skills = job.skillsMatched?.length ? `\n   🛠 ${job.skillsMatched.join(', ')}` : '';
  const salary = job.salary ? `\n   💰 ${esc(job.salary)}` : '';
  const loc = job.location ? ` | 📍 ${esc(job.location)}` : '';
  const posted = job.posted ? `\n   🕐 ${formatDate(job.posted)}` : '';

  return `${idx}. <b>${esc(job.title)}</b>${badge}\n` +
    `   🏢 ${esc(job.company || '?')}${loc}` +
    salary + skills + posted + '\n' +
    `   🔗 <a href="${job.link}">Apply</a> [${job.source}]`;
}

async function sendBatchAlert(jobs) {
  // Send in batches of 5 per message
  const batches = [];
  for (let i = 0; i < jobs.length; i += 5) {
    batches.push(jobs.slice(i, i + 5));
  }

  let count = 0;
  for (const batch of batches) {
    const lines = batch.map((job) => {
      count++;
      return formatJob(job, count);
    });
    await sendMessage(lines.join('\n\n'));
  }
}

async function sendSummary(totalScraped, matched, newJobs) {
  await sendMessage(
    `📋 <b>Job Scout Report</b>\n\n` +
    `🔍 Scraped: ${totalScraped} jobs (last 24h only)\n` +
    `✅ Matched profile: ${matched}\n` +
    `🆕 New jobs sent: ${newJobs}\n` +
    `⭐ = Product company | 💰 = Salary shown\n` +
    `🕐 ${new Date().toLocaleString()}\n\n` +
    `💼 Target: ${config.minCTC}-${config.maxCTC} LPA | DevOps/SRE/Cloud`
  );
}

function formatDate(d) {
  if (!d) return '';
  const date = new Date(typeof d === 'number' ? d * 1000 : d);
  if (isNaN(date.getTime())) return '';
  const now = Date.now();
  const diff = now - date.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function esc(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

module.exports = { sendMessage, sendBatchAlert, sendSummary };
