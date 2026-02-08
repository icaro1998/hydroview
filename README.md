# Flood Monitoring & River Overflow Prevention (GEE) — Project Summary (Codex)

## Scope
This repository implements a **monthly, auditable flood monitoring pipeline** intended to support **river overflow (floodplain expansion) detection and prevention-oriented analysis** using **Google Earth Engine (GEE)** datasets and raster exports.

The pipeline produces **GeoTIFF outputs** designed for downstream:
- flood extent / anomaly tracking
- flooded vegetation detection
- exposure overlays (population, land cover, assets) in later stages
- reporting and dashboards

---

## Data Sources (Google Earth Engine Dataset IDs)

### 1) Dynamic World v1 (Sentinel-2 based land cover probabilities)
**GEE ID**
- `GOOGLE/DYNAMICWORLD/V1`

**Layers used**
- `water` (probability)
- `flooded_vegetation` (probability)
- `label_mode` (dominant class)

**Purpose**
- consistent global classification signal
- separates **open water** vs **flooded vegetation**
- provides a stable base layer for anomaly detection and masking permanent water

---

### 2) Sentinel-3 OLCI (optical radiometry + derived NDWI)
**GEE ID**
- `COPERNICUS/S3/OLCI`

**Bands used**
- `Oa06_radiance`
- `Oa08_radiance`
- `Oa17_radiance`
- `Oa21_radiance`

**Derived**
- NDWI (Normalized Difference Water Index)

**Purpose**
- optical characterization of water bodies
- supports seasonal water dynamics and anomaly interpretation
- complements classification outputs (Dynamic World)

---

## Spatial/Temporal Design (Observed)
- AOI defined by center coordinate + buffer (example from logs): **30 km buffer**
- Time coverage: **full year 2025**
- Temporal aggregation: **monthly**
- Export format: **GeoTIFF**

---

## Filesystem Outputs (Observed from Console Audit)

### Dynamic World outputs (expected 12 months each)
Directory pattern:
- `output/flood/additional_30km_2025/dynamicworld/`

Expected file groups:
- `dw_water_prob_2025-*.tif`  → **12/12**
- `dw_flooded_veg_prob_2025-*.tif` → **12/12**
- `dw_label_mode_2025-*.tif` → **12/12**

Total: **36 GeoTIFF**

Validation (observed):
- `validate_rasters.py` matched **36** files
- TIFF count: **36**
- BAD: **0**

Interpretation:
- Dynamic World export is complete and integrity-checked.

---

### Sentinel-3 OLCI outputs (monthly batches)
Export is executed in quarterly ranges:
- 2025-01 → 2025-03
- 2025-04 → 2025-06
- 2025-07 → 2025-09
- 2025-10 → 2025-12

A summary file is written/updated:
- `output/flood/additional_30km_2025/download_summary.csv`

Log indicates monthly composites with:
- 4 radiance bands + NDWI
- image counts per month (e.g., 35–43 images), suggesting adequate monthly sampling

---

## Audit & Reproducibility Principles

### “Files are truth”
The pipeline is designed to be auditable from **disk outputs**, not only stdout logs:
- monthly completeness via filename/month parsing
- TIFF integrity validation
- zero-byte detection
- band completeness checks (per month / per band)

This aligns with operational flood monitoring practice: **produce stable, reproducible raster products first**, then derive decision metrics and dashboards.

---

## Known Runtime Warning (Observed)
Repeated warning from `xee`:
- Unable to retrieve `system:time_start` values from an ImageCollection

Notes:
- This is treated as a **metadata warning**, not assumed to invalidate exports.
- The project auditing approach relies on **output filenames + filesystem checks** for temporal traceability.

---

## What the System Enables (Current Capability)
With Dynamic World + S3 OLCI monthly GeoTIFF outputs, the project supports:
- detection of **surface water expansion** over time
- identification of **flooded vegetation** (key floodplain impact signal)
- monthly time series for seasonal analysis
- inputs for prevention workflows:
  - recurrent inundation mapping
  - flood season pattern recognition
  - prioritization of monitoring zones

---

## Out of Scope (Current)
By design, the current pipeline does not yet:
- generate real-time alerts
- estimate discharge or water depth
- assimilate in-situ hydrometric stations
- run hydraulic models (e.g., HEC-RAS) inside the pipeline

---

## Optional Visualization (Deferred): Google Earth Studio
Google Earth Studio can be used later to:
- animate monthly flood dynamics (water expansion)
- create stakeholder-friendly visuals of flood progression

This is **not required** for analytical validity and is intentionally separated from the core pipeline.

---

## Command-Line Evidence (Observed)
Dynamic World completion and raster integrity:
- 12/12 for water, flooded vegetation, label
- `validate_rasters.py` => BAD: 0

S3 OLCI processing:
- monthly image counts logged per month
- `download_summary.csv` updated after each quarterly run

---

## Minimal Codex Summary (1 paragraph)
This project implements a Google Earth Engine–based flood monitoring pipeline for river overflow prevention analysis. It exports monthly GeoTIFF products for 2025 using Dynamic World (`GOOGLE/DYNAMICWORLD/V1`) water and flooded-vegetation probabilities plus Sentinel-3 OLCI radiance bands (`COPERNICUS/S3/OLCI`) and NDWI. The system emphasizes filesystem-level auditability (counts, integrity checks, summaries) to ensure reproducible, prevention-oriented monitoring products suitable for downstream exposure analysis, dashboards, and optional visualization workflows (e.g., Google Earth Studio animations).
