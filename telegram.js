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
  // rate limit: max 30 messages/second for Telegram
  await new Promise(r => setTimeout(r, 200));
}

async function sendJobAlert(job) {
  const badge = job.isProductCompany ? ' ⭐' : '';
  const skills = job.skillsMatched?.length ? `\n🛠 ${job.skillsMatched.join(', ')}` : '';
  const salary = job.salary ? `\n💰 ${esc(job.salary)}` : '';
  const loc = job.location ? `\n📍 ${esc(job.location)}` : '';

  const msg =
    `💼 <b>${esc(job.title)}</b>${badge}\n` +
    `🏢 ${esc(job.company || 'Unknown')}` +
    salary + loc + skills + '\n' +
    `🔗 <a href="${job.link}">Apply</a> | ${job.source}`;

  await sendMessage(msg);
}

async function sendBatchAlert(jobs) {
  // Send jobs in batches of 5 per message to reduce spam
  const batches = [];
  for (let i = 0; i < jobs.length; i += 5) {
    batches.push(jobs.slice(i, i + 5));
  }

  for (const batch of batches) {
    const lines = batch.map((job, idx) => {
      const badge = job.isProductCompany ? ' ⭐' : '';
      const salary = job.salary ? ` | 💰 ${esc(job.salary)}` : '';
      return `${idx + 1}. <b>${esc(job.title)}</b>${badge}\n` +
        `   🏢 ${esc(job.company || '?')}${salary}\n` +
        `   🔗 <a href="${job.link}">Apply</a> [${job.source}]`;
    });

    await sendMessage(lines.join('\n\n'));
  }
}

async function sendSummary(totalScraped, matched, newJobs) {
  await sendMessage(
    `📋 <b>Job Scout Report</b>\n\n` +
    `🔍 Scraped: ${totalScraped} jobs\n` +
    `✅ Matched profile: ${matched}\n` +
    `🆕 New jobs sent: ${newJobs}\n` +
    `⭐ = Product company\n` +
    `🕐 ${new Date().toLocaleString()}`
  );
}

function esc(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

module.exports = { sendMessage, sendJobAlert, sendBatchAlert, sendSummary };
