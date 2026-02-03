# %% [markdown]
# # GEO Flood Stack (Observed Events + Floodplain + Hazard v2.1)
# 
# This notebook reproduces the core workflow with:
# - Global Flood Database (MODIS events)
# - GFPLAIN floodplain mask
# - JRC FloodHazard v2.1 depth scenarios

# %%
# Cell 1 — Install deps
!pip install -q earthengine-api geemap matplotlib

# %%
# Cell 2 — Imports
import os
import ee
import geemap
import matplotlib.pyplot as plt

# %%
# Cell 3 — Auth/init
EE_PROJECT = os.environ.get("EE_PROJECT", "YOUR_EE_PROJECT")

ee.Authenticate()
ee.Initialize(project=EE_PROJECT, opt_url="https://earthengine-highvolume.googleapis.com")

# %%
# Cell 4 — ROI map + fallback
DEFAULT_LAT = -13.7002778
DEFAULT_LON = -63.9277778
DEFAULT_BBOX_HALF_DEG = 0.25

m = geemap.Map(center=[DEFAULT_LAT, DEFAULT_LON], zoom=7)
m.add_basemap("HYBRID")
m.add_draw_control()

m

# %%
# Retrieve ROI
roi = getattr(m, "user_roi", None)
if roi is None:
    roi = ee.Geometry.Rectangle([
        DEFAULT_LON - DEFAULT_BBOX_HALF_DEG,
        DEFAULT_LAT - DEFAULT_BBOX_HALF_DEG,
        DEFAULT_LON + DEFAULT_BBOX_HALF_DEG,
        DEFAULT_LAT + DEFAULT_BBOX_HALF_DEG,
    ])

bounds = roi.bounds()
area_km2 = bounds.area().divide(1e6)
print("ROI bounds:", bounds.getInfo())
print("Approx ROI area (km^2):", area_km2.getInfo())

# %%
# Cell 5 — Load datasets
DEFAULT_EVENT_ID = 1102
DEFAULT_RP = 100
DEPTH_THRESHOLD = 0.5  # meters

# GFPLAIN floodplain mask (0/1)
gfplain = ee.Image("IAHS/GFPLAIN250/v0").select("flood")

# Hazard v2.1 (band-based)
hazard = ee.ImageCollection("JRC/CEMS_GLOFAS/FloodHazard/v2_1").filterBounds(roi).mosaic()
haz_band = hazard.select(f"RP{DEFAULT_RP}_depth")

# Global Flood Database event
# Property 'id' is used for selection
img = ee.Image(
    ee.ImageCollection("GLOBAL_FLOOD_DB/MODIS_EVENTS/V1")
    .filterMetadata("id", "equals", DEFAULT_EVENT_ID)
    .first()
)

flooded = img.select("flooded")
duration = img.select("duration")
perm_water = img.select("jrc_perm_water")

# %%
# Cell 6 — Visualize in geemap
m = geemap.Map(center=[DEFAULT_LAT, DEFAULT_LON], zoom=7)

m.addLayer(gfplain.clip(roi), {"min": 0, "max": 1, "palette": ["000000", "00ffff"]}, "GFPLAIN mask")

m.addLayer(haz_band.clip(roi), {
    "min": 0,
    "max": 5,
    "palette": ["f7fbff", "c6dbef", "6baed6", "2171b5", "08306b"]
}, f"Hazard RP{DEFAULT_RP} depth")

m.addLayer(flooded.clip(roi), {"min": 0, "max": 1, "palette": ["000000", "0000ff"]}, "GFD flooded")

m.addLayer(duration.clip(roi), {
    "min": 0,
    "max": 30,
    "palette": ["ffffcc", "c2e699", "78c679", "31a354", "006837"]
}, "GFD duration")

m.centerObject(roi)
m

# %%
# Cell 7 — Metrics
obs = flooded.eq(1)
fp = gfplain.eq(1)
haz_mask = haz_band.gt(DEPTH_THRESHOLD)

pixel_area = ee.Image.pixelArea()

def area_km2(mask, scale):
    area = pixel_area.updateMask(mask).reduceRegion(
        reducer=ee.Reducer.sum(),
        geometry=roi,
        scale=scale,
        maxPixels=1e13,
    ).get("area")
    return ee.Number(area).divide(1e6)

A_obs = area_km2(obs, 250)
A_obs_fp = area_km2(obs.And(fp), 250)
A_obs_haz = area_km2(obs.And(haz_mask), 90)
A_obs_fp_haz = area_km2(obs.And(fp).And(haz_mask), 90)

metrics = {
    "A_obs_km2": A_obs.getInfo(),
    "A_obs_fp_km2": A_obs_fp.getInfo(),
    "A_obs_haz_km2": A_obs_haz.getInfo(),
    "A_obs_fp_haz_km2": A_obs_fp_haz.getInfo(),
}

print(metrics)

# %%
# Cell 8 — Export quicklooks
import os

os.makedirs("outputs", exist_ok=True)

geemap.ee_export_image(
    gfplain.clip(roi),
    filename="outputs/gfplain_roi.png",
    scale=250,
    region=roi,
    file_per_band=False,
)

geemap.ee_export_image(
    haz_band.clip(roi),
    filename=f"outputs/hazard_rp{DEFAULT_RP}_depth_roi.png",
    scale=90,
    region=roi,
    file_per_band=False,
)

geemap.ee_export_image(
    flooded.clip(roi),
    filename=f"outputs/gfd_event_{DEFAULT_EVENT_ID}_flooded_roi.png",
    scale=250,
    region=roi,
    file_per_band=False,
)

geemap.ee_export_image(
    obs.And(fp).And(haz_mask).selfMask(),
    filename="outputs/overlap_obs_fp_haz.png",
    scale=90,
    region=roi,
    file_per_band=False,
)

