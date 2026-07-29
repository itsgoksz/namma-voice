const fs = require('fs');
fetch("https://api.maptiler.com/maps/dataviz-dark/style.json?key=QLcOnigXjW4afnIzpXBK")
  .then(res => res.json())
  .then(style => {
    style.layers = style.layers.map((layer) => {
      if (layer.id.toLowerCase().includes('road') && layer.type === 'line') {
        layer.paint['line-color'] = '#d4af37';
        if (layer.paint['line-opacity']) layer.paint['line-opacity'] = 1;
      }
      return layer;
    });
    console.log("Success");
  })
  .catch(e => console.error("Error:", e));
