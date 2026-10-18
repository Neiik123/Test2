// Improved D3 world map: fits the world to view, shows hover/selected names
const width = 1000;
const height = 600;

const svg = d3.select('#map')
  .append('svg')
  .attr('viewBox', `0 0 ${width} ${height}`)
  .attr('preserveAspectRatio', 'xMidYMid meet');

const projection = d3.geoMercator(); // we'll fitSize after loading
const path = d3.geoPath().projection(projection);
const g = svg.append('g');

const info = d3.select('#info');
info.text('Loading map...').classed('loading', true);

// GeoJSON source (countries). If this fails, check network/CORS.
const GEOJSON_URL = 'https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson';

fetch(GEOJSON_URL)
  .then(res => {
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  })
  .then(world => {
    // Fit projection to our svg size so the map fills the visible area
    try{
      projection.fitSize([width, height], world);
    } catch(e){
      console.warn('fitSize failed, continuing with default projection', e);
    }

    // Draw countries
    const countries = g.selectAll('path')
      .data(world.features)
      .enter()
      .append('path')
      .attr('class', 'country')
      .attr('d', path)
      .on('click', function(event, d) {
        // clear previous selection
        g.selectAll('.country').classed('selected', false);
        d3.select(this).classed('selected', true);
        const name = d.properties.ADMIN || d.properties.NAME || d.id || 'Unknown';
        info.text(`Selected: ${name}`).classed('loading', false);
      })
      .on('mouseenter', function(event, d) {
        d3.select(this).raise();
        const name = d.properties.ADMIN || d.properties.NAME || d.id || 'Unknown';
        info.text(`Hover: ${name}`);
      })
      .on('mouseleave', function() {
        // restore info text unless a country is selected
        const selected = g.selectAll('.country.selected').data();
        if(selected && selected.length > 0){
          const name = selected[0].properties?.ADMIN || selected[0].properties?.NAME || 'Selected';
          info.text(`Selected: ${name}`);
        } else {
          info.text('Click a country to select it.').classed('loading', false);
        }
      });

    info.text('Click a country to select it.').classed('loading', false);

    // Optional: add subtle zoom/pan behavior
    const zoom = d3.zoom()
      .scaleExtent([1, 8])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);
  })
  .catch(err => {
    console.error('Failed to load GeoJSON:', err);
    info.text('Failed to load map data. Check console for details.');
  });
