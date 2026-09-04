/* AreaTherm UI — Dashboard, Location & Climate, Shelter Designer, Materials */
window.UI = window.UI || {};

(function () {
  const CFG = window.APP_CONFIG, DATA = window.APP_DATA, ENGINE = window.APP_ENGINE, STORE = window.APP_STORE, CH = window.APP_CHARTS;

  const heroHtml = (compact) => `
    <div class="hero" style="${compact ? "padding:22px 28px;" : ""}">
      <span class="tag tag-model" style="margin-bottom:10px;">Physics-based decision-support platform</span>
      <h1 style="${compact ? "font-size:20px;" : ""}">Design Shelters for the Climate Around Them.</h1>
      <p>An area-specific, physics-based software platform for predicting thermal performance and
      optimizing passive shelter design — starting with Ladakh.</p>
      ${compact ? "" : `<div class="flow">
        <span class="step">CLIMATE</span><span class="arrow">↓</span>
        <span class="step">DESIGN</span><span class="arrow">↓</span>
        <span class="step">MATERIALS</span><span class="arrow">↓</span>
        <span class="step">SIMULATION</span><span class="arrow">↓</span>
        <span class="step">OPTIMIZATION</span><span class="arrow">↓</span>
        <span class="step">RECOMMENDATION</span>
      </div>`}
      <div class="cta-row">
        <button class="btn btn-accent" id="heroDemoBtn">▶ Run Live Demo</button>
        <button class="btn" id="heroWorkflowBtn" style="background:transparent;border-color:rgba(255,255,255,.4);color:#fff;">Start Guided Setup →</button>
      </div>
    </div>`;

  UI.renderDashboard = function (root) {
    const s = STORE.get();
    const last = s.lastSimulationResult;
    const hist = s.simulationHistory;
    const avgScore = hist.length ? (hist.reduce((a, h) => a + h.thermalComfortScore, 0) / hist.length) : null;
    const bestOpt = s.lastOptimizationResult ? s.lastOptimizationResult.recommended : null;
    const uniqueLocations = new Set(hist.map(h => h.locationLabel)).size;

    root.innerHTML = `
      ${heroHtml(hist.length > 0)}

      <!-- Primary metrics: the 4 numbers that matter most at a glance -->
      <div class="grid grid-4" style="margin-bottom:18px;">
        <div class="card" style="display:flex; align-items:center; gap:14px;">
          <div id="dashGauge"></div>
          <div><div class="metric-label">Thermal Comfort Score</div>
            <div class="metric-sub">${last ? "Model Prediction" : "Run a simulation to populate"}</div></div>
        </div>
        <div class="card metric-card"><div class="metric-label">Solar Gain</div><div class="metric-value">${last ? last.daily.solarKwh : "—"}</div><div class="metric-sub">kWh/day ${last ? '<span class="tag tag-model">model</span>' : ""}</div></div>
        <div class="card metric-card"><div class="metric-label">Heat Loss</div><div class="metric-value">${last ? last.daily.totalLossKwh : "—"}</div><div class="metric-sub">kWh/day ${last ? '<span class="tag tag-model">model</span>' : ""}</div></div>
        <div class="card metric-card"><div class="metric-label">Avg. Indoor Temp</div><div class="metric-value">${last ? last.comfort.avgIndoor : "—"}</div><div class="metric-sub">°C ${last ? '<span class="tag tag-model">model</span>' : ""}</div></div>
      </div>

      ${s.location ? `<div class="card" style="margin-bottom:18px;">
          ${U.badge(s.climateSource)} <span class="hint">for ${U.esc(s.location.label)}</span>
          ${s.location.solarDataSource ? `<div class="hint" style="margin-top:6px;">Solar potential: <b>${s.location.annualSolarKwhM2Yr} kWh/m²/yr</b> · Avg. temp: <b>${s.location.avgTempCAnnual}°C</b> — NASA POWER (${U.esc(s.location.solarDataSource.period)})</div>` : ""}
        </div>` : ""}

      <button class="collapse-toggle" id="advToggle">
        <span class="chev">▾</span> Detailed Analytics
      </button>
      <div class="collapse-body" id="advBody">
        <div class="grid grid-4" style="margin-bottom:18px;">
          <div class="card metric-card"><div class="metric-label">Total Simulations</div><div class="metric-value">${hist.length}</div><div class="metric-sub">this session</div></div>
          <div class="card metric-card"><div class="metric-label">Locations Analysed</div><div class="metric-value">${uniqueLocations || (s.location ? 1 : 0)}</div><div class="metric-sub">${s.location ? U.esc(s.location.label) : "none selected"}</div></div>
          <div class="card metric-card"><div class="metric-label">Best Performing Design</div><div class="metric-value">${bestOpt ? bestOpt.score.total.toFixed(0) : "—"}</div><div class="metric-sub">${bestOpt ? "Design " + bestOpt.label + " (optimization run)" : "run optimization"}</div></div>
          <div class="card metric-card"><div class="metric-label">Avg. Thermal Comfort Score</div><div class="metric-value">${avgScore != null ? avgScore.toFixed(0) : "—"}</div><div class="metric-sub">across ${hist.length} run(s)</div></div>
        </div>
        <div class="grid grid-2">
          <div class="card">
            <h3>Comfort Score Breakdown</h3>
            ${last ? `<ul class="checklist" style="font-size:12.5px;">
                <li>Daytime comfort: <b>${last.comfort.dayComfortPct.toFixed(0)}%</b></li>
                <li>Night comfort: <b>${last.comfort.nightComfortPct.toFixed(0)}%</b></li>
                <li>Solar utilization: <b>${last.scores.solarUtilizationPct.toFixed(0)}%</b></li>
                <li>Heat retention: <b>${last.scores.heatRetentionPct.toFixed(0)}%</b></li>
              </ul>` : `<p class="subtitle">Run a thermal simulation to populate the comfort score.</p>`}
          </div>
          <div class="card">
            <h3>Recent Simulations</h3>
            ${hist.length ? `<div class="table-wrap"><table><thead><tr><th>ID</th><th>Location</th><th>Design</th><th>Score</th></tr></thead><tbody>
              ${hist.slice(0, 6).map(h => `<tr><td style="font-family:var(--mono);font-size:11px;">${h.id}</td><td>${U.esc(h.locationLabel)}</td><td>${U.esc(h.designName)}</td><td class="num">${h.thermalComfortScore}</td></tr>`).join("")}
            </tbody></table></div>` : `<p class="subtitle">No simulations yet. Try Guided Setup or the live demo.</p>`}
          </div>
        </div>
      </div>`;

    CH.scoreGauge(U.qs("#dashGauge", root), last ? last.scores.thermalComfortScore : 0);
    U.on("#heroDemoBtn", "click", () => window.APP.runLiveDemo(), root);
    U.on("#heroWorkflowBtn", "click", () => window.APP.navigate("guided"), root);
    U.on("#advToggle", "click", () => {
      U.qs("#advToggle", root).classList.toggle("open");
      U.qs("#advBody", root).classList.toggle("open");
    }, root);
  };

  // ---------------------------------------------------------------------
  function locationSelectOptions(selectedId) {
    return DATA.PREDEFINED_LOCATIONS.map(l =>
      `<option value="${l.id}" ${selectedId === l.id ? "selected" : ""}>${l.name} — ${l.elevationM}m (${l.category})</option>`
    ).join("");
  }

  function renderClimateSummary(root, s, season) {
    const box = U.qs("#climateSummaryBox", root);
    if (!box) return;
    if (!season) { box.innerHTML = `<p class="subtitle">No climate loaded yet.</p>`; return; }
    const seasonKeys = s.location ? Object.keys(s.location.seasons) : [];
    const showSeasonPicker = seasonKeys.length > 1;
    box.innerHTML = `
      ${U.badge(s.climateSource)}
      ${showSeasonPicker ? `
      <div class="form-row" style="max-width:220px; margin-top:10px;"><label>Season</label>
        <select id="seasonSwitch">${seasonKeys.map(k => `<option value="${k}" ${s.seasonKey === k ? "selected" : ""}>${k}</option>`).join("")}</select>
      </div>` : ""}
      <div class="grid grid-4" style="margin-top:10px;">
        <div class="metric-card"><div class="metric-label">Ambient Temp Range</div><div class="metric-value" style="font-size:18px;">${season.tMin} to ${season.tMax} °C</div></div>
        <div class="metric-card"><div class="metric-label">Solar Irradiance</div><div class="metric-value" style="font-size:18px;">${season.solarKwhDay} kWh/m²/day</div></div>
        <div class="metric-card"><div class="metric-label">Sunshine Window</div><div class="metric-value" style="font-size:18px;">${season.sunrise}h – ${season.sunset}h</div></div>
        <div class="metric-card"><div class="metric-label">Wind / RH / Cloud</div><div class="metric-value" style="font-size:15px;">${season.windMs} m/s · ${season.rhPct}% · ${season.cloudPct}%</div></div>
      </div>
      ${s.location && s.location.solarDataSource ? `
      <div class="data-badge real" style="margin-top:10px;">✓ Annual solar potential: <b>${U.esc(String(s.location.annualSolarKwhM2Yr))} kWh/m²/yr</b>
        (GHI ${s.location.solarDataSource.ghiKwhM2DayAnnual.toFixed(2)} kWh/m²/day, DNI ${s.location.solarDataSource.dniKwhM2DayAnnual.toFixed(2)} kWh/m²/day)
        — ${U.esc(s.location.solarDataSource.label)}, ${U.esc(s.location.solarDataSource.period)}</div>
      ` : (s.climateSource && s.climateSource.type === "REAL" ? `
      <div class="data-badge illustrative" style="margin-top:10px;">⚠ Annual solar figure (${s.location.annualSolarKwhM2Yr} kWh/m²/yr) is extrapolated from the current 7-day forecast, not a real climatology — NASA POWER climatology fetch unavailable.</div>
      ` : "")}
      <h3 style="margin-top:16px;">24-Hour Ambient Temperature &amp; Solar Irradiance ${season.hourly ? "(live hourly curve)" : "(model input curve)"}</h3>
      <div id="climateChart"></div>`;
    const hours = Array.from({ length: 25 }, (_, i) => i);
    CH.lineChart(U.qs("#climateChart", box), [
      { name: "Ambient Temp (°C)", color: "#c93b3b", data: hours.map(h => ({ x: h, y: ENGINE.ambientTempAt(season, h) })) }
    ], { height: 200, yLabel: "°C", xLabel: "Hour of day" });
    const solarDiv = document.createElement("div");
    solarDiv.style.marginTop = "10px";
    U.qs("#climateChart", box).appendChild(solarDiv);
    CH.lineChart(solarDiv, [
      { name: "Solar Irradiance (W/m²)", color: "#d98a12", data: hours.map(h => ({ x: h, y: ENGINE.solarIrradianceAt(season, h) })) }
    ], { height: 180, yLabel: "W/m²", xLabel: "Hour of day" });
    U.on("#seasonSwitch", "change", () => {
      s.seasonKey = U.qs("#seasonSwitch", box).value;
      STORE.save();
      window.APP.render();
    }, box);
  }

  UI.renderLocation = function (root) {
    const s = STORE.get();
    const loc = s.location;
    const season = STORE.currentSeason();

    root.innerHTML = `
      <h1>Location &amp; Climate Profile</h1>
      <p class="subtitle">Pick any of 10 reference locations and load its live weather.</p>

      <div class="card">
        <h3>Select Location</h3>
        <div class="form-inline">
          <div class="form-row" style="flex:2;"><label>Reference location</label>
            <select id="locSelect">${locationSelectOptions(loc ? loc.key : null)}</select>
          </div>
        </div>
        <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
          <button class="btn btn-accent" id="loadRealBtn">🌐 Load Real Weather (Open-Meteo)</button>
          <span id="fetchStatus" class="hint"></span>
        </div>
        <p class="hint" style="margin-top:10px;">Live weather from
        <a href="https://open-meteo.com" target="_blank" rel="noopener" style="color:var(--accent);">Open-Meteo</a>
        (no API key, cached 7 days) — a 7-day forecast averaged into a typical-day curve — plus real 20-year
        solar/temperature climatology from <a href="https://power.larc.nasa.gov" target="_blank" rel="noopener"
        style="color:var(--accent);">NASA POWER</a>. No hand-authored or illustrative climate data ships with
        this app; every number here comes from a live source.</p>
      </div>

      <div class="card" style="margin-top:16px;">
        <h3>Location Details</h3>
        <div class="grid grid-4">
          <div class="metric-card"><div class="metric-label">Name</div><div class="metric-value" style="font-size:16px;">${loc ? U.esc(loc.label) : "—"}</div></div>
          <div class="metric-card"><div class="metric-label">Region</div><div class="metric-value" style="font-size:16px;">${loc ? U.esc(loc.state) : "—"}</div></div>
          <div class="metric-card"><div class="metric-label">Coordinates</div><div class="metric-value" style="font-size:14px;">${loc ? loc.latitude.toFixed(3) + ", " + loc.longitude.toFixed(3) : "—"}</div></div>
          <div class="metric-card"><div class="metric-label">Elevation</div><div class="metric-value" style="font-size:16px;">${loc ? loc.elevationM + " m" : "—"}</div></div>
        </div>
      </div>

      <div class="card" style="margin-top:16px;" id="climateSummaryBox"></div>

      <div class="card" style="margin-top:16px;">
        <h3>Comfort Requirement</h3>
        <div class="form-inline">
          <div class="form-row"><label>Comfort profile</label>
            <select id="comfortProfile">${DATA.COMFORT_PROFILES.map(c => `<option value="${c.id}" ${s.design.comfort.profileId === c.id ? "selected" : ""}>${c.label}</option>`).join("")}</select>
          </div>
          <div class="form-row"><label>Min comfortable temp (°C)</label><input id="comfortMin" type="number" value="${s.design.comfort.min}"></div>
          <div class="form-row"><label>Max comfortable temp (°C)</label><input id="comfortMax" type="number" value="${s.design.comfort.max}"></div>
        </div>
        <p class="hint">Comfort range is not universally fixed — it depends on occupancy type (human, livestock,
        produce, seed storage, nursery, equipment). Select a profile or enter a custom range.</p>
        <button class="btn btn-accent btn-sm" id="saveComfortBtn">Save comfort requirement</button>
      </div>`;

    renderClimateSummary(root, s, season);

    U.on("#loadRealBtn", "click", async () => {
      const id = U.qs("#locSelect", root).value;
      const btn = U.qs("#loadRealBtn", root);
      const statusEl = U.qs("#fetchStatus", root);
      btn.disabled = true;
      statusEl.textContent = "Fetching live weather from Open-Meteo…";
      try {
        await STORE.loadRealClimate(id);
        window.APP.render();
        window.APP.toast("Live weather loaded from Open-Meteo.");
      } catch (e) {
        statusEl.textContent = "";
        alert("Could not fetch live weather: " + e.message + "\n\nCheck your internet connection and try again.");
        btn.disabled = false;
      }
    }, root);

    U.on("#saveComfortBtn", "click", () => {
      const profileId = U.qs("#comfortProfile", root).value;
      const min = parseFloat(U.qs("#comfortMin", root).value);
      const max = parseFloat(U.qs("#comfortMax", root).value);
      STORE.updateDesign({ comfort: { profileId, min, max } });
      window.APP.toast("Comfort requirement saved.");
    }, root);
    U.on("#comfortProfile", "change", () => {
      const p = DATA.COMFORT_PROFILES.find(c => c.id === U.qs("#comfortProfile", root).value);
      if (p) { U.qs("#comfortMin", root).value = p.min; U.qs("#comfortMax", root).value = p.max; }
    }, root);
  };

  // ---------------------------------------------------------------------
  const BEARING = { SOUTH: 180, SE: 135, EAST: 90, NE: 45, NORTH: 0, NW: 315, WEST: 270, SW: 225 };
  function bearingOf(design) {
    if (design.orientation === "CUSTOM") return (180 + (design.azimuthDeg || 0)) % 360;
    return BEARING[design.orientation] ?? 180;
  }

  function drawShelterPreview(container, design, geom) {
    const size = 260, cx = size / 2, cy = size / 2;
    const scale = Math.min(180 / Math.max(geom.L, geom.W || geom.L), 6);
    const w = geom.W ? geom.L * scale : geom.L * scale;
    const h = geom.W ? geom.W * scale : geom.L * scale;
    const bearing = bearingOf(design);
    const isRound = ["CIRCULAR", "DOME", "SEMI_CIRCULAR"].includes(design.shape);
    let shapeSvg;
    if (isRound) {
      shapeSvg = `<circle cx="${cx}" cy="${cy}" r="${w / 2}" fill="#dfeef2" stroke="#1f8a9e" stroke-width="2"/>`;
    } else {
      shapeSvg = `<rect x="${cx - w / 2}" y="${cy - h / 2}" width="${w}" height="${h}" fill="#dfeef2" stroke="#1f8a9e" stroke-width="2"/>`;
    }
    // window mark on the FRONT face (rotated by bearing)
    const winMark = `<rect x="${cx - w * 0.18}" y="${cy - h / 2 - 4}" width="${w * 0.36}" height="8" fill="#2fb8cf"/>`;
    container.innerHTML = `
      <svg viewBox="0 0 ${size} ${size}" style="width:260px;height:260px;">
        <g transform="rotate(${bearing} ${cx} ${cy})">
          ${shapeSvg}
          ${winMark}
        </g>
        <text x="${cx}" y="14" text-anchor="middle" class="chart-tick" font-size="11">N ↑</text>
        <text x="${cx}" y="${size - 6}" text-anchor="middle" class="chart-tick" font-size="10">Top-down schematic — illustrative</text>
      </svg>`;
  }

  UI.renderDesigner = function (root) {
    const s = STORE.get();
    const d = s.design;
    const geom = ENGINE.computeGeometry(d);
    const wallOpts = DATA.materialsByCategory("WALL").map(m => `<option value="${m.id}" ${d.wall.materialId === m.id ? "selected" : ""}>${m.name}</option>`).join("");
    const roofOpts = DATA.materialsByCategory("ROOF").map(m => `<option value="${m.id}" ${d.roof.materialId === m.id ? "selected" : ""}>${m.name}</option>`).join("");
    const glazeOpts = DATA.materialsByCategory("WINDOW").map(m => `<option value="${m.id}" ${d.windows[0].glazingMaterialId === m.id ? "selected" : ""}>${m.name} (U=${m.uValue}, SHGC=${m.shgc})</option>`).join("");

    root.innerHTML = `
      <h1>Shelter Designer</h1>
      <p class="subtitle">Define geometry, orientation, and openings. Preview updates live.</p>
      <div class="grid grid-2">
        <div class="card">
          <fieldset>
            <legend>Geometry</legend>
            <div class="form-inline">
              <div class="form-row"><label>Shape</label>
                <select id="dShape">
                  ${["RECTANGULAR","SQUARE","CIRCULAR","DOME","SEMI_CIRCULAR","CUSTOM"].map(v => `<option value="${v}" ${d.shape===v?"selected":""}>${v.replace("_"," ")}</option>`).join("")}
                </select>
              </div>
            </div>
            <div class="form-inline" id="rectFields" style="${["CIRCULAR","DOME","SEMI_CIRCULAR"].includes(d.shape)?"display:none;":""}">
              <div class="form-row"><label>Length (m)</label><input id="dLength" type="number" step="0.1" value="${d.length}"></div>
              <div class="form-row"><label>Width (m)</label><input id="dWidth" type="number" step="0.1" value="${d.width}"></div>
              <div class="form-row"><label>Height (m)</label><input id="dHeight" type="number" step="0.1" value="${d.height}"></div>
            </div>
            <div class="form-inline" id="roundFields" style="${["CIRCULAR","DOME","SEMI_CIRCULAR"].includes(d.shape)?"":"display:none;"}">
              <div class="form-row"><label>Diameter (m)</label><input id="dDiameter" type="number" step="0.1" value="${d.diameter || 5}"></div>
              <div class="form-row"><label>Height (m)</label><input id="dHeight2" type="number" step="0.1" value="${d.height}"></div>
            </div>
          </fieldset>
          <fieldset>
            <legend>Orientation</legend>
            <div class="form-inline">
              <div class="form-row"><label>Primary facade orientation</label>
                <select id="dOrientation">
                  ${["SOUTH","SE","EAST","NE","NORTH","NW","WEST","SW","CUSTOM"].map(v => `<option value="${v}" ${d.orientation===v?"selected":""}>${v}</option>`).join("")}
                </select>
              </div>
              <div class="form-row" id="azimuthRow" style="${d.orientation==="CUSTOM"?"":"display:none;"}"><label>Custom azimuth (° from South)</label><input id="dAzimuth" type="number" value="${d.azimuthDeg||0}"></div>
            </div>
          </fieldset>
          <fieldset>
            <legend>Openings</legend>
            <div class="form-inline">
              <div class="form-row"><label>Window area each (m²)</label><input id="dWinArea" type="number" step="0.1" value="${d.windows[0].areaEach}"></div>
              <div class="form-row"><label>Window count</label><input id="dWinCount" type="number" value="${d.windows[0].count}"></div>
              <div class="form-row"><label>Window face</label>
                <select id="dWinOrient">${["FRONT","BACK","LEFT","RIGHT"].map(v=>`<option ${d.windows[0].orientation===v?"selected":""}>${v}</option>`).join("")}</select>
              </div>
            </div>
            <div class="form-inline">
              <div class="form-row"><label>Glazing type</label><select id="dGlazing">${glazeOpts}</select></div>
              <div class="form-row"><label>Door area (m²)</label><input id="dDoorArea" type="number" step="0.1" value="${d.doors[0].areaEach}"></div>
              <div class="form-row"><label>Air leakage (ACH)</label><input id="dAch" type="number" step="0.1" value="${d.airLeakageAch}"></div>
            </div>
          </fieldset>
          <fieldset>
            <legend>Occupancy &amp; internal gain</legend>
            <div class="form-inline">
              <div class="form-row"><label>Occupancy (persons)</label><input id="dOccupancy" type="number" value="${d.occupancy}"></div>
              <div class="form-row"><label>Internal heat gain (W)</label><input id="dInternal" type="number" value="${d.internalHeatGainW}"></div>
            </div>
          </fieldset>
          <button class="btn btn-accent" id="saveDesignBtn">Save shelter design</button>
        </div>

        <div>
          <div class="card" style="text-align:center;">
            <h3>2D Preview (top-down)</h3>
            <div id="preview2d"></div>
          </div>
          <div class="card" style="margin-top:16px;">
            <h3>Derived Geometry <span class="tag tag-model">calculated</span></h3>
            <div class="grid grid-2">
              <div class="metric-card"><div class="metric-label">Floor Area</div><div class="metric-value" style="font-size:18px;">${geom.floorArea.toFixed(1)} m²</div></div>
              <div class="metric-card"><div class="metric-label">Volume</div><div class="metric-value" style="font-size:18px;">${geom.volume.toFixed(1)} m³</div></div>
              <div class="metric-card"><div class="metric-label">Wall Area</div><div class="metric-value" style="font-size:18px;">${geom.wallArea.toFixed(1)} m²</div></div>
              <div class="metric-card"><div class="metric-label">Roof Area</div><div class="metric-value" style="font-size:18px;">${geom.roofArea.toFixed(1)} m²</div></div>
            </div>
          </div>
        </div>
      </div>

      <div class="card" style="margin-top:16px;">
        <h3>Wall, Roof, Floor Construction &amp; Insulation</h3>
        <div class="grid grid-3">
          <fieldset><legend>Wall</legend>
            <div class="form-row"><label>Material</label><select id="dWallMat">${wallOpts}</select></div>
            <div class="form-row"><label>Thickness (mm)</label><input id="dWallThick" type="number" value="${d.wall.thicknessMm}"></div>
            <div class="form-row"><label>Insulation</label><select id="dWallInsMat">${DATA.materialsByCategory("INSULATION").map(m=>`<option value="${m.id}" ${d.wall.insulationMaterialId===m.id?"selected":""}>${m.name}</option>`).join("")}</select></div>
            <div class="form-row"><label>Insulation thickness (mm)</label><input id="dWallInsThick" type="number" value="${d.wall.insulationThicknessMm}"></div>
          </fieldset>
          <fieldset><legend>Roof</legend>
            <div class="form-row"><label>Material</label><select id="dRoofMat">${roofOpts}</select></div>
            <div class="form-row"><label>Thickness (mm)</label><input id="dRoofThick" type="number" value="${d.roof.thicknessMm}"></div>
            <div class="form-row"><label>Insulation</label><select id="dRoofInsMat">${DATA.materialsByCategory("INSULATION").map(m=>`<option value="${m.id}" ${d.roof.insulationMaterialId===m.id?"selected":""}>${m.name}</option>`).join("")}</select></div>
            <div class="form-row"><label>Insulation thickness (mm)</label><input id="dRoofInsThick" type="number" value="${d.roof.insulationThicknessMm}"></div>
          </fieldset>
          <fieldset><legend>Floor &amp; Thermal Mass</legend>
            <div class="form-row"><label>Floor material</label><select id="dFloorMat">${wallOpts}</select></div>
            <div class="form-row"><label>Thermal mass material</label><select id="dMassMat">
              <option value="">None</option>
              ${DATA.materialsByCategory("THERMAL_MASS").map(m=>`<option value="${m.id}" ${d.thermalMass && d.thermalMass.materialId===m.id?"selected":""}>${m.name}</option>`).join("")}
            </select></div>
            <div class="form-row"><label>Thermal mass (kg)</label><input id="dMassKg" type="number" value="${d.thermalMass?d.thermalMass.massKg:0}"></div>
          </fieldset>
        </div>
        <button class="btn btn-accent" id="saveMaterialsBtn">Save construction</button>
        <span class="hint">U-values (wall ${ENGINE.wallUValue(d).toFixed(2)} W/m²K · roof ${ENGINE.roofUValue(d).toFixed(2)} W/m²K · floor ${ENGINE.floorUValue(d).toFixed(2)} W/m²K) are calculated live from these layers.</span>
      </div>`;

    drawShelterPreview(U.qs("#preview2d", root), d, geom);

    U.on("#dShape", "change", () => {
      const v = U.qs("#dShape", root).value;
      U.qs("#rectFields", root).style.display = ["CIRCULAR","DOME","SEMI_CIRCULAR"].includes(v) ? "none" : "";
      U.qs("#roundFields", root).style.display = ["CIRCULAR","DOME","SEMI_CIRCULAR"].includes(v) ? "" : "none";
    }, root);
    U.on("#dOrientation", "change", () => {
      U.qs("#azimuthRow", root).style.display = U.qs("#dOrientation", root).value === "CUSTOM" ? "" : "none";
    }, root);

    U.on("#saveDesignBtn", "click", () => {
      const shape = U.qs("#dShape", root).value;
      const patch = {
        shape,
        length: parseFloat(U.qs("#dLength", root).value) || d.length,
        width: parseFloat(U.qs("#dWidth", root).value) || d.width,
        height: parseFloat((U.qs("#dHeight", root)||U.qs("#dHeight2",root)).value) || d.height,
        diameter: parseFloat(U.qs("#dDiameter", root) ? U.qs("#dDiameter", root).value : d.diameter) || d.diameter,
        orientation: U.qs("#dOrientation", root).value,
        azimuthDeg: parseFloat(U.qs("#dAzimuth", root).value) || 0,
        airLeakageAch: parseFloat(U.qs("#dAch", root).value),
        occupancy: parseInt(U.qs("#dOccupancy", root).value) || 0,
        internalHeatGainW: parseFloat(U.qs("#dInternal", root).value) || 0,
        windows: [{ areaEach: parseFloat(U.qs("#dWinArea", root).value), count: parseInt(U.qs("#dWinCount", root).value), orientation: U.qs("#dWinOrient", root).value, glazingMaterialId: U.qs("#dGlazing", root).value }],
        doors: [{ areaEach: parseFloat(U.qs("#dDoorArea", root).value), count: 1 }]
      };
      STORE.updateDesign(patch);
      window.APP.render();
      window.APP.toast("Shelter design saved.");
    }, root);

    U.on("#saveMaterialsBtn", "click", () => {
      const massMatId = U.qs("#dMassMat", root).value;
      const massKg = parseFloat(U.qs("#dMassKg", root).value) || 0;
      STORE.updateDesign({
        wall: { materialId: U.qs("#dWallMat", root).value, thicknessMm: parseFloat(U.qs("#dWallThick", root).value), insulationMaterialId: U.qs("#dWallInsMat", root).value, insulationThicknessMm: parseFloat(U.qs("#dWallInsThick", root).value) },
        roof: { materialId: U.qs("#dRoofMat", root).value, thicknessMm: parseFloat(U.qs("#dRoofThick", root).value), insulationMaterialId: U.qs("#dRoofInsMat", root).value, insulationThicknessMm: parseFloat(U.qs("#dRoofInsThick", root).value) },
        floor: { materialId: U.qs("#dFloorMat", root).value, thicknessMm: 100 },
        thermalMass: massMatId && massKg > 0 ? { materialId: massMatId, massKg, surfaceAreaM2: Math.min(geom.floorArea, massKg / 300) } : null
      });
      window.APP.render();
      window.APP.toast("Construction saved.");
    }, root);
  };

  // ---------------------------------------------------------------------
  UI.renderMaterials = function (root) {
    const cats = ["WALL", "ROOF", "INSULATION", "THERMAL_MASS", "WINDOW"];
    const tableFor = cat => {
      const rows = DATA.materialsByCategory(cat);
      const isWindow = cat === "WINDOW", isMass = cat === "THERMAL_MASS";
      return `<div class="table-wrap"><table><thead><tr>
          <th>Name</th>${isWindow ? "<th>U-value (W/m²K)</th><th>SHGC</th>" : "<th>Density (kg/m³)</th><th>k (W/mK)</th><th>Cp (J/kgK)</th>"}
          <th>Absorptivity</th><th>${isMass ? "Cost (₹/kg)" : "Cost (₹/m²)"}</th><th>Sustainability</th>
        </tr></thead><tbody>
        ${rows.map(m => `<tr>
          <td>${U.esc(m.name)}</td>
          ${isWindow ? `<td class="num">${m.uValue}</td><td class="num">${m.shgc}</td>` : `<td class="num">${m.density||"—"}</td><td class="num">${m.k||"—"}</td><td class="num">${m.cp||"—"}</td>`}
          <td class="num">${m.absorptivity ?? "—"}</td>
          <td class="num">${isMass ? (m.costPerKg??"—") : (m.costPerM2??"—")}</td>
          <td>${m.sustainability}</td>
        </tr>`).join("")}
        </tbody></table></div>`;
    };

    root.innerHTML = `
      <h1>Material Database</h1>
      <p class="subtitle"><span class="tag tag-demo">Engineering database value</span> — typical/handbook reference
      properties. Verify for actual construction/material specification before field use. Values are configurable.</p>
      ${cats.map(c => `<div class="card" style="margin-bottom:16px;"><h3>${c.replace("_"," ")}</h3>${tableFor(c)}</div>`).join("")}

      <div class="card">
        <h3>Add Custom Material</h3>
        <div class="form-inline">
          <div class="form-row"><label>Category</label><select id="cmCat">${cats.map(c=>`<option value="${c}">${c}</option>`).join("")}</select></div>
          <div class="form-row"><label>Name</label><input id="cmName" placeholder="e.g. Local yak-wool felt"></div>
          <div class="form-row"><label>Density (kg/m³)</label><input id="cmDensity" type="number"></div>
          <div class="form-row"><label>k (W/mK)</label><input id="cmK" type="number" step="0.001"></div>
          <div class="form-row"><label>Cp (J/kgK)</label><input id="cmCp" type="number"></div>
        </div>
        <button class="btn btn-accent btn-sm" id="addMaterialBtn">Add material</button>
        <span class="hint">Custom materials are marked <b>user-provided</b>, not pre-validated engineering values.</span>
      </div>`;

    U.on("#addMaterialBtn", "click", () => {
      const cat = U.qs("#cmCat", root).value, name = U.qs("#cmName", root).value.trim();
      if (!name) { alert("Enter a material name."); return; }
      DATA.MATERIALS.push({
        id: "custom_" + Date.now(), category: cat, name,
        density: parseFloat(U.qs("#cmDensity", root).value) || null,
        k: parseFloat(U.qs("#cmK", root).value) || null,
        cp: parseFloat(U.qs("#cmCp", root).value) || null,
        absorptivity: 0.6, reflectivity: 0.4, emissivity: 0.9,
        costPerM2: 1000, costPerKg: 5, sustainability: "MEDIUM", isCustom: true
      });
      window.APP.render();
      window.APP.toast("Custom material added (user-provided — not a validated engineering value).");
    }, root);
  };

  // =======================================================================
  // Guided Setup — a simplified 5-step wizard for non-engineers. Advanced
  // fields (shape, azimuth, per-face windows, etc.) are skipped here; use
  // Shelter Designer / Materials directly for full control.
  // =======================================================================
  const GUIDED_STEPS = ["Location", "Shelter", "Materials", "Comfort", "Run"];
  let guidedStep = 1;

  function guidedStepBar(current) {
    return `<div class="wizard-steps">${GUIDED_STEPS.map((label, i) => {
      const n = i + 1;
      const cls = n === current ? "active" : n < current ? "done" : "";
      return `<div class="wizard-step ${cls}"><span class="num">${n < current ? "✓" : n}</span>${label}</div>`;
    }).join("")}</div>`;
  }

  function guidedNav(root, canNext, nextLabel) {
    return `<div class="wizard-nav">
      <button class="btn" id="guidedBack" ${guidedStep === 1 ? "disabled" : ""}>← Back</button>
      <button class="btn btn-accent" id="guidedNext" ${canNext ? "" : "disabled"}>${nextLabel || "Next →"}</button>
    </div>`;
  }

  function wireGuidedNav(root, onNext) {
    U.on("#guidedBack", "click", () => { guidedStep = Math.max(1, guidedStep - 1); window.APP.render(); }, root);
    U.on("#guidedNext", "click", onNext, root);
  }

  UI.renderGuided = function (root) {
    const s = STORE.get();
    if (guidedStep === 1) return renderGuidedLocation(root, s);
    if (guidedStep === 2) return renderGuidedShelter(root, s);
    if (guidedStep === 3) return renderGuidedMaterials(root, s);
    if (guidedStep === 4) return renderGuidedComfort(root, s);
    return renderGuidedRun(root, s);
  };

  function renderGuidedLocation(root, s) {
    const loc = s.location;
    root.innerHTML = `
      <h1>Guided Setup</h1>
      ${guidedStepBar(1)}
      <div class="card">
        <h3>Step 1 — Select a Location</h3>
        <div class="form-row" style="max-width:420px;"><label>Reference location</label>
          <select id="gLocSelect">${locationSelectOptions(loc ? loc.key : null)}</select>
        </div>
        <button class="btn btn-accent" id="gLoadReal">🌐 Load Real Weather (Open-Meteo)</button>
        <span id="gFetchStatus" class="hint" style="margin-left:8px;"></span>
        <div id="gClimateBox" style="margin-top:14px;">${loc ? U.badge(s.climateSource) : `<p class="subtitle">No climate loaded yet — click "Load Real Weather" above.</p>`}</div>
      </div>
      ${guidedNav(root, !!s.location)}`;

    U.on("#gLoadReal", "click", async () => {
      const id = U.qs("#gLocSelect", root).value;
      const btn = U.qs("#gLoadReal", root);
      btn.disabled = true;
      U.qs("#gFetchStatus", root).textContent = "Fetching live weather…";
      try {
        await STORE.loadRealClimate(id);
        window.APP.render();
      } catch (e) {
        U.qs("#gFetchStatus", root).textContent = "";
        alert("Could not fetch live weather: " + e.message + "\n\nCheck your internet connection and try again.");
        btn.disabled = false;
      }
    }, root);
    wireGuidedNav(root, () => { guidedStep = 2; window.APP.render(); });
  }

  function renderGuidedShelter(root, s) {
    const d = s.design;
    root.innerHTML = `
      <h1>Guided Setup</h1>
      ${guidedStepBar(2)}
      <div class="grid grid-2">
        <div class="card">
          <h3>Step 2 — Define Your Shelter</h3>
          <div class="form-inline">
            <div class="form-row"><label>Length (m)</label><input id="gLength" type="number" step="0.1" value="${d.length}"></div>
            <div class="form-row"><label>Width (m)</label><input id="gWidth" type="number" step="0.1" value="${d.width}"></div>
            <div class="form-row"><label>Height (m)</label><input id="gHeight" type="number" step="0.1" value="${d.height}"></div>
          </div>
          <div class="form-row"><label>Facing direction</label>
            <select id="gOrientation">${["SOUTH","EAST","NORTH","WEST"].map(v => `<option value="${v}" ${d.orientation===v?"selected":""}>${v}</option>`).join("")}</select>
          </div>
          <p class="hint">South-facing generally captures the most winter sun in the Northern Hemisphere.</p>
        </div>
        <div class="card" style="text-align:center;">
          <h3>Live Preview</h3>
          <div id="gPreview"></div>
        </div>
      </div>
      ${guidedNav(root, true)}`;

    function refreshPreview() {
      const patch = {
        length: parseFloat(U.qs("#gLength", root).value) || d.length,
        width: parseFloat(U.qs("#gWidth", root).value) || d.width,
        height: parseFloat(U.qs("#gHeight", root).value) || d.height,
        orientation: U.qs("#gOrientation", root).value, shape: "RECTANGULAR"
      };
      const previewDesign = { ...d, ...patch };
      drawShelterPreview(U.qs("#gPreview", root), previewDesign, ENGINE.computeGeometry(previewDesign));
      return patch;
    }
    refreshPreview();
    ["#gLength", "#gWidth", "#gHeight", "#gOrientation"].forEach(sel => U.on(sel, "input", refreshPreview, root));

    wireGuidedNav(root, () => {
      STORE.updateDesign(refreshPreview());
      guidedStep = 3; window.APP.render();
    });
  }

  const MATERIAL_PRESETS = {
    wall: [
      { id: "wall_stone", label: "Local Stone (Default)", sub: "Traditional, thermal mass" },
      { id: "wall_composite", label: "Composite Insulated", sub: "Better insulation, higher cost" },
      { id: "wall_adobe", label: "Adobe", sub: "Low-cost, locally sourced" }
    ],
    roof: [
      { id: "roof_rcc", label: "RCC Slab (Default)", sub: "Standard concrete roof" },
      { id: "roof_insulated_metal", label: "Insulated Metal", sub: "Lightweight, PUF core" },
      { id: "roof_composite", label: "Composite Roof", sub: "Metal + rockwool + ply" }
    ],
    insulation: [50, 75, 100]
  };

  function renderGuidedMaterials(root, s) {
    const d = s.design;
    root.innerHTML = `
      <h1>Guided Setup</h1>
      ${guidedStepBar(3)}
      <div class="card">
        <h3>Step 3 — Choose Materials</h3>
        <h3 style="margin-top:14px;">Wall</h3>
        <div class="preset-row">${MATERIAL_PRESETS.wall.map(p => `
          <button class="preset-btn ${d.wall.materialId === p.id ? "selected" : ""}" data-wall="${p.id}">
            <span class="t">${p.label}</span><span class="s">${p.sub}</span></button>`).join("")}</div>
        <h3 style="margin-top:14px;">Roof</h3>
        <div class="preset-row">${MATERIAL_PRESETS.roof.map(p => `
          <button class="preset-btn ${d.roof.materialId === p.id ? "selected" : ""}" data-roof="${p.id}">
            <span class="t">${p.label}</span><span class="s">${p.sub}</span></button>`).join("")}</div>
        <h3 style="margin-top:14px;">Insulation Thickness</h3>
        <div class="preset-row">${MATERIAL_PRESETS.insulation.map(mm => `
          <button class="preset-btn ${d.wall.insulationThicknessMm === mm ? "selected" : ""}" data-ins="${mm}" style="min-width:90px;text-align:center;">
            <span class="t">${mm} mm</span></button>`).join("")}</div>
        <p class="hint" style="margin-top:8px;">Need a custom material or thickness? Use the full <a href="#/designer" style="color:var(--accent);font-weight:600;">Shelter Designer</a> instead.</p>
      </div>
      ${guidedNav(root, true)}`;

    U.qsa("[data-wall]", root).forEach(b => b.addEventListener("click", () => {
      STORE.updateDesign({ wall: { ...d.wall, materialId: b.dataset.wall } });
      window.APP.render();
    }));
    U.qsa("[data-roof]", root).forEach(b => b.addEventListener("click", () => {
      STORE.updateDesign({ roof: { ...d.roof, materialId: b.dataset.roof } });
      window.APP.render();
    }));
    U.qsa("[data-ins]", root).forEach(b => b.addEventListener("click", () => {
      const mm = parseInt(b.dataset.ins);
      STORE.updateDesign({
        wall: { ...d.wall, insulationMaterialId: d.wall.insulationMaterialId || "ins_puf", insulationThicknessMm: mm },
        roof: { ...d.roof, insulationMaterialId: d.roof.insulationMaterialId || "ins_puf", insulationThicknessMm: mm }
      });
      window.APP.render();
    }));
    wireGuidedNav(root, () => { guidedStep = 4; window.APP.render(); });
  }

  function renderGuidedComfort(root, s) {
    const c = s.design.comfort;
    root.innerHTML = `
      <h1>Guided Setup</h1>
      ${guidedStepBar(4)}
      <div class="card">
        <h3>Step 4 — Set Comfort Range</h3>
        <div class="form-row" style="max-width:340px;"><label>What is this shelter for?</label>
          <select id="gComfortProfile">${DATA.COMFORT_PROFILES.map(p => `<option value="${p.id}" ${c.profileId===p.id?"selected":""}>${p.label}</option>`).join("")}</select>
        </div>
        <div class="form-inline">
          <div class="form-row"><label>Min comfortable temp (°C)</label><input id="gMin" type="number" value="${c.min}"></div>
          <div class="form-row"><label>Max comfortable temp (°C)</label><input id="gMax" type="number" value="${c.max}"></div>
        </div>
      </div>
      ${guidedNav(root, true, "Continue to Run →")}`;

    U.on("#gComfortProfile", "change", () => {
      const p = DATA.COMFORT_PROFILES.find(x => x.id === U.qs("#gComfortProfile", root).value);
      if (p) { U.qs("#gMin", root).value = p.min; U.qs("#gMax", root).value = p.max; }
    }, root);

    wireGuidedNav(root, () => {
      STORE.updateDesign({ comfort: {
        profileId: U.qs("#gComfortProfile", root).value,
        min: parseFloat(U.qs("#gMin", root).value),
        max: parseFloat(U.qs("#gMax", root).value)
      } });
      guidedStep = 5; window.APP.render();
    });
  }

  function renderGuidedRun(root, s) {
    const d = s.design, season = STORE.currentSeason();
    root.innerHTML = `
      <h1>Guided Setup</h1>
      ${guidedStepBar(5)}
      <div class="card">
        <h3>Step 5 — Review &amp; Run</h3>
        <div class="grid grid-3">
          <div class="metric-card"><div class="metric-label">Location</div><div class="metric-value" style="font-size:15px;">${s.location ? U.esc(s.location.label) : "—"}</div></div>
          <div class="metric-card"><div class="metric-label">Shelter</div><div class="metric-value" style="font-size:15px;">${d.length}×${d.width}×${d.height}m, ${d.orientation}</div></div>
          <div class="metric-card"><div class="metric-label">Comfort Range</div><div class="metric-value" style="font-size:15px;">${d.comfort.min}–${d.comfort.max}°C</div></div>
        </div>
        <div style="margin-top:8px;">${U.badge(s.climateSource)}</div>
        <button class="btn btn-accent" id="gRunBtn" style="margin-top:16px;font-size:14px;padding:12px 24px;" ${season ? "" : "disabled"}>▶ Run Simulation</button>
        ${!season ? `<p class="hint">Go back to Step 1 and load a climate profile first.</p>` : ""}
        <div id="gRunStatus" class="hint" style="margin-top:8px;"></div>
      </div>
      <div class="wizard-nav"><button class="btn" id="guidedBack">← Back</button><span></span></div>`;

    U.on("#guidedBack", "click", () => { guidedStep = 4; window.APP.render(); }, root);
    U.on("#gRunBtn", "click", () => {
      const btn = U.qs("#gRunBtn", root);
      btn.disabled = true;
      U.qs("#gRunStatus", root).textContent = "Running thermal simulation and design optimization…";
      setTimeout(() => {
        const result = ENGINE.runSimulation(s.design, season, s.simConfig);
        STORE.recordSimulation(result);
        const opt = ENGINE.runOptimization(s.design, season, s.simConfig, s.weights);
        STORE.recordOptimization(opt);
        guidedStep = 1; // reset wizard for next time
        window.APP.navigate("evaluator");
        window.APP.toast("Simulation and optimization complete.");
      }, 30);
    }, root);
  }
})();
