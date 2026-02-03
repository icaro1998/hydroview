# GEO Flood Stack (Observed Events + Floodplain + Hazard v2.1)

This workflow combines three Earth Engine datasets:

- **Observed floods (Global Flood Database, MODIS events)**: `GLOBAL_FLOOD_DB/MODIS_EVENTS/V1`
- **Floodplain mask (GFPLAIN 250 m)**: `IAHS/GFPLAIN250/v0`
- **Hazard depth scenarios (JRC GLOFAS v2.1)**: `JRC/CEMS_GLOFAS/FloodHazard/v2_1`

---

## What each dataset represents

- **Observed floods (GFD)**: event-based flood extent and duration derived from MODIS. Use the `id` property to select an event.
- **Floodplain mask (GFPLAIN)**: global 250 m binary floodplain mask (`flood` band).
- **Hazard depth (v2.1)**: scenario-based flood depth bands (`RP10_depth`, `RP20_depth`, …, `RP500_depth`).

---

## A) GEE JavaScript app — `geo_flood_stack_gee.js`

### Steps
1. Open the Google Earth Engine Code Editor.
2. Paste the contents of `geo_flood_stack_gee.js` into a new script.
3. (Optional) Draw a custom ROI in the map. If you do nothing, the script falls back to the default bbox around `(-13.7002778, -63.9277778)`.
4. (Optional) To show a KML/KMZ polygon outline, upload it as an Earth Engine asset and set `KML_ASSET` to the asset ID. The outline is displayed as a line-only reference layer and does **not** replace the ROI.
5. Click **Run**.
6. Use the UI panel to:
   - Toggle the GFPLAIN mask.
   - Select a hazard return period and depth threshold.
   - Load a GFD event by `id`.
   - Compute overlap metrics and export layers.

### Expected outputs
- Map layers for hazard depth, floodplain mask, and observed flood event.
- Overlap metrics printed in the console.
- Export tasks in the **Tasks** tab.

---

## B) Colab Notebook — `geo_flood_stack_colab.ipynb`

### Steps
1. Open the notebook in Google Colab.
2. In **Cell 3**, set `EE_PROJECT` or export `EE_PROJECT` in the environment.
3. Run all cells from top to bottom.
4. (Optional) Draw a custom ROI; otherwise the fallback bbox is used.
5. Check the `outputs/` folder for PNG quicklooks.

### Expected outputs
- `outputs/gfplain_roi.png`
- `outputs/hazard_rp100_depth_roi.png`
- `outputs/gfd_event_<id>_flooded_roi.png`
- `outputs/overlap_obs_fp_haz.png`

---

## How to pick a good GFD event ID

- The Global Flood Database uses the `id` property for event selection.
- If an event ID is missing or invalid, `.first()` returns `null` and the script will error.

---

## Can I run everything locally on my computer?

- **GEE JavaScript apps** (like `geo_flood_stack_gee.js`) only run inside the **Earth Engine Code Editor** in a browser. You can edit the file locally, but you must paste it into https://code.earthengine.google.com to execute it.
- **Python notebooks** can be run locally in VSCode if you:
  1. Install Python + create a virtual environment.
  2. `pip install earthengine-api geemap matplotlib`.
  3. Authenticate Earth Engine locally (`earthengine authenticate`) and set `EE_PROJECT`.
  4. Run the `.py` fallback or open the `.ipynb` with the Jupyter extension.

Colab remains the simplest option because it handles auth and dependencies quickly, but local execution is possible for the Python workflow.

---

## Common failures & fixes

### Event ID not found
- Fix: choose another ID and reload the event.

### ROI too large
- Reduce ROI size or increase export scale.

### Scale too fine causing timeouts
- Increase scale (e.g., use 250–500 m for GFD) or reduce ROI size.

### Export fails with too many pixels
- Increase `scale` or reduce ROI.

---

## Notes on metrics

Overlap metrics are computed using pixel area (m²) within the ROI:

- `A_obs`: observed flooded area
- `A_obs_fp`: observed flooded area inside GFPLAIN
- `A_obs_haz`: observed flooded area inside hazard depth > threshold
- `A_obs_fp_haz`: observed flooded area inside both GFPLAIN and hazard mask

All outputs are reported in **km²**.
