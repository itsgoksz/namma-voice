const https = require('https');
const fs = require('fs');
const osmtogeojson = require('osmtogeojson');

// Query for relations and ways that represent suburbs or neighbourhoods in Bangalore South
const query = `
[out:json][timeout:25];
(
  way["place"~"suburb|neighbourhood"](12.85,77.53,12.95,77.65);
  relation["place"~"suburb|neighbourhood"](12.85,77.53,12.95,77.65);
);
out body;
>;
out skel qt;
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
      const osmData = JSON.parse(data);
      const geojson = osmtogeojson(osmData);
      
      // Filter out points, only keep polygons
      const polygons = geojson.features.filter(f => 
        f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon'
      );
      
      // Map them to the format we need
      const formattedPolygons = polygons.map((f, i) => {
        let name = f.properties.name || f.properties['name:en'] || 'Unknown Area';
        return {
          id: i + 1,
          type: "Feature",
          properties: {
            name: name,
            areaId: name.replace(/[^a-zA-Z]/g, '')
          },
          geometry: f.geometry
        };
      }).filter(f => f.properties.name !== 'Unknown Area');
      
      const finalGeojson = {
        type: "FeatureCollection",
        features: formattedPolygons
      };
      
      fs.writeFileSync('public/territories.json', JSON.stringify(finalGeojson, null, 2));
      console.log(`Saved ${formattedPolygons.length} accurate OSM territories to public/territories.json!`);
    } catch(e) { console.error(e); }
  });
});

req.write('data=' + encodeURIComponent(query));
req.end();
