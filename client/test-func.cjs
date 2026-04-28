const https = require('https');

const data = JSON.stringify({
  data: {
    subject: "Test",
    sender: "test@example.com"
  }
});

const options = {
  hostname: 'europe-west2-alewood-uk-trinity.cloudfunctions.net',
  path: '/generateDraft',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', (d) => body += d);
  res.on('end', () => console.log('Response:', body));
});

req.on('error', (error) => console.error(error));
req.write(data);
req.end();
