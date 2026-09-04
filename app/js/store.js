/* AreaTherm — app state ("database") + localStorage persistence.
   Field names mirror DATABASE_SCHEMA.sql so a real API client is a
   drop-in replacement for this module (see ARCHITECTURE.md §2, §6). */

window.APP_STORE = (function () {
  const DATA = window.APP_DATA;
  const KEY = "areatherm_state_v1";

  function defaultDesign() {
    return {
      name: "Baseline Shelter",
      shape: "RECTANGULAR",
      length: 6, width: 4, height: 3,
      orientation: "EAST", azimuthDeg: 90,
      wall: { materialId: "wall_stone", thicknessMm: 400, insulationMaterialId: "ins_puf", insulationThicknessMm: 50 },
      roof: { materialId: "roof_rcc", thicknessMm: 150, insulationMaterialId: "ins_puf", insulationThicknessMm: 50 },
      floor: { materialId: "wall_concrete", thicknessMm: 100 },
      windows: [{ areaEach: 2.4, count: 1, orientation: "FRONT", glazingMaterialId: "glaze_double" }],
      doors: [{ areaEach: 1.8, count: 1 }],
      airLeakageAch: 0.8,
      thermalMass: { materialId: "mass_stone", massKg: 800, surfaceAreaM2: 6 },
      occupancy: 2,
      internalHeatGainW: 150,
      groundTempC: null,
      comfort: { profileId: "human", min: 18, max: 27 }
    };
  }

  function freshState() {
    return {
      project: { name: "Untitled Project", createdAt: new Date().toISOString() },
      locationKey: null,
      location: null,
      seasonKey: "Winter",
      climateSource: null, // { type: 'REAL', apiSource, label, period, fetchedAt }
      design: defaultDesign(),
      simConfig: { timeStepMinutes: 60, periodType: "24H", days: 1 },
      weights: { ...window.APP_CONFIG.DEFAULT_WEIGHTS },
      mode: "SIMPLE",
      simulationHistory: [], // [{id, ts, locationLabel, designName, thermalComfortScore}]
      lastSimulationResult: null,
      lastOptimizationResult: null,
      validationDatasets: [] // [{id, name, points:[{ts,ambient,measured,predicted,...}], stats}]
    };
  }

  let state = load() || freshState();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* storage unavailable */ }
  }

  function get() { return state; }
  function reset() { state = freshState(); save(); return state; }

  // Fetches live weather (Open-Meteo) + real annual solar climatology
  // (NASA POWER, below) for a predefined location and stores it as a
  // single pseudo-season "Live" inside a {seasons:{...}} map, so every
  // screen that reads STORE.currentSeason() works unchanged.
  async function loadRealClimate(locationId) {
    const loc = DATA.predefinedLocationById(locationId);
    if (!loc) throw new Error("Unknown location: " + locationId);
    const climate = await window.APP_WEATHER.fetchOpenMeteo(loc.latitude, loc.longitude);
    state.locationKey = loc.id;
    state.location = {
      key: loc.id, label: loc.name,
      country: "India", state: loc.region, district: "",
      latitude: loc.latitude, longitude: loc.longitude,
      elevationM: climate.elevationM || loc.elevationM,
      // Extrapolated placeholder until/unless NASA POWER climatology (below)
      // supplies a real 20-year annual figure — kept only as a fallback.
      annualSolarKwhM2Yr: Math.round(climate.solarKwhDay * 365),
      avgSunshineHoursDay: Math.max(0, Math.round((climate.sunset - climate.sunrise) * 10) / 10),
      avgCloudFreeDays: Math.round(((100 - climate.cloudPct) / 100) * 365),
      solarDataSource: null, // set below if the NASA fetch succeeds
      seasons: { Live: climate }
    };
    state.seasonKey = "Live";
    state.climateSource = {
      type: "REAL", apiSource: "OPEN_METEO",
      label: "Open-Meteo (live)", period: climate.period, fetchedAt: climate.fetchedAt
    };
    state.project.name = `${loc.name} — Passive Shelter`;
    save();

    // NASA POWER gives real long-term climatology, not a forecast
    // extrapolation — a strictly better "annual solar potential" figure.
    // Fetched separately so a NASA outage never blocks the (higher
    // priority) Open-Meteo weather that actually drives the simulation.
    try {
      const nasa = await window.APP_NASA.fetchClimatology(loc.latitude, loc.longitude);
      state.location.annualSolarKwhM2Yr = nasa.annualSolarKwhM2Yr;
      state.location.avgTempCAnnual = nasa.tempCAnnual;
      state.location.solarDataSource = {
        label: nasa.label, period: nasa.period, fetchedAt: nasa.fetchedAt,
        ghiKwhM2DayAnnual: nasa.ghiKwhM2DayAnnual, dniKwhM2DayAnnual: nasa.dniKwhM2DayAnnual
      };
      save();
    } catch (e) {
      // Leave the Open-Meteo-derived extrapolation in place; UI labels it
      // as such whenever solarDataSource is null.
    }
    return state.location;
  }

  function currentSeason() {
    if (!state.location) return null;
    return state.location.seasons[state.seasonKey];
  }

  function updateDesign(patch) {
    state.design = { ...state.design, ...patch };
    save();
  }

  function recordSimulation(result) {
    state.lastSimulationResult = result;
    state.simulationHistory.unshift({
      id: "SIM-" + Date.now(),
      ts: new Date().toISOString(),
      locationLabel: state.location ? state.location.label : "Custom location",
      designName: state.design.name,
      thermalComfortScore: result.scores.thermalComfortScore
    });
    state.simulationHistory = state.simulationHistory.slice(0, 20);
    save();
  }

  function recordOptimization(result) {
    state.lastOptimizationResult = result;
    save();
  }

  function addValidationDataset(ds) {
    state.validationDatasets.unshift(ds);
    save();
  }

  return {
    get, save, reset, loadRealClimate,
    currentSeason, updateDesign,
    recordSimulation, recordOptimization, addValidationDataset, defaultDesign
  };
})();
