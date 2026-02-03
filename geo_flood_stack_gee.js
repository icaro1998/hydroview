// GEO Flood Stack (Observed Events + Floodplain + Hazard v2.1)
// Datasets:
// - Observed floods: GLOBAL_FLOOD_DB/MODIS_EVENTS/V1
// - Floodplain mask: IAHS/GFPLAIN250/v0
// - Hazard depth: JRC/CEMS_GLOFAS/FloodHazard/v2_1 (band-based)

// -----------------------
// Constants (edit as needed)
// -----------------------
var DEFAULT_LAT = -13.7002778;
var DEFAULT_LON = -63.9277778;
var DEFAULT_BBOX_HALF_DEG = 0.25; // degrees
var DEFAULT_EVENT_ID = 1102; // example GFD event id
var DEFAULT_RP = 100;
var DEFAULT_DEPTH_THRESHOLD = 0.5; // meters
var EXPORT_FOLDER = 'GEO_FLOOD_EXPORTS';

var SCALE_HAZARD = 90;   // meters (hazard v2.1 ~90m)
var SCALE_GFPLAIN = 250; // meters
var SCALE_GFD = 250;     // meters (conservative)

var VIS_GFPLAIN = {min: 0, max: 1, palette: ['000000', '00ffff']};
var VIS_HAZARD = {min: 0, max: 5, palette: ['f7fbff', 'c6dbef', '6baed6', '2171b5', '08306b']};
var VIS_FLOODED = {min: 0, max: 1, palette: ['000000', '0000ff']};
var VIS_DURATION = {min: 0, max: 30, palette: ['ffffcc', 'c2e699', '78c679', '31a354', '006837']};
var VIS_QC = {min: 0, max: 3, palette: ['000000', 'ffcc00', 'ff6600', 'ff0000']};

// -----------------------
// ROI handling
// -----------------------
var fallbackGeometry = ee.Geometry.Rectangle([
  DEFAULT_LON - DEFAULT_BBOX_HALF_DEG,
  DEFAULT_LAT - DEFAULT_BBOX_HALF_DEG,
  DEFAULT_LON + DEFAULT_BBOX_HALF_DEG,
  DEFAULT_LAT + DEFAULT_BBOX_HALF_DEG
]);

var geometry = (typeof geometry !== 'undefined') ? geometry : fallbackGeometry;
var referencePoint = ee.Geometry.Point([DEFAULT_LON, DEFAULT_LAT]);

Map.centerObject(geometry, 8);
Map.addLayer(geometry, {color: 'red'}, 'ROI');
Map.addLayer(referencePoint, {color: 'white'}, 'Reference point (13°42\'01"S, 63°55\'40"W)');
print('Reference point (lat, lon):', DEFAULT_LAT, DEFAULT_LON);

// -----------------------
// Data load
// -----------------------
var gfplain = ee.Image('IAHS/GFPLAIN250/v0').select('flood');
var hazardIc = ee.ImageCollection('JRC/CEMS_GLOFAS/FloodHazard/v2_1').filterBounds(geometry);
var gfd = ee.ImageCollection('GLOBAL_FLOOD_DB/MODIS_EVENTS/V1');

// -----------------------
// UI components
// -----------------------
var panel = ui.Panel({style: {width: '360px'}});
var title = ui.Label('GEO Flood Stack', {fontWeight: 'bold', fontSize: '16px'});
panel.add(title);

// ROI section
var roiLabel = ui.Label('ROI bounds will update on refresh');
var useRoiButton = ui.Button('Use drawn ROI / fallback ROI');

// GFPLAIN section
var gfplainCheckbox = ui.Checkbox('Show GFPLAIN floodplain mask', true);

// Hazard section
var rpSelect = ui.Select({
  items: ['10', '20', '50', '75', '100', '200', '500'],
  value: String(DEFAULT_RP)
});
var depthSlider = ui.Slider({min: 0, max: 5, step: 0.1, value: DEFAULT_DEPTH_THRESHOLD});
var spuriousCheckbox = ui.Checkbox('Show spurious_depth_category', false);
var permWaterCheckbox = ui.Checkbox('Show permanent_water_class', false);

// GFD section
var eventIdInput = ui.Textbox({placeholder: 'Event ID', value: String(DEFAULT_EVENT_ID)});
var loadEventButton = ui.Button('Load event');
var showFloodedCheckbox = ui.Checkbox('Show flooded', true);
var showDurationCheckbox = ui.Checkbox('Show duration', false);
var maskPermWaterCheckbox = ui.Checkbox('Mask permanent water', true);

// Metrics + Export
var metricsButton = ui.Button('Compute overlap metrics');
var exportButton = ui.Button('Export selected layers to Drive');

panel.add(ui.Label('ROI'));
panel.add(useRoiButton);
panel.add(roiLabel);

panel.add(ui.Label('GFPLAIN'));
panel.add(gfplainCheckbox);

panel.add(ui.Label('Hazard v2.1'));
panel.add(ui.Label('Return period (RP)'));
panel.add(rpSelect);
panel.add(ui.Label('Depth threshold (m)'));
panel.add(depthSlider);
panel.add(spuriousCheckbox);
panel.add(permWaterCheckbox);

panel.add(ui.Label('Observed event (GFD MODIS)'));
panel.add(eventIdInput);
panel.add(loadEventButton);
panel.add(showFloodedCheckbox);
panel.add(showDurationCheckbox);
panel.add(maskPermWaterCheckbox);

panel.add(metricsButton);
panel.add(exportButton);

ui.root.insert(0, panel);

// -----------------------
// Helpers
// -----------------------
function getRoi() {
  return (typeof geometry !== 'undefined') ? geometry : fallbackGeometry;
}

function updateRoiLabel(roi) {
  roi.bounds().coordinates().evaluate(function(coords) {
    roiLabel.setValue('ROI bounds: ' + JSON.stringify(coords));
  });
}

function hazardBandName(rp) {
  return 'RP' + rp + '_depth';
}

function getHazardImage(roi, rp) {
  return hazardIc.mosaic().clip(roi).select(hazardBandName(rp));
}

function getGfdImage(eventId) {
  return ee.Image(gfd.filterMetadata('id', 'equals', eventId).first());
}

function clearLayerByPrefix(prefix) {
  var layers = Map.layers();
  for (var i = layers.length() - 1; i >= 0; i--) {
    var layer = layers.get(i);
    if (layer.getName().indexOf(prefix) === 0) {
      layers.remove(layer);
    }
  }
}

function refreshLayers() {
  var roi = getRoi();
  updateRoiLabel(roi);

  clearLayerByPrefix('GFPLAIN');
  clearLayerByPrefix('Hazard');
  clearLayerByPrefix('GFD');

  if (gfplainCheckbox.getValue()) {
    var gf = gfplain.clip(roi);
    Map.addLayer(gf, VIS_GFPLAIN, 'GFPLAIN mask');
  }

  var rp = rpSelect.getValue();
  var haz = getHazardImage(roi, rp);
  Map.addLayer(haz, VIS_HAZARD, 'Hazard RP' + rp + ' depth');

  if (spuriousCheckbox.getValue()) {
    var spurious = hazardIc.mosaic().clip(roi).select('spurious_depth_category');
    Map.addLayer(spurious, VIS_QC, 'Hazard spurious_depth_category');
  }
  if (permWaterCheckbox.getValue()) {
    var perm = hazardIc.mosaic().clip(roi).select('permanent_water_class');
    Map.addLayer(perm, VIS_QC, 'Hazard permanent_water_class');
  }
}

function loadEvent() {
  var roi = getRoi();
  var eventId = parseInt(eventIdInput.getValue(), 10);
  var img = getGfdImage(eventId);

  clearLayerByPrefix('GFD');

  var flooded = img.select('flooded');
  var duration = img.select('duration');
  var permWater = img.select('jrc_perm_water');

  if (maskPermWaterCheckbox.getValue()) {
    flooded = flooded.updateMask(permWater.neq(1));
    duration = duration.updateMask(permWater.neq(1));
  }

  if (showFloodedCheckbox.getValue()) {
    Map.addLayer(flooded.clip(roi), VIS_FLOODED, 'GFD flooded (event ' + eventId + ')');
  }
  if (showDurationCheckbox.getValue()) {
    Map.addLayer(duration.clip(roi), VIS_DURATION, 'GFD duration (event ' + eventId + ')');
  }
}

function computeMetrics() {
  var roi = getRoi();
  var rp = rpSelect.getValue();
  var threshold = depthSlider.getValue();
  var eventId = parseInt(eventIdInput.getValue(), 10);

  var img = getGfdImage(eventId);
  var obs = img.select('flooded').eq(1);
  if (maskPermWaterCheckbox.getValue()) {
    obs = obs.and(img.select('jrc_perm_water').neq(1));
  }

  var fp = gfplain.eq(1);
  var hazBand = getHazardImage(roi, rp);
  var hazMask = hazBand.gt(threshold);

  function areaKm2(mask, scale) {
    var areaImg = ee.Image.pixelArea().updateMask(mask);
    var sum = areaImg.reduceRegion({
      reducer: ee.Reducer.sum(),
      geometry: roi,
      scale: scale,
      maxPixels: 1e13
    });
    return ee.Number(sum.get('area')).divide(1e6);
  }

  var areaObs = areaKm2(obs, SCALE_GFD);
  var areaObsFp = areaKm2(obs.and(fp), SCALE_GFD);
  var areaObsHaz = areaKm2(obs.and(hazMask), SCALE_HAZARD);
  var areaObsFpHaz = areaKm2(obs.and(fp).and(hazMask), SCALE_HAZARD);

  var metrics = ee.Dictionary({
    A_obs_km2: areaObs,
    A_obs_fp_km2: areaObsFp,
    A_obs_haz_km2: areaObsHaz,
    A_obs_fp_haz_km2: areaObsFpHaz
  });

  print('Overlap metrics (km^2) for event ' + eventId + ' and RP' + rp + ' > ' + threshold + 'm');
  print(metrics);
}

function exportLayers() {
  var roi = getRoi();
  var rp = rpSelect.getValue();
  var eventId = parseInt(eventIdInput.getValue(), 10);

  var gf = gfplain.clip(roi);
  var haz = getHazardImage(roi, rp);
  var img = getGfdImage(eventId);

  var flooded = img.select('flooded');
  var duration = img.select('duration');
  if (maskPermWaterCheckbox.getValue()) {
    var permWater = img.select('jrc_perm_water');
    flooded = flooded.updateMask(permWater.neq(1));
    duration = duration.updateMask(permWater.neq(1));
  }

  Export.image.toDrive({
    image: gf,
    description: 'GFPLAIN_mask',
    folder: EXPORT_FOLDER,
    region: roi,
    scale: SCALE_GFPLAIN,
    crs: 'EPSG:4326',
    maxPixels: 1e13
  });

  Export.image.toDrive({
    image: haz,
    description: 'Hazard_RP' + rp + '_depth',
    folder: EXPORT_FOLDER,
    region: roi,
    scale: SCALE_HAZARD,
    crs: 'EPSG:4326',
    maxPixels: 1e13
  });

  Export.image.toDrive({
    image: flooded,
    description: 'GFD_event_' + eventId + '_flooded',
    folder: EXPORT_FOLDER,
    region: roi,
    scale: SCALE_GFD,
    crs: 'EPSG:4326',
    maxPixels: 1e13
  });

  Export.image.toDrive({
    image: duration,
    description: 'GFD_event_' + eventId + '_duration',
    folder: EXPORT_FOLDER,
    region: roi,
    scale: SCALE_GFD,
    crs: 'EPSG:4326',
    maxPixels: 1e13
  });
}

// -----------------------
// Wire UI
// -----------------------
useRoiButton.onClick(function() {
  geometry = (typeof geometry !== 'undefined') ? geometry : fallbackGeometry;
  Map.centerObject(geometry, 8);
  refreshLayers();
});

gfplainCheckbox.onChange(refreshLayers);
rpSelect.onChange(refreshLayers);
spuriousCheckbox.onChange(refreshLayers);
permWaterCheckbox.onChange(refreshLayers);

depthSlider.onChange(function() {
  // no-op; used for metrics
});

loadEventButton.onClick(loadEvent);
showFloodedCheckbox.onChange(loadEvent);
showDurationCheckbox.onChange(loadEvent);
maskPermWaterCheckbox.onChange(loadEvent);

metricsButton.onClick(computeMetrics);
exportButton.onClick(exportLayers);

// Initial load
updateRoiLabel(getRoi());
refreshLayers();
loadEvent();
