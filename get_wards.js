const https = require('https');
const fs = require('fs');

const areas = ["J. P. Nagar, Bengaluru", "Jayanagar, Bengaluru", "BTM Layout, Bengaluru"];
const geojson = { type: "FeatureCollection", features: [] };

async function fetchArea(query) {
  return new Promise((resolve) => {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=geojson&polygon_geojson=1`;
    https.get(url, { headers: { 'User-Agent': 'NammaHoodApp/1.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.features && result.features.length > 0) {
            // Find a polygon feature if possible
            const poly = result.features.find(f => f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon');
            resolve(poly || result.features[0]);
          } else {
            resolve(null);
          }
        } catch(e) { resolve(null); }
      });
    });
  });
}

(async () => {
  for (const area of areas) {
    console.log("Fetching", area);
    const feature = await fetchArea(area);
    if (feature) {
      feature.properties = { name: area.split(',')[0], areaId: area.replace(/\s+/g, '').split(',')[0] };
      geojson.features.push(feature);
    }
  }
  fs.writeFileSync('public/territories.json', JSON.stringify(geojson, null, 2));
  console.log("Saved to public/territories.json");
})();
