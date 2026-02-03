// GEO Flood Depth workflow - JRC/CEMS_GLOFAS/FloodHazard/v1
// Replicates reference logic with ROI fallback, return period filtering, histogram, and export.

// -----------------------
// Constants (edit as needed)
// -----------------------
var DEFAULT_LAT = -13.7002778;
var DEFAULT_LON = -63.9277778;
var DEFAULT_BBOX_HALF_DEG = 0.25; // degrees
var DEFAULT_RETURN_PERIODS = [10, 20, 100];
var EXPORT_FOLDER = 'GEO_FLOOD';
var EXPORT_SCALE = 1000; // meters (approx, as in reference)
var VIS_PARAMS = {
  min: 0,
  max: 5,
  palette: ['#f7fbff', '#c6dbef', '#6baed6', '#2171b5', '#08306b']
};

// -----------------------
// ROI handling
// -----------------------
// If a drawn geometry exists (Code Editor), use it. Otherwise fallback to default bbox.
var fallbackGeometry = ee.Geometry.Rectangle([
  DEFAULT_LON - DEFAULT_BBOX_HALF_DEG,
  DEFAULT_LAT - DEFAULT_BBOX_HALF_DEG,
  DEFAULT_LON + DEFAULT_BBOX_HALF_DEG,
  DEFAULT_LAT + DEFAULT_BBOX_HALF_DEG
]);

var geometry = (typeof geometry !== 'undefined') ? geometry : fallbackGeometry;

Map.centerObject(geometry, 8);
Map.addLayer(geometry, {color: 'red'}, 'ROI');

// -----------------------
// Data load + inspection
// -----------------------
var jrc = ee.ImageCollection('JRC/CEMS_GLOFAS/FloodHazard/v1')
  .filterBounds(geometry);

print('Collection size:', jrc.size());

var rpValues = jrc.aggregate_array('return_period').distinct();
print('Return periods:', rpValues);

// -----------------------
// UI components
// -----------------------
var panel = ui.Panel({style: {width: '320px'}});
var title = ui.Label('Flood Depth (GLOFAS v1)', {fontWeight: 'bold', fontSize: '16px'});
panel.add(title);

var rpSelect = ui.Select({
  placeholder: 'Loading return periods...'
});

var checkboxRp10 = ui.Checkbox('Show RP10', true);
var checkboxRp20 = ui.Checkbox('Show RP20', true);
var checkboxRp100 = ui.Checkbox('Show RP100', true);

var updateButton = ui.Button('Update layers');
var exportButton = ui.Button('Export selected RP to Drive');

panel.add(ui.Label('Select return period (for histogram/export)'));
panel.add(rpSelect);
panel.add(checkboxRp10);
panel.add(checkboxRp20);
panel.add(checkboxRp100);
panel.add(updateButton);
panel.add(exportButton);

ui.root.insert(0, panel);

// Populate dropdown once values are available.
rpValues.evaluate(function(values) {
  var sorted = values.sort(function(a, b) { return a - b; });
  rpSelect.items().reset(sorted.map(function(v) { return String(v); }));
  rpSelect.setValue(String(DEFAULT_RETURN_PERIODS[0]));
});

function getFloodImage(rp) {
  return jrc
    .filter(ee.Filter.eq('return_period', rp))
    .mosaic()
    .clip(geometry);
}

function clearFloodLayers() {
  var layers = Map.layers();
  for (var i = layers.length() - 1; i >= 0; i--) {
    var layer = layers.get(i);
    if (layer.getName().indexOf('Flood depth RP') === 0) {
      layers.remove(layer);
    }
  }
}

function addFloodLayer(rp) {
  var floodRP = getFloodImage(rp);
  Map.addLayer(floodRP, VIS_PARAMS, 'Flood depth RP ' + rp);
}

function updateLayers() {
  clearFloodLayers();
  if (checkboxRp10.getValue()) addFloodLayer(10);
  if (checkboxRp20.getValue()) addFloodLayer(20);
  if (checkboxRp100.getValue()) addFloodLayer(100);

  var selectedRp = parseInt(rpSelect.getValue(), 10);
  var floodSelected = getFloodImage(selectedRp);

  var chart = ui.Chart.image.histogram({
    image: floodSelected,
    region: geometry,
    scale: EXPORT_SCALE,
    maxPixels: 1e13
  }).setOptions({
    title: 'Flood depth histogram (RP ' + selectedRp + ')',
    hAxis: {title: 'Depth (m)'},
    vAxis: {title: 'Pixel count'}
  });
  print(chart);
}

updateButton.onClick(updateLayers);

exportButton.onClick(function() {
  var selectedRp = parseInt(rpSelect.getValue(), 10);
  var floodSelected = getFloodImage(selectedRp);
  Export.image.toDrive({
    image: floodSelected,
    description: 'FloodDepth_RP' + selectedRp,
    folder: EXPORT_FOLDER,
    region: geometry,
    scale: EXPORT_SCALE,
    crs: 'EPSG:4326',
    maxPixels: 1e13
  });
});

// Initialize default layers + histogram.
updateLayers();
