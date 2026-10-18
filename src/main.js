// Simple D3-based world map that loads GeoJSON and allows selecting countries
const width = 1000;
const height = 600;

const svg = d3.select('#map')
  .append('svg')
  .attr('viewBox', `0 0 ${width} ${height}`)
  .attr('preserveAspectRatio', 'xMidYMid meet');

const projection = d3.geoMercator()
  .scale(160)
  .translate([width / 2, height / 1.5]);

const path = d3.geoPath().projection(projection);
const g = svg.append('g');

const info = d3.select('#info');

// Fetch a GeoJSON of countries (public CDN/raw GitHub). This is large but works for a demo.
const GEOJSON_URL = 'https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson';

fetch(GEOJSON_URL)
  .then(res => res.json())
  .then(world => {
    g.selectAll('path')
      .data(world.features)
      .enter()
      .append('path')
      .attr('class', 'country')
      .attr('d', path)
      .on('click', function(event, d) {
        // clear previous selection
        g.selectAll('.country').classed('selected', false);
        d3.select(this).classed('selected', true);
        const name = d.properties.ADMIN || d.properties.NAME || d.id;
        info.text(`Selected: ${name}`);
      })
      .on('mouseenter', function() { d3.select(this).raise(); })
      .on('mouseleave', function() { /* no-op */ });

    // Zoom / fit: optional (keeps initial scale)
  })
  .catch(err => {
    console.error('Failed to load GeoJSON:', err);
    info.text('Failed to load map data. Check console for details.');
  });
