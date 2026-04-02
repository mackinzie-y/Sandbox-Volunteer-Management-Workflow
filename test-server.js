const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/health',
  method: 'GET'
};

console.log('Checking RiseUp PH server health...');

const req = http.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log(`Status code: ${res.statusCode}`);
    console.log(`Response: ${data}`);
  });
});

req.on('error', (error) => {
  console.error('Health check failed:', error.message);
});

req.end();
