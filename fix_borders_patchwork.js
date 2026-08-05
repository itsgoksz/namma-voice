const fs = require('fs');

// Create a puzzle of non-overlapping polygons for South Bengaluru

const pJayanagar = [
  [77.570, 12.940], // NW
  [77.595, 12.940], // NE
  [77.595, 12.915], // SE
  [77.570, 12.915], // SW
  [77.570, 12.940]
];

const pJPNagar = [
  [77.570, 12.915], // NW (touches Jayanagar)
  [77.595, 12.915], // NE (touches Jayanagar)
  [77.595, 12.895], // SE
  [77.570, 12.895], // SW
  [77.570, 12.915]
];

const pRBILayout = [
  [77.570, 12.895], // NW (touches JP Nagar SW)
  [77.585, 12.895], // NE (touches JP Nagar S)
  [77.585, 12.885], // SE
  [77.570, 12.885], // SW
  [77.570, 12.895]
];

const pBilekahalli = [
  [77.595, 12.915], // NW (touches Jayanagar SE)
  [77.605, 12.915], // NE 
  [77.605, 12.895], // SE
  [77.595, 12.895], // SW (touches JP Nagar SE)
  [77.595, 12.915]
];

const pBTMLayout = [
  [77.605, 12.925], // NW
  [77.620, 12.925], // NE
  [77.620, 12.905], // SE
  [77.605, 12.905], // SW (touches Bilekahalli SE)
  [77.605, 12.925]
];

const geojson = {
  type: "FeatureCollection",
  features: [
    {
      id: 1,
      type: "Feature",
      properties: { name: "Jayanagar", areaId: "Jayanagar" },
      geometry: { type: "Polygon", coordinates: [pJayanagar] }
    },
    {
      id: 2,
      type: "Feature",
      properties: { name: "J. P. Nagar", areaId: "JPNagar" },
      geometry: { type: "Polygon", coordinates: [pJPNagar] }
    },
    {
      id: 3,
      type: "Feature",
      properties: { name: "RBI Layout", areaId: "RBILayout" },
      geometry: { type: "Polygon", coordinates: [pRBILayout] }
    },
    {
      id: 4,
      type: "Feature",
      properties: { name: "Bilekahalli", areaId: "Bilekahalli" },
      geometry: { type: "Polygon", coordinates: [pBilekahalli] }
    },
    {
      id: 5,
      type: "Feature",
      properties: { name: "BTM Layout", areaId: "BTMLayout" },
      geometry: { type: "Polygon", coordinates: [pBTMLayout] }
    }
  ]
};

fs.writeFileSync('public/territories.json', JSON.stringify(geojson, null, 2));
console.log("Written patchwork borders!");
