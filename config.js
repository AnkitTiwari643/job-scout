const fs = require('fs');
const path = require('path');

function loadEnv(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, 'utf8').replace(/^\ufeff/, '').split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
}

const E = loadEnv(path.join(__dirname, '.env'));
const g = (k, d = '') => (E[k] != null && E[k] !== '' ? E[k] : (process.env[k] || d));

const config = {
  telegram: {
    botToken: g('TELEGRAM_BOT_TOKEN'),
    chatId: g('TELEGRAM_CHAT_ID'),
  },

  // Job title matching
  roleKeywords: g('ROLE_KEYWORDS').split(',').map(s => s.trim().toLowerCase()).filter(Boolean),
  roleBlocklist: g('ROLE_BLOCKLIST').split(',').map(s => s.trim().toLowerCase()).filter(Boolean),

  // Experience & salary
  minExperience: parseInt(g('MIN_EXPERIENCE', '2')),
  maxExperience: parseInt(g('MAX_EXPERIENCE', '5')),
  minCTC: parseInt(g('MIN_CTC', '20')),
  maxCTC: parseInt(g('MAX_CTC', '30')),

  // Your skills for scoring
  skills: g('SKILLS').split(',').map(s => s.trim()).filter(Boolean),

  // Location preference
  locations: g('LOCATIONS', 'india,bangalore,bengaluru,remote,worldwide').split(',').map(s => s.trim().toLowerCase()).filter(Boolean),

  // LinkedIn search keywords (each one becomes a separate API call)
  searchKeywords: g('SEARCH_KEYWORDS',
    'devops engineer,sre engineer,site reliability engineer,platform engineer,cloud engineer,infrastructure engineer,kubernetes engineer,devops'
  ).split(',').map(s => s.trim()).filter(Boolean),

  // Product-based companies (20-30 LPA range for DevOps in India)
  productCompanies: [
    // FAANG / big tech
    'google', 'microsoft', 'amazon', 'apple', 'meta', 'netflix', 'oracle', 'ibm', 'samsung',
    // US product companies with India offices
    'uber', 'airbnb', 'stripe', 'shopify', 'atlassian', 'github', 'gitlab', 'hashicorp',
    'datadog', 'elastic', 'confluent', 'mongodb', 'redis', 'cloudflare', 'twilio', 'okta',
    'pagerduty', 'splunk', 'dynatrace', 'new relic', 'grafana labs', 'snyk', 'jfrog',
    'salesforce', 'adobe', 'intuit', 'vmware', 'nutanix', 'commvault', 'rubrik',
    'cohesity', 'pure storage', 'veritas', 'dell', 'cisco', 'juniper', 'arista',
    'servicenow', 'workday', 'snowflake', 'databricks', 'palantir', 'crowdstrike',
    'palo alto', 'zscaler', 'fortinet', 'checkpoint', 'f5', 'akamai', 'fastly',
    'digitalocean', 'linode', 'rackspace', 'equinix', 'hpe', 'netapp',
    'linkedin', 'twitter', 'snap', 'pinterest', 'reddit', 'discord', 'spotify',
    'booking.com', 'expedia', 'agoda', 'trivago', 'wix', 'canva', 'figma',
    'notion', 'asana', 'monday.com', 'clickup', 'jira', 'miro', 'loom',
    'docusign', 'box', 'dropbox', 'zoom', 'slack', 'hubspot', 'zendesk',
    'sendgrid', 'twilio', 'segment', 'amplitude', 'mixpanel', 'braze',
    'sentry', 'launchdarkly', 'harness', 'codefresh', 'circleci', 'jetbrains',
    // Indian product companies (20-30 LPA range)
    'razorpay', 'zerodha', 'cred', 'meesho', 'swiggy', 'zomato', 'flipkart',
    'phonepe', 'groww', 'dream11', 'freshworks', 'zoho', 'postman', 'browserstack',
    'chargebee', 'clevertap', 'ola', 'paytm', 'myntra', 'nykaa', 'lenskart',
    'urban company', 'jupiter', 'slice', 'khatabook', 'smallcase', 'upstox',
    'delhivery', 'shiprocket', 'hasura', 'innovaccer', 'druva', 'icertis',
    'thoughtspot', 'whatfix', 'yellow.ai', 'leadsquared', 'wingify', 'browserstack',
    'juspay', 'simpl', 'uni cards', 'fi money', 'niyo', 'epifi', 'jar',
    'rapido', 'dunzo', 'bigbasket', 'blinkit', 'zepto', 'instamart',
    'vedantu', 'physicswallah', 'scaler', 'masai', 'newton school',
    'sharechat', 'moj', 'dailyhunt', 'verse innovation', 'glance', 'inmobi',
    'media.net', 'pubmatic', 'criteo', 'verloop', 'haptik', 'gupshup',
    'mindtickle', 'darwinbox', 'keka', 'greythr', 'sumhr', 'springworks',
    'toplyne', 'rocketlane', 'hevo data', 'atlan', 'clarisights', 'scribble data',
    'hasura', 'appsmith', 'tooljet', 'airbyte', 'signoz', 'devtron',
    // Global product companies hiring in India
    'thoughtworks', 'gojek', 'grab', 'shopee', 'lazada', 'sea group',
    'samsung', 'sony', 'siemens', 'bosch', 'continental', 'here technologies',
    'sap', 'sas', 'teradata', 'informatica', 'tibco', 'talend',
    'newrelic', 'appdynamics', 'sumologic', 'logz.io', 'coralogix',
    'kong', 'solo.io', 'ambassador', 'envoy', 'istio',
    'red hat', 'canonical', 'suse', 'rancher', 'mirantis',
    'weaveworks', 'gitpod', 'coder', 'env0', 'spacelift', 'pulumi',
    'doppler', 'vault', 'teleport', 'tailscale', 'wireguard',
    'moengage', 'webengage', 'netcore',
    'tekion', 'sprinklr', 'fractal', 'mu sigma', 'tiger analytics',
    'epam', 'globallogic', 'luxoft', 'endava',
    'bazaarvoice',  // your current company
  ],

  // Service/consulting companies to filter OUT
  serviceCompanies: [
    'tcs', 'infosys', 'wipro', 'hcl', 'cognizant', 'capgemini', 'accenture',
    'deloitte', 'ey', 'kpmg', 'pwc', 'tech mahindra', 'mindtree', 'mphasis',
    'ltimindtree', 'hexaware', 'niit', 'cyient', 'zensar', 'persistent',
    'coforge', 'birlasoft', 'l&t infotech', 'sonata', 'mastek',
    'staffing', 'consulting group', 'outsourcing', 'manpower', 'randstad',
    'adecco', 'kelly services', 'robert half', 'ntt data', 'atos',
    'dxc technology', 'unisys', 'cgi', 'sopra steria', 'virtusa',
  ],
};

module.exports = config;
