const https = require('https');

const query = `
[out:json];
(
  relation["name"~"Jayanagar|J P Nagar|BTM Layout",i](12.8,77.5,13.1,77.7);
  way["name"~"Jayanagar|J P Nagar|BTM Layout",i]["place"~"suburb|neighbourhood"](12.8,77.5,13.1,77.7);
);
out geom;
`;

const req = https.request({
  hostname: 'overpass-api.de',
  path: '/api/interpreter',
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'User-Agent': 'NammaHoodApp/1.0'
  }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const result = JSON.parse(data);
      console.log(`Found ${result.elements.length} elements.`);
      result.elements.forEach(e => {
        console.log(e.type, e.id, e.tags.name);
      });
    } catch(e) { console.error(e); }
  });
});

req.write('data=' + encodeURIComponent(query));
req.end();
