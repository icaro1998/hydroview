# %% [markdown]
# # GEO Flood Workflow — ERA5 Precip + Sentinel-1 Flood Diff (Xee/Xarray)
# 
# This Colab notebook replicates the reference workflow using Earth Engine + Xee/Xarray.

# %%
# Cell 1 — Install deps
!pip install -q earthengine-api geemap xee xarray matplotlib

# %%
# Cell 2 — Imports
import os
import ee
import geemap
import xarray as xr
import xee  # noqa: F401 (registers the EE engine)
import matplotlib.pyplot as plt

# %%
# Cell 3 — Auth/init
# Set your GEE project ID here or via environment variable EE_PROJECT.
EE_PROJECT = os.environ.get("EE_PROJECT", "YOUR_EE_PROJECT")

# Authenticate and initialize using the high-volume endpoint.
ee.Authenticate()
ee.Initialize(project=EE_PROJECT, opt_url="https://earthengine-highvolume.googleapis.com")

# %%
# Cell 4 — ROI selection
DEFAULT_LAT = -13.7002778
DEFAULT_LON = -63.9277778
DEFAULT_BBOX_HALF_DEG = 0.25

m = geemap.Map(center=[DEFAULT_LAT, DEFAULT_LON], zoom=7)
m.add_basemap("HYBRID")
m.add_draw_control()

m

# %% [markdown]
# ## Optional: Upload KML/KMZ ROI (line-only)
# 
# If you want to use a KML/KMZ outline, upload it below. The outline is drawn with no fill, and its geometry
# is used as the ROI if provided.

# %%
from google.colab import files

uploaded = files.upload()  # upload .kml or .kmz
kml_roi = None

for name in uploaded:
    if name.lower().endswith('.kml'):
        kml_fc = geemap.kml_to_ee(name)
    elif name.lower().endswith('.kmz'):
        kml_fc = geemap.kmz_to_ee(name)
    else:
        continue
    kml_roi = kml_fc.geometry()
    m.addLayer(kml_fc.style({'color': 'yellow', 'fillColor': '00000000', 'width': 2}), {}, 'KML/KMZ Outline')
    m.centerObject(kml_fc)

m

# %%
# Retrieve ROI
roi = globals().get("kml_roi", None)
if roi is None:
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
# Cell 5 — Precipitation (ERA5 monthly)
START_DATE = "2018-01-01"
END_DATE = "2020-12-31"
PRECIP_SCALE_DEG = 0.27  # degrees (EPSG:4326)

era5 = (ee.ImageCollection("ECMWF/ERA5/MONTHLY")
        .filterDate(START_DATE, END_DATE)
        .select("total_precipitation")
        .map(lambda img: img.clip(roi).copyProperties(img, ["system:time_start"]))
       )

print("ERA5 image count:", era5.size().getInfo())

era5_xr = xr.open_dataset(
    era5,
    engine="ee",
    geometry=roi,
    crs="EPSG:4326",
    scale=PRECIP_SCALE_DEG,
).sortby("time")

# Convert meters to millimeters
prcp_mm = era5_xr["total_precipitation"] * 1000.0

fig = prcp_mm.plot(
    col="time",
    col_wrap=4,
    cmap="Blues",
    robust=True,
    figsize=(14, 10),
)
plt.tight_layout()

os.makedirs("outputs", exist_ok=True)
prcp_out = f"outputs/prcp_{START_DATE}_to_{END_DATE}.png"
plt.savefig(prcp_out, dpi=150)
print("Saved:", prcp_out)

# %%
# Cell 6 — Sentinel-1 Flood diff
S1_START_DATE = "2018-01-01"
S1_END_DATE = "2020-12-31"
S1_SCALE_DEG = 0.001  # degrees (EPSG:4326)
S1_POLARIZATION = "VV"
S1_INSTRUMENT_MODE = "IW"

# Orbit pass options:
# - "ASCENDING" or "DESCENDING" for fixed
# - "AUTO" to auto-select pass with more images
S1_ORBIT_PASS = "ASCENDING"

s1_base = (ee.ImageCollection("COPERNICUS/S1_GRD")
           .filterBounds(roi)
           .filterDate(S1_START_DATE, S1_END_DATE)
           .filter(ee.Filter.eq("instrumentMode", S1_INSTRUMENT_MODE))
           .filter(ee.Filter.listContains("transmitterReceiverPolarisation", S1_POLARIZATION))
           .select([S1_POLARIZATION]))

if S1_ORBIT_PASS == "AUTO":
    asc = s1_base.filter(ee.Filter.eq("orbitProperties_pass", "ASCENDING"))
    desc = s1_base.filter(ee.Filter.eq("orbitProperties_pass", "DESCENDING"))
    asc_count = asc.size()
    desc_count = desc.size()
    print("ASCENDING count:", asc_count.getInfo())
    print("DESCENDING count:", desc_count.getInfo())
    s1 = ee.ImageCollection(ee.Algorithms.If(asc_count.gte(desc_count), asc, desc))
else:
    s1 = s1_base.filter(ee.Filter.eq("orbitProperties_pass", S1_ORBIT_PASS))

print("Sentinel-1 scene count:", s1.size().getInfo())

s1_xr = xr.open_dataset(
    s1,
    engine="ee",
    geometry=roi,
    crs="EPSG:4326",
    scale=S1_SCALE_DEG,
).sortby("time")

s1_monthly = s1_xr[S1_POLARIZATION].resample(time="M").min("time")

BEFORE_MONTH = "2019-03"
AFTER_MONTH = "2019-04"

before = s1_monthly.sel(time=BEFORE_MONTH)
after = s1_monthly.sel(time=AFTER_MONTH)

delta = (before - after).clip(min=0)

fig, axes = plt.subplots(1, 3, figsize=(12, 4))
before.plot(ax=axes[0], cmap="gray", robust=True)
axes[0].set_title(f"Before {BEFORE_MONTH}")

after.plot(ax=axes[1], cmap="gray", robust=True)
axes[1].set_title(f"After {AFTER_MONTH}")

delta.plot(ax=axes[2], cmap="magma", robust=True, vmin=0)
axes[2].set_title("Delta (before - after)")

plt.tight_layout()

flood_out = f"outputs/flood_diff_{BEFORE_MONTH}_vs_{AFTER_MONTH}.png"
plt.savefig(flood_out, dpi=150)
print("Saved:", flood_out)

# %% [markdown]
# ## Cell 7 — Optional exports
# 
# **Option A: Download GeoTIFF locally (small ROI only)**
# 
# ```python
# # Example: export delta as GeoTIFF using rasterio + rioxarray
# # (Requires additional dependencies, not installed by default.)
# ```
# 
# **Option B: Export to Google Drive (recommended for larger ROIs)**
# 
# ```python
# # Example EE export (run in a separate cell if desired)
# # task = ee.batch.Export.image.toDrive(
# #     image=delta.rename("s1_flood_diff"),
# #     description="S1_FloodDiff",
# #     folder="GEO_FLOOD",
# #     region=roi,
# #     scale=30,
# #     crs="EPSG:4326",
# #     maxPixels=1e13,
# # )
# # task.start()
# # print("Export started, check Tasks tab in the EE Code Editor or task status.")
# ```

