const https = require('https');
const fs = require('fs');
const turf = require('@turf/helpers');
const { convex } = require('@turf/convex');

// We can just use Nominatim to search for multiple phases and union their points to create a convex hull.
async function fetchCoords(query) {
  return new Promise((resolve) => {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=10`;
    https.get(url, { headers: { 'User-Agent': 'NammaHoodApp/1.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve(result.map(r => [parseFloat(r.lon), parseFloat(r.lat)]));
        } catch(e) { resolve([]); }
      });
    });
  });
}

(async () => {
  const geojson = { type: "FeatureCollection", features: [] };
  
  const regions = [
    {
      name: "J. P. Nagar",
      queries: ["JP Nagar Phase 1, Bengaluru", "JP Nagar Phase 2, Bengaluru", "JP Nagar Phase 3, Bengaluru", "JP Nagar Phase 4, Bengaluru", "JP Nagar Phase 5, Bengaluru", "JP Nagar Phase 6, Bengaluru", "JP Nagar Phase 7, Bengaluru", "JP Nagar Phase 8, Bengaluru", "JP Nagar Phase 9, Bengaluru"]
    },
    {
      name: "Jayanagar",
      queries: ["Jayanagar 1st Block, Bengaluru", "Jayanagar 2nd Block, Bengaluru", "Jayanagar 3rd Block, Bengaluru", "Jayanagar 4th Block, Bengaluru", "Jayanagar 5th Block, Bengaluru", "Jayanagar 6th Block, Bengaluru", "Jayanagar 7th Block, Bengaluru", "Jayanagar 8th Block, Bengaluru", "Jayanagar 9th Block, Bengaluru"]
    },
    {
      name: "BTM Layout",
      queries: ["BTM Layout 1st Stage, Bengaluru", "BTM Layout 2nd Stage, Bengaluru", "BTM Layout 3rd Stage, Bengaluru", "BTM Layout 4th Stage, Bengaluru", "BTM Layout 5th Stage, Bengaluru", "BTM Layout 6th Stage, Bengaluru"]
    }
  ];

  for (const region of regions) {
    console.log("Fetching for", region.name);
    let allPoints = [];
    for (const q of region.queries) {
      const pts = await fetchCoords(q);
      allPoints = allPoints.concat(pts);
      // sleep a bit to avoid rate limits
      await new Promise(r => setTimeout(r, 1000));
    }
    
    if (allPoints.length >= 3) {
      const ptsFeature = turf.featureCollection(allPoints.map(p => turf.point(p)));
      const hull = convex(ptsFeature);
      if (hull) {
        hull.properties = { name: region.name, areaId: region.name.replace(/[^a-zA-Z]/g, '') };
        geojson.features.push(hull);
      }
    }
  }
  
  fs.writeFileSync('public/territories.json', JSON.stringify(geojson, null, 2));
  console.log("Saved to public/territories.json");
})();
