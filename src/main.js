// Advanced D3 world map: fullscreen, toolbar toggles for labels and flags, flag-map fill
const width = 1600;
const height = 900;

const svg = d3.select('#map')
  .append('svg')
  .attr('viewBox', `0 0 ${width} ${height}`)
  .attr('preserveAspectRatio', 'xMidYMid meet');

const projection = d3.geoMercator();
const path = d3.geoPath().projection(projection);
const g = svg.append('g');

const info = d3.select('#info');
info.text('Loading map...').classed('loading', true);

// Toolbar elements
const toolbar = d3.select('#toolbar');
const toggleLabels = document.getElementById('toggle-labels');
const toggleFlags = document.getElementById('toggle-flags');
const toggleFlagmap = document.getElementById('toggle-flagmap');

let worldFeatures = [];
let countryPaths;

// Color scale for non-flag map
const color = d3.scaleOrdinal(d3.schemeTableau10);

// GeoJSON source
const GEOJSON_URL = 'https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson';

// Add defs for patterns
const defs = svg.append('defs');

fetch(GEOJSON_URL)
  .then(res => {
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  })
  .then(world => {
    worldFeatures = world.features;
    projection.fitSize([width, height], world);

    // Draw countries
    countryPaths = g.selectAll('path')
      .data(worldFeatures)
      .enter()
      .append('path')
      .attr('class', 'country')
      .attr('d', path)
      .attr('fill', (d,i)=> color(i))
      .on('click', function(event, d) {
        // clear previous selection
        g.selectAll('.country').classed('selected', false);
        d3.select(this).classed('selected', true);
        const name = d.properties.ADMIN || d.properties.NAME || d.id || 'Unknown';
        info.text(`Selected: ${name}`).classed('loading', false);
        updateLabelsAndFlags();
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

    // Create containers for labels and flags
    g.append('g').attr('class','labels');
    g.append('g').attr('class','flags');

    info.text('Click a country to select it.').classed('loading', false);

    // Create patterns for each country (lazy: only when needed)

    // Setup zoom
    const zoom = d3.zoom()
      .scaleExtent([1, 10])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
        // update labels/flags positions/sizes on zoom
        updateLabelsAndFlags();
      });

    svg.call(zoom);

    // initial render of labels/flags (off by default)
    updateLabelsAndFlags();
  })
  .catch(err => {
    console.error('Failed to load GeoJSON:', err);
    info.text('Failed to load map data. Check console for details.');
  });

// Utility: get ISO A2 code
function getIsoA2(d){
  return (d.properties && (d.properties.ISO_A2 || d.properties.iso_a2 || d.properties.ISO2 || d.properties.ISO_A2)) || null;
}

function makeFlagUrl(iso){
  if(!iso) return null;
  const code = iso.toLowerCase();
  // use flagcdn CDN; size is flexible. We'll use 64px width variant for crispness
  return `https://flagcdn.com/w80/${code}.png`;
}

// Determine whether a feature is large enough to show label/flag
function featureScreenArea(d){
  // get bounding box in projected coordinates
  const b = path.bounds(d);
  const w = b[1][0] - b[0][0];
  const h = b[1][1] - b[0][1];
  // scale by current zoom
  const t = d3.zoomTransform(svg.node());
  const k = t.k || 1;
  return Math.abs(w * h * k * k);
}

function updateLabelsAndFlags(){
  const showLabels = toggleLabels.checked;
  const showFlags = toggleFlags.checked;
  const flagMap = toggleFlagmap.checked;

  // If flagMap is enabled, prepare patterns and set country fills
  if(flagMap){
    countryPaths.each(function(d,i){
      const iso = getIsoA2(d);
      const url = makeFlagUrl(iso);
      const id = `flag-pattern-${i}`;
      if(url){
        // create/update pattern
        let p = defs.select(`#${id}`);
        if(p.empty()){
          p = defs.append('pattern').attr('id', id).attr('patternUnits','objectBoundingBox').attr('width',1).attr('height',1);
          p.append('image').attr('class','pattern-image').attr('preserveAspectRatio','xMidYMid slice');
        }
        p.select('image').attr('href', url).attr('width',1).attr('height',1);
        d3.select(this).attr('fill', `url(#${id})`);
      } else {
        d3.select(this).attr('fill', color(i));
      }
    });
  } else {
    // not a flag map: ensure country fill is a distinct color
    countryPaths.each(function(d,i){
      d3.select(this).attr('fill', color(i));
    });
  }

  // Prepare labels
  const labelsG = g.select('g.labels');
  const flagsG = g.select('g.flags');

  // compute area threshold based on viewport size — show only larger features
  const areaThreshold = 1200; // tuneable

  // build data for which features show labels/flags
  const items = worldFeatures.map((d,i) => {
    return {d, i, area: featureScreenArea(d)};
  });

  // sort by area desc so largest come first
  items.sort((a,b)=> b.area - a.area);

  // show labels for those above threshold; but also limit to top N visible
  const visibleLabels = items.filter(it => it.area > areaThreshold).slice(0, 80);
  const visibleFlags = items.filter(it => it.area > areaThreshold*0.7).slice(0, 120);

  // LABELS
  if(showLabels){
    const lbls = labelsG.selectAll('text.country-label').data(visibleLabels, d=>d.i);
    lbls.join(
      enter => enter.append('text')
        .attr('class','country-label')
        .attr('text-anchor','middle')
        .attr('dy','0.35em')
        .text(e=> e.d.properties.ADMIN || e.d.properties.NAME || ''),
      update => update,
      exit => exit.remove()
    ).each(function(e){
      // position at centroid
      const centroid = path.centroid(e.d);
      const t = d3.zoomTransform(svg.node());
      const x = centroid[0];
      const y = centroid[1];
      d3.select(this).attr('x', x).attr('y', y);
    });
  } else {
    labelsG.selectAll('text.country-label').remove();
  }

  // FLAGS (small flag icons over countries)
  if(showFlags){
    const flagsData = visibleFlags.map(it => ({d:it.d, i:it.i, iso: getIsoA2(it.d)}));
    const f = flagsG.selectAll('image.flag-image').data(flagsData, d=>d.i);
    f.join(
      enter => enter.append('image')
        .attr('class','flag-image')
        .attr('width',24)
        .attr('height',16)
        .attr('preserveAspectRatio','xMidYMid slice')
        .attr('href', d => makeFlagUrl(d.iso)),
      update => update.attr('href', d => makeFlagUrl(d.iso)),
      exit => exit.remove()
    ).each(function(e){
      const centroid = path.centroid(e.d);
      d3.select(this).attr('x', centroid[0]-12).attr('y', centroid[1]-8);
    });
  } else {
    flagsG.selectAll('image.flag-image').remove();
  }
}

// Toolbar show/hide logic: show when mouse near bottom
let toolbarVisible = false;
let hideTimer = null;
function showToolbar(){
  if(!toolbarVisible){
    toolbar.classed('toolbar-visible', true).classed('toolbar-hidden', false);
    toolbarVisible = true;
  }
  if(hideTimer) clearTimeout(hideTimer);
  hideTimer = setTimeout(() => { hideToolbar(); }, 2500);
}
function hideToolbar(){
  if(toolbarVisible){
    toolbar.classed('toolbar-visible', false).classed('toolbar-hidden', true);
    toolbarVisible = false;
  }
}

window.addEventListener('mousemove', (ev)=>{
  const y = ev.clientY;
  if(y > window.innerHeight - 96){
    showToolbar();
  }
});

// React to toggle changes
[ toggleLabels, toggleFlags, toggleFlagmap ].forEach(inp => {
  inp.addEventListener('change', ()=>{
    updateLabelsAndFlags();
  });
});

// Update positions when window resizes
window.addEventListener('resize', ()=>{
  updateLabelsAndFlags();
});
