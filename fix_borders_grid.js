const fs = require('fs');

const L0 = 77.560;
const L1 = 77.583;
const L2 = 77.606;
const L3 = 77.630;

const T0 = 12.950;
const T1 = 12.927;
const T2 = 12.903;
const T3 = 12.880;

function makePoly(w, n, e, s) {
  return [
    [w, n],
    [e, n],
    [e, s],
    [w, s],
    [w, n]
  ];
}

const geojson = {
  type: "FeatureCollection",
  features: [
    {
      id: 1, type: "Feature",
      properties: { name: "Basavanagudi", areaId: "Basavanagudi" },
      geometry: { type: "Polygon", coordinates: [makePoly(L0, T0, L1, T1)] }
    },
    {
      id: 2, type: "Feature",
      properties: { name: "Jayanagar", areaId: "Jayanagar" },
      geometry: { type: "Polygon", coordinates: [makePoly(L1, T0, L2, T1)] }
    },
    {
      id: 3, type: "Feature",
      properties: { name: "Koramangala", areaId: "Koramangala" },
      geometry: { type: "Polygon", coordinates: [makePoly(L2, T0, L3, T1)] }
    },
    {
      id: 4, type: "Feature",
      properties: { name: "Banashankari", areaId: "Banashankari" },
      geometry: { type: "Polygon", coordinates: [makePoly(L0, T1, L1, T2)] }
    },
    {
      id: 5, type: "Feature",
      properties: { name: "J. P. Nagar", areaId: "JPNagar" },
      geometry: { type: "Polygon", coordinates: [makePoly(L1, T1, L2, T2)] }
    },
    {
      id: 6, type: "Feature",
      properties: { name: "BTM Layout", areaId: "BTMLayout" },
      geometry: { type: "Polygon", coordinates: [makePoly(L2, T1, L3, T2)] }
    },
    {
      id: 7, type: "Feature",
      properties: { name: "Kumaraswamy Layout", areaId: "KumaraswamyLayout" },
      geometry: { type: "Polygon", coordinates: [makePoly(L0, T2, L1, T3)] }
    },
    {
      id: 8, type: "Feature",
      properties: { name: "RBI Layout", areaId: "RBILayout" },
      geometry: { type: "Polygon", coordinates: [makePoly(L1, T2, L2, T3)] }
    },
    {
      id: 9, type: "Feature",
      properties: { name: "Bilekahalli", areaId: "Bilekahalli" },
      geometry: { type: "Polygon", coordinates: [makePoly(L2, T2, L3, T3)] }
    }
  ]
};

fs.writeFileSync('public/territories.json', JSON.stringify(geojson, null, 2));
console.log("Written perfectly tiled boundaries covering the entire map bounds!");
