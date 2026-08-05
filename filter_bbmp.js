const fs = require('fs');
const turf = require('@turf/helpers');
const { booleanIntersects } = require('@turf/boolean-intersects');
const { bboxPolygon } = require('@turf/bbox-polygon');

const bbmp = JSON.parse(fs.readFileSync('bbmp.geojson', 'utf8'));
const mapBounds = bboxPolygon([77.560, 12.880, 77.630, 12.950]);

const filteredFeatures = bbmp.features.filter(f => {
  if (!f.geometry) return false;
  try {
    return booleanIntersects(f, mapBounds);
  } catch (e) {
    return false;
  }
});

const formattedFeatures = filteredFeatures.map((f, i) => {
  const name = f.properties.KGISWardName || `Ward ${f.properties.KGISWardNo}`;
  return {
    id: i + 1,
    type: "Feature",
    properties: {
      name: name,
      areaId: name.replace(/[^a-zA-Z0-9]/g, ''),
      wardNo: f.properties.KGISWardNo || ''
    },
    geometry: f.geometry
  };
});

const outGeojson = {
  type: "FeatureCollection",
  features: formattedFeatures
};

fs.writeFileSync('public/territories.json', JSON.stringify(outGeojson, null, 2));
console.log(`Filtered from ${bbmp.features.length} to ${formattedFeatures.length} wards!`);
