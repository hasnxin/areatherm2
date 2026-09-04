/* AreaTherm UI — Validation, Reports, Evaluator Summary, Settings */
window.UI = window.UI || {};

(function () {
  const DATA = window.APP_DATA, ENGINE = window.APP_ENGINE, STORE = window.APP_STORE, CH = window.APP_CHARTS, CFG = window.APP_CONFIG;
  function matName(id) { const m = DATA.materialById(id); return m ? m.name : id || "—"; }

  function predictSteadyState(design, ambientC, solarWm2) {
    const geom = ENGINE.computeGeometry(design);
    const uWall = ENGINE.wallUValue(design), uRoof = ENGINE.roofUValue(design), uFloor = ENGINE.floorUValue(design);
    const win = design.windows[0];
    const uWin = ENGINE.windowUValue(win);
    const shgc = (DATA.materialById(win.glazingMaterialId) || {}).shgc || 0.7;
    const windowArea = (win.areaEach || 0) * (win.count || 0);
    const ventUA = (design.airLeakageAch * geom.volume / 3600) * 1.2 * 1005;
    const UA = uWall * geom.wallArea + uRoof * geom.roofArea + uFloor * geom.floorArea + uWin * windowArea + ventUA;
    const solarGain = windowArea * solarWm2 * 0.85 * shgc + (design.internalHeatGainW || 0);
    return ambientC + solarGain / UA;
  }

  let validationRows = [
    { hour: 8, ambient: -6, solar: 120, wind: 2, rh: 35, measured: 4 },
    { hour: 12, ambient: 2, solar: 620, wind: 2.4, rh: 30, measured: 13 },
    { hour: 16, ambient: -1, solar: 240, wind: 2.1, rh: 32, measured: 9 },
    { hour: 20, ambient: -9, solar: 0, wind: 1.8, rh: 38, measured: 1 }
  ];

  UI.renderValidation = function (root) {
    const s = STORE.get();

    root.innerHTML = `
      <h1>Model Validation</h1>
      <p class="subtitle"><span class="tag tag-field">user-provided</span> Enter measured field data (from an actual
      instrumented shelter) to compare against the model's prediction. No field measurements exist for this prototype —
      the rows below are editable placeholders you can overwrite. Requires field validation before use in a real
      engineering decision.</p>

      <div class="card">
        <h3>Measured Data Points</h3>
        <div class="table-wrap"><table><thead><tr>
          <th>Hour of day</th><th>Ambient (°C)</th><th>Solar (W/m²)</th><th>Wind (m/s)</th><th>RH (%)</th><th>Measured Indoor (°C)</th><th></th>
        </tr></thead><tbody id="valRows">
          ${validationRows.map((r, i) => `<tr data-i="${i}">
            <td><input type="number" step="0.5" value="${r.hour}" data-f="hour" style="width:70px;"></td>
            <td><input type="number" value="${r.ambient}" data-f="ambient" style="width:70px;"></td>
            <td><input type="number" value="${r.solar}" data-f="solar" style="width:80px;"></td>
            <td><input type="number" step="0.1" value="${r.wind}" data-f="wind" style="width:60px;"></td>
            <td><input type="number" value="${r.rh}" data-f="rh" style="width:60px;"></td>
            <td><input type="number" step="0.1" value="${r.measured}" data-f="measured" style="width:70px;"></td>
            <td><button class="btn btn-sm" data-remove="${i}">✕</button></td>
          </tr>`).join("")}
        </tbody></table></div>
        <button class="btn btn-sm" id="addRowBtn" style="margin-top:8px;">+ Add row</button>
        <button class="btn btn-accent" id="runValidationBtn" style="margin-left:8px;">Compare Measured vs Predicted</button>
        <p class="hint">Predicted values use a steady-state point-balance approximation (Q_solar + Q_internal = UA × ΔT)
        against the current shelter design — a simplification for point-in-time validation, documented as an assumption.
        Full transient validation requires continuous time-aligned field logging (future integration).</p>
      </div>

      <div id="validationResults"></div>
    `;

    function bindRows() {
      U.qsa("#valRows input", root).forEach(inp => inp.addEventListener("change", () => {
        const i = parseInt(inp.closest("tr").dataset.i);
        validationRows[i][inp.dataset.f] = parseFloat(inp.value);
      }));
      U.qsa("[data-remove]", root).forEach(btn => btn.addEventListener("click", () => {
        validationRows.splice(parseInt(btn.dataset.remove), 1);
        window.APP.render();
      }));
    }
    bindRows();

    U.on("#addRowBtn", "click", () => {
      validationRows.push({ hour: 12, ambient: 0, solar: 300, wind: 2, rh: 30, measured: 10 });
      window.APP.render();
    }, root);

    U.on("#runValidationBtn", "click", () => {
      const points = validationRows.map(r => ({
        ...r, predicted: Math.round(predictSteadyState(s.design, r.ambient, r.solar) * 100) / 100
      }));
      const stats = ENGINE.validationStats(points.map(p => ({ measured: p.measured, predicted: p.predicted })));
      STORE.addValidationDataset({ id: "VAL-" + Date.now(), ts: new Date().toISOString(), points, stats });

      const wrap = U.qs("#validationResults", root);
      wrap.innerHTML = `
        <div class="card" style="margin-top:16px;">
          <h3>Error Metrics <span class="tag tag-model">model prediction vs user-provided measurement</span></h3>
          <div class="grid grid-4">
            <div class="metric-card card"><div class="metric-label">MAE</div><div class="metric-value">${stats.mae}</div><div class="metric-sub">°C</div></div>
            <div class="metric-card card"><div class="metric-label">RMSE</div><div class="metric-value">${stats.rmse}</div><div class="metric-sub">°C</div></div>
            <div class="metric-card card"><div class="metric-label">MAPE</div><div class="metric-value">${stats.mape}</div><div class="metric-sub">%</div></div>
            <div class="metric-card card"><div class="metric-label">R²</div><div class="metric-value">${stats.r2 ?? "—"}</div><div class="metric-sub">n = ${stats.n}</div></div>
          </div>
          <h3 style="margin-top:14px;">Measured vs Predicted</h3>
          <div id="valScatter" style="max-width:440px;"></div>
        </div>`;
      CH.scatterChart(U.qs("#valScatter", wrap), points.map(p => ({ x: p.measured, y: p.predicted })), { xLabel: "Measured Indoor (°C)", yLabel: "Predicted Indoor (°C)" });
    }, root);
  };

  // ---------------------------------------------------------------------
  UI.renderReport = function (root) {
    const s = STORE.get();
    const result = s.lastSimulationResult;
    const opt = s.lastOptimizationResult;
    const season = STORE.currentSeason();
    const now = new Date();
    const simId = "SIM-" + now.getTime();

    root.innerHTML = `
      <div class="card" style="margin-bottom:14px; display:flex; justify-content:space-between; align-items:center;">
        <div><b>Engineering Report</b> — printable / exportable to PDF via your browser's print dialog.</div>
        <button class="btn btn-accent" id="printBtn">🖨 Print / Save as PDF</button>
      </div>
      <div class="card" id="reportDoc" style="line-height:1.7;">
        <h1 style="text-align:center;">Area-Specific Passive Shelter Thermal Performance &amp; Design Optimization Report</h1>
        <p style="text-align:center;color:var(--text-muted);">Generated: ${now.toLocaleString()} &nbsp;|&nbsp; Model version: ${CFG.MODEL_VERSION} &nbsp;|&nbsp; Simulation ID: ${simId}</p>
        <hr/>
        <div class="card" style="background:#fdf0d8;border-color:#f3ddac;">
          <h3 style="color:#8a5a10;">Important Disclaimer</h3>
          <p style="margin:0;">This report contains model-based predictions. Field validation against instrumented
          shelter measurements is <b>required</b> before deployment.<br/>
          Data source: <b>${s.climateSource ? U.esc(s.climateSource.label) : "Not set"}</b>
          ${s.climateSource ? `(${U.esc(s.climateSource.period || (s.climateSource.type === "REAL" ? "live" : "illustrative"))})` : ""}<br/>
          Validation status: <b>${s.validationDatasets.length ? s.validationDatasets.length + " dataset(s) compared — see Validation module" : "Not field-validated"}</b></p>
        </div>
        <h3 style="margin-top:16px;">1–2. Project &amp; Location</h3>
        <p>Project: <b>${U.esc(s.project.name)}</b><br/>
        Location: <b>${s.location ? U.esc(s.location.label) : "Not set"}</b>
        ${s.location ? `(Lat ${s.location.latitude}, Lon ${s.location.longitude}, Elevation ${s.location.elevationM} m)` : ""}
        ${s.climateSource ? `<span class="tag tag-demo">${U.esc(s.climateSource.label)}</span>` : ""}</p>

        <h3>3. Climate Inputs (${s.seasonKey || "—"})</h3>
        ${season ? `<p>Ambient temperature: ${season.tMin} to ${season.tMax} °C · Solar irradiance: ${season.solarKwhDay} kWh/m²/day ·
        Sunshine window: ${season.sunrise}h–${season.sunset}h · Wind: ${season.windMs} m/s · RH: ${season.rhPct}% · Cloud cover: ${season.cloudPct}%</p>` : "<p>—</p>"}

        <h3>4. Shelter Geometry</h3>
        <p>Shape: ${s.design.shape} · Orientation: ${s.design.orientation}${s.design.orientation==="CUSTOM"?" ("+s.design.azimuthDeg+"° from South)":""} ·
        Dimensions: ${s.design.length}m × ${s.design.width}m × ${s.design.height}m</p>

        <h3>5–6. Material Specification &amp; Thermal Properties</h3>
        <table><tr><th>Element</th><th>Material</th><th>Thickness</th><th>U-value (W/m²K)</th></tr>
          <tr><td>Wall</td><td>${matName(s.design.wall.materialId)} + ${matName(s.design.wall.insulationMaterialId)}</td><td>${s.design.wall.thicknessMm}mm + ${s.design.wall.insulationThicknessMm}mm</td><td>${ENGINE.wallUValue(s.design).toFixed(3)}</td></tr>
          <tr><td>Roof</td><td>${matName(s.design.roof.materialId)} + ${matName(s.design.roof.insulationMaterialId)}</td><td>${s.design.roof.thicknessMm}mm + ${s.design.roof.insulationThicknessMm}mm</td><td>${ENGINE.roofUValue(s.design).toFixed(3)}</td></tr>
          <tr><td>Floor</td><td>${matName(s.design.floor.materialId)}</td><td>${s.design.floor.thicknessMm}mm</td><td>${ENGINE.floorUValue(s.design).toFixed(3)}</td></tr>
          <tr><td>Window</td><td>${matName(s.design.windows[0].glazingMaterialId)}</td><td>—</td><td>${ENGINE.windowUValue(s.design.windows[0]).toFixed(2)}</td></tr>
          <tr><td>Thermal mass</td><td>${s.design.thermalMass ? matName(s.design.thermalMass.materialId)+" ("+s.design.thermalMass.massKg+" kg)" : "None"}</td><td>—</td><td>—</td></tr>
        </table>

        <h3>7. Simulation Methodology</h3>
        <p>Two-node RC (indoor air + thermal mass) hourly energy-balance model. Solar gain via sol-air temperature
        (opaque surfaces) and SHGC-based transmission (glazing). See ARCHITECTURE.md §3 for full formulas.
        Time step: ${s.simConfig.timeStepMinutes} min · Period: ${s.simConfig.periodType}.</p>

        <h3>8. Assumptions</h3>
        <ul>
          <li>Outside film coefficient fixed at 23 W/m²K, wind-adjusted infiltration.</li>
          <li>Ground temperature assumed equal to seasonal mean ambient unless overridden.</li>
          <li>Longwave sky radiation exchange not separately modelled (folded into sol-air simplification).</li>
          <li>PCM thermal mass modelled via elevated apparent specific heat over its melt band.</li>
        </ul>

        ${result ? `
        <h3>9–11. Solar Energy, Heat Transfer &amp; Indoor Temperature Prediction <span class="tag tag-model">Model Prediction</span></h3>
        <table>
          <tr><td>Solar heat gain</td><td class="num">${result.daily.solarKwh} kWh/day</td></tr>
          <tr><td>Wall / roof / floor / opening / ventilation loss</td><td class="num">${result.daily.wallLossKwh} / ${result.daily.roofLossKwh} / ${result.daily.floorLossKwh} / ${result.daily.openingLossKwh} / ${result.daily.ventLossKwh} kWh/day</td></tr>
          <tr><td>Net energy balance</td><td class="num">${result.daily.netKwh} kWh/day</td></tr>
          <tr><td>Predicted indoor temperature range</td><td class="num">${result.comfort.minIndoor} – ${result.comfort.maxIndoor} °C</td></tr>
        </table>
        <h3>12. Thermal Comfort Analysis</h3>
        <p>Comfort duration: ${result.comfort.comfortHoursPerDay} h/day (day ${result.comfort.dayComfortPct}%, night ${result.comfort.nightComfortPct}%).
        Thermal Comfort Score: <b>${result.scores.thermalComfortScore}/100</b>.</p>` : `<p><i>No simulation has been run yet for this report.</i></p>`}

        ${opt ? `
        <h3>13–15. Candidate Comparison, Optimization Results &amp; Recommended Design</h3>
        <p>${opt.candidatesEvaluated} candidate configurations evaluated. Recommended: <b>Design ${opt.recommended.label}</b> —
        ${opt.recommended.params.orient}-facing, ${matName(opt.recommended.design.wall.materialId)} wall,
        ${opt.recommended.params.insul}mm insulation, ${matName(opt.recommended.params.glz)} glazing at
        ${Math.round(opt.recommended.params.wpct*100)}% window area. Thermal score ${opt.recommended.score.total.toFixed(0)}/100,
        estimated cost ₹${opt.recommended.cost.toLocaleString("en-IN")}.</p>
        <h3>16. Sensitivity Analysis</h3>
        <p>See Optimization module for the ranked parameter-impact chart on this design.</p>` : `<p><i>No optimization run yet for this report.</i></p>`}

        <h3>17. Limitations</h3>
        <p>Climate inputs used here are ${s.climateSource ? s.climateSource.label.toLowerCase() : "user-provided"}, not
        field-measured. The thermal model is a simplified two-node transient RC network — it omits 3D conduction,
        detailed longwave radiation exchange, and moisture transport. Results are model predictions requiring
        engineering and field validation before construction decisions.</p>

        <h3>18. Engineering Validation Requirements</h3>
        <p>Before construction: (1) validate material properties against actual procured specifications: (2) instrument
        a pilot shelter and compare against the Validation module; (3) have a qualified structural/thermal engineer
        review the final design.</p>
      </div>`;

    U.on("#printBtn", "click", () => window.print(), root);
  };

  // ---------------------------------------------------------------------
  UI.renderEvaluator = function (root) {
    const s = STORE.get();
    const result = s.lastSimulationResult;
    const opt = s.lastOptimizationResult;

    root.innerHTML = `
      <h1>Design Intelligence Summary</h1>
      <p class="subtitle">A 2–3 minute overview for an evaluator: the problem, the model, and the recommended design.</p>
      ${s.climateSource ? `<div style="margin-bottom:14px;">${U.badge(s.climateSource)}</div>` : ""}

      <div class="grid grid-3" style="margin-bottom:16px;">
        <div class="card"><h3>Location</h3><div style="font-size:16px;font-weight:700;">${s.location ? U.esc(s.location.label) : "Not selected"}</div>
          <div class="hint">${s.location ? (s.location.solarDataSource
            ? `${s.location.annualSolarKwhM2Yr} kWh/m²/yr (NASA POWER, ${U.esc(s.location.solarDataSource.period)}) · ${s.location.avgSunshineHoursDay}h daylight`
            : (s.climateSource && s.climateSource.type === "REAL"
              ? `${STORE.currentSeason().solarKwhDay} kWh/m²/day · ${s.location.avgSunshineHoursDay}h daylight · ${STORE.currentSeason().cloudPct}% cloud cover (live avg, not annual climatology)`
              : `${s.location.annualSolarKwhM2Yr} kWh/m²/yr · ${s.location.avgSunshineHoursDay}h sunshine/day · ${s.location.avgCloudFreeDays} clear days/yr`)) : ""}</div></div>
        <div class="card"><h3>Climate Severity (${s.seasonKey || "—"})</h3><div style="font-size:16px;font-weight:700;">${STORE.currentSeason() ? STORE.currentSeason().tMin + "°C to " + STORE.currentSeason().tMax + "°C" : "—"}</div>
          <div class="hint">${STORE.currentSeason() ? (STORE.currentSeason().tMax - STORE.currentSeason().tMin).toFixed(0) + "°C diurnal swing" : ""}</div></div>
        <div class="card"><h3>Validation Status</h3><div style="font-size:16px;font-weight:700;">${s.validationDatasets.length ? s.validationDatasets.length + " dataset(s) compared" : "Not yet validated"}</div>
          <div class="hint">Field validation required before deployment</div></div>
      </div>

      ${result ? `
      <div class="grid grid-2" style="margin-bottom:16px;">
        <div class="card">
          <h3>Thermal Comfort Score</h3>
          <div style="display:flex; align-items:center; gap:20px;">
            <div id="evalGauge"></div>
            <div>
              <div>Solar utilization: <b>${result.scores.solarUtilizationPct}%</b></div>
              <div>Heat retention: <b>${result.scores.heatRetentionPct}%</b></div>
              <div>Heat loss: <b>${result.daily.totalLossKwh} kWh/day</b></div>
              <div>${opt ? `Optimization improvement: <b>+${(opt.recommended.score.total - opt.top[opt.top.length-1].score.total).toFixed(1)} pts</b> vs weakest evaluated candidate` : ""}</div>
            </div>
          </div>
        </div>
        <div class="card">
          <h3>Why This Design?</h3>
          <ul class="checklist">
            <li>High solar gain utilization (${result.scores.solarUtilizationPct}%)</li>
            <li>Reduced night-time heat loss via insulation (U-wall ${result.uValues.wall.toFixed(2)} W/m²K)</li>
            <li>Improved insulation on wall and roof</li>
            <li>Optimized opening area for the local solar/heat-loss trade-off</li>
            <li>${s.design.thermalMass ? "Thermal mass added for night-time heat release" : "Thermal mass not yet configured — see What-If Analysis"}</li>
            <li>Orientation set to ${s.design.orientation} for solar exposure</li>
          </ul>
        </div>
      </div>
      <div class="card"><h3>Recommended Shelter</h3>
        <p>${opt ? `Design ${opt.recommended.label} — ${opt.recommended.params.orient}-facing, ${matName(opt.recommended.design.wall.materialId)} wall
        with ${opt.recommended.params.insul}mm insulation, ${matName(opt.recommended.params.glz)} glazing, thermal score
        <b>${opt.recommended.score.total.toFixed(0)}/100</b>.` : "Run Optimization to generate a recommended configuration."}</p>
        <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:12px;">
          <button class="btn btn-accent btn-sm" id="viewDetailedBtn">View Detailed Analysis</button>
          <button class="btn btn-sm" id="compareDesignsBtn">Compare Designs</button>
          <button class="btn btn-sm" id="generateReportBtn">Generate Report</button>
        </div>
      </div>
      ` : `<div class="card"><p class="subtitle">Run a simulation (and optimization) to populate this summary.</p></div>`}
    `;
    if (result) CH.scoreGauge(U.qs("#evalGauge", root), result.scores.thermalComfortScore);
    U.on("#viewDetailedBtn", "click", () => window.APP.navigate("simulation"), root);
    U.on("#compareDesignsBtn", "click", () => window.APP.navigate("optimization"), root);
    U.on("#generateReportBtn", "click", () => window.APP.navigate("reports"), root);
  };

  // ---------------------------------------------------------------------
  UI.renderSettings = function (root) {
    const s = STORE.get();
    root.innerHTML = `
      <h1>Settings</h1>
      <div class="grid grid-2">
        <div class="card">
          <h3>Mode</h3>
          <p>Simple Mode hides advanced engineering fields. Advanced Mode exposes full parameter control.
          Toggle in the sidebar.</p>
          <h3 style="margin-top:16px;">Units</h3>
          <ul class="assumption-list">
            ${Object.entries(CFG.UNITS).map(([k,v]) => `<li>${k}: <b>${v}</b></li>`).join("")}
          </ul>
        </div>
        <div class="card">
          <h3>Assumptions &amp; Limitations</h3>
          <ul class="assumption-list">
            <li>Transient (hourly RC) model, not steady-state.</li>
            <li>Outside film coefficient: 23 W/m²K, wind-adjusted infiltration.</li>
            <li>Sky longwave radiation folded into the sol-air simplification (no separate term).</li>
            <li>Ground temperature defaults to seasonal mean ambient unless overridden.</li>
            <li>Internal gains constant-per-hour unless an occupancy schedule is supplied.</li>
            <li>PCM modelled via elevated apparent specific heat over its melt band.</li>
            <li>Weather is user-provided or a labelled "Demo / illustrative" dataset — never field-measured.</li>
          </ul>
        </div>
      </div>
      <div class="card" style="margin-top:16px;">
        <h3>Project</h3>
        <div class="form-row"><label>Project name</label><input id="projNameInput" value="${U.esc(s.project.name)}"></div>
        <button class="btn btn-sm" id="saveProjNameBtn">Save name</button>
        <button class="btn btn-sm" id="resetProjectBtn" style="margin-left:8px;color:var(--bad);">Reset project (clears all data)</button>
      </div>
    `;
    U.on("#saveProjNameBtn", "click", () => { s.project.name = U.qs("#projNameInput", root).value; STORE.save(); window.APP.render(); }, root);
    U.on("#resetProjectBtn", "click", () => {
      if (confirm("This clears all simulations, designs, and validation data in this browser session. Continue?")) {
        STORE.reset(); window.APP.render();
      }
    }, root);
  };
})();
