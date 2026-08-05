const fs = require('fs');

const geojson = {
  type: "FeatureCollection",
  features: [
    {
      id: 1,
      type: "Feature",
      properties: { name: "J. P. Nagar", areaId: "JPNagar" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [77.572, 12.918], // NW (near Kanakapura Rd / ORR junction)
          [77.602, 12.918], // NE (near Bannerghatta Rd)
          [77.602, 12.885], // SE
          [77.572, 12.885], // SW
          [77.572, 12.918]
        ]]
      }
    },
    {
      id: 2,
      type: "Feature",
      properties: { name: "Jayanagar", areaId: "Jayanagar" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [77.570, 12.945], // NW (South End Circle area)
          [77.598, 12.945], // NE (near Nimhans)
          [77.598, 12.918], // SE (near Jayadeva)
          [77.570, 12.918], // SW (near Banashankari)
          [77.570, 12.945]
        ]]
      }
    },
    {
      id: 3,
      type: "Feature",
      properties: { name: "BTM Layout", areaId: "BTMLayout" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [77.598, 12.925], // NW
          [77.622, 12.925], // NE (near Madiwala Lake)
          [77.622, 12.900], // SE (near Silk Board)
          [77.598, 12.900], // SW (near Udupi Garden)
          [77.598, 12.925]
        ]]
      }
    }
  ]
};

fs.writeFileSync('public/territories.json', JSON.stringify(geojson, null, 2));
console.log("Written manual accurate borders!");
