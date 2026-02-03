# GEO Flood Workflow (GEE FloodHazard v1 + Xee/Xarray)

This workflow reproduces the reference scripts:

- **FloodHazard v1 flood depth** (GEE JavaScript)
- **ERA5 monthly precipitation** + **Sentinel‑1 flood difference** (Colab Python with Xee/Xarray)

---

## Requirements

- **Earth Engine access** enabled for your account.
- **Google account** for Drive export (GEE JS script).
- **Colab** for the notebook.

---

## A) GEE JavaScript — `geo_flood_depth_v1.js`

### What it does
- Loads **JRC/CEMS_GLOFAS/FloodHazard/v1**.
- Lets you select and visualize return periods (RP10/RP20/RP100 by default).
- Generates a histogram of flood depth for a selected RP.
- Exports the selected RP to Google Drive.

### Steps
1. Open the **Google Earth Engine Code Editor**.
2. Paste the contents of `geo_flood_depth_v1.js` into a new script.
3. **Optional**: draw a custom ROI polygon in the map (the script uses it automatically). If you do nothing, it falls back to a default rectangle around `(-13.7002778, -63.9277778)`.
4. Click **Run**.
5. Use the UI panel to:
   - Toggle RP10/RP20/RP100 layers.
   - Pick a return period for histogram + export.
   - Click **Update layers** or **Export selected RP to Drive**.
6. In the **Tasks** tab, click **Run** on the export task.

### Expected outputs
- Map layers for selected return periods.
- A histogram chart printed in the console.
- A Drive export task for the selected RP.

---

## B) Colab Notebook — `geo_xee_precip_and_s1_flood.ipynb`

### What it does
- Authenticates Earth Engine with **high‑volume endpoint**.
- Lets you draw an ROI (fallback to default ROI if none).
- Loads **ERA5 monthly precipitation** and plots monthly facets.
- Loads **Sentinel‑1 VV**, resamples to monthly minimum, and computes before/after difference.
- Saves figures into `outputs/`.

### Steps
1. Open the notebook in **Google Colab**.
2. In **Cell 3**, set `EE_PROJECT` or export `EE_PROJECT` in the environment.
3. Run all cells from top to bottom.
4. In **Cell 4**, draw your ROI if desired (use drawing tools on the map).
5. Verify that the notebook prints:
   - ERA5 image count
   - Sentinel‑1 scene count
6. Check the `outputs/` folder for:
   - `prcp_<start>_to_<end>.png`
   - `flood_diff_<before>_vs_<after>.png`

### Expected outputs
- `outputs/prcp_2018-01-01_to_2020-12-31.png`
- `outputs/flood_diff_2019-03_vs_2019-04.png`

---

## Common failures & fixes

### ROI is `None` / drawing not captured
- The map drawing tool might not have been used.
- Fix: draw a polygon or rectangle, then re-run the ROI cell.
- If still missing, the notebook will **fallback** to the default bbox.

### Too many pixels / request too large
- Reduce ROI size.
- Increase `PRECIP_SCALE_DEG` or `S1_SCALE_DEG`.
- Narrow the date range.

### 0 Sentinel‑1 scenes
- Change `S1_ORBIT_PASS` to `"AUTO"` or the opposite pass.
- Expand the time range.
- Ensure the ROI is not too small.

### Scale too fine causing timeouts
- Increase `S1_SCALE_DEG` (degrees, EPSG:4326).
- Increase `PRECIP_SCALE_DEG`.

---

## What the outputs mean (and don’t mean)

- **FloodHazard v1** is a **hazard scenario depth** product (not observed floods).
- **Sentinel‑1 difference** is a **heuristic indicator** of possible change; it is **not a validated flood map**.
- **ERA5 precipitation** is monthly total precipitation (meters, converted to mm).

---

## Troubleshooting checklist

- Confirm Earth Engine access is enabled.
- Confirm `EE_PROJECT` is set and valid.
- Confirm ROI and dates are reasonable.
- Use coarser scales for large regions.
