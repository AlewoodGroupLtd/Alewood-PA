const https = require('https');

const token = process.env.GOOGLE_OAUTH_TOKEN || "YOUR_TOKEN_HERE";
const projectId = "343832934198";
const location = "europe-west2";
const model = "gemini-1.5-flash-002";
// const model = "gemini-pro";

const data = JSON.stringify({
  contents: [{ role: "user", parts: [{ text: "Hello" }] }]
});

const options = {
  hostname: `${location}-aiplatform.googleapis.com`,
  port: 443,
  path: `/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:streamGenerateContent`,
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = https.request(options, res => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    console.log(`Status: ${res.statusCode}`);
    console.log(`Body: ${body}`);
  });
});

req.on('error', e => console.error(e));
req.write(data);
req.end();
