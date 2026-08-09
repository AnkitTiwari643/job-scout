/**
 * Job matcher — filters and ranks scraped jobs against your profile.
 */
const config = require('./config');

function matchJob(job) {
  const titleLower = job.title.toLowerCase();
  const companyLower = (job.company || '').toLowerCase();
  const locationLower = (job.location || '').toLowerCase();
  const allText = `${titleLower} ${companyLower} ${(job.tags || []).join(' ').toLowerCase()}`;

  // 1. Title must match at least one keyword
  const keywordMatch = config.roleKeywords.some(k => titleLower.includes(k));
  if (!keywordMatch) return { match: false, reason: 'no keyword match' };

  // 2. Title must NOT match any blocklist word
  const blocked = config.roleBlocklist.find(k => titleLower.includes(k));
  if (blocked) return { match: false, reason: `blocked: "${blocked}"` };

  // 3. Company classification
  const isProductCompany = config.productCompanies.some(k => companyLower.includes(k));
  const isServiceCompany = config.serviceCompanies.some(k => companyLower.includes(k));

  // Reject service/consulting companies
  if (isServiceCompany) return { match: false, reason: `service company: ${job.company}` };

  // 4. Skills match
  const skillsMatched = config.skills.filter(s => allText.includes(s.toLowerCase()));

  // 5. Score
  let score = 50;
  if (isProductCompany) score += 30;
  score += skillsMatched.length * 3;

  // Location bonus
  const locationMatch = config.locations.some(l => locationLower.includes(l));
  if (locationMatch) score += 10;

  // Salary parsing and filtering
  const salaryInfo = parseSalary(job.salary);
  if (salaryInfo.maxLPA && salaryInfo.maxLPA < config.minCTC * 0.6) {
    return { match: false, reason: `salary too low: ${job.salary}` };
  }
  if (salaryInfo.minLPA && salaryInfo.minLPA >= config.minCTC) score += 10;

  return {
    match: true,
    score,
    isProductCompany,
    skillsMatched,
    salaryInfo,
    locationMatch,
  };
}

function parseSalary(salary) {
  if (!salary) return {};
  const nums = salary.match(/[\d.]+/g);
  if (!nums) return {};

  let values = nums.map(Number);

  if (/lpa|lakh|lac|l\b/i.test(salary)) {
    return { minLPA: values[0], maxLPA: values[values.length - 1] };
  }
  if (/cr/i.test(salary)) {
    return { minLPA: values[0] * 100, maxLPA: values[values.length - 1] * 100 };
  }
  // USD: $100k-$150k -> roughly 83L-124L
  if (/\$|usd/i.test(salary) && values.some(v => v > 100)) {
    return { minLPA: values[0] * 83 / 1000, maxLPA: values[values.length - 1] * 83 / 1000 };
  }
  if (/\$|usd/i.test(salary) && /k\b/i.test(salary)) {
    return { minLPA: values[0] * 83 / 100, maxLPA: values[values.length - 1] * 83 / 100 };
  }

  return {};
}

function filterAndRankJobs(jobs) {
  const matched = [];

  for (const job of jobs) {
    const result = matchJob(job);
    if (result.match) {
      matched.push({ ...job, ...result });
    }
  }

  // Sort: product companies first, then by score
  matched.sort((a, b) => {
    if (a.isProductCompany && !b.isProductCompany) return -1;
    if (!a.isProductCompany && b.isProductCompany) return 1;
    return b.score - a.score;
  });

  return matched;
}

module.exports = { filterAndRankJobs, matchJob };
