/* AreaTherm — router + bootstrap */
window.APP = (function () {
  const STORE = window.APP_STORE, ENGINE = window.APP_ENGINE, CFG = window.APP_CONFIG;
  const viewRoot = () => document.getElementById("viewRoot");

  const ROUTES = {
    dashboard: window.UI.renderDashboard,
    guided: window.UI.renderGuided,
    location: window.UI.renderLocation,
    designer: window.UI.renderDesigner,
    materials: window.UI.renderMaterials,
    simulation: window.UI.renderSimulation,
    optimization: window.UI.renderOptimization,
    whatif: window.UI.renderWhatIf,
    validation: window.UI.renderValidation,
    reports: window.UI.renderReport,
    evaluator: window.UI.renderEvaluator,
    settings: window.UI.renderSettings
  };

  function currentRoute() {
    const hash = location.hash.replace("#/", "");
    return ROUTES[hash] ? hash : "dashboard";
  }

  function render() {
    const route = currentRoute();
    document.querySelectorAll(".nav a").forEach(a => a.classList.toggle("active", a.dataset.route === route));
    document.getElementById("projectName").textContent = STORE.get().project.name;
    ROUTES[route](viewRoot());
    document.body.classList.toggle("mode-advanced", STORE.get().mode === "ADVANCED");
  }

  function navigate(route) { location.hash = "#/" + route; }

  function toast(msg) {
    let t = document.getElementById("appToast");
    if (!t) {
      t = document.createElement("div");
      t.id = "appToast";
      t.style.cssText = "position:fixed;bottom:20px;right:24px;background:#152233;color:#fff;padding:10px 16px;border-radius:8px;font-size:12.5px;z-index:200;box-shadow:0 8px 24px rgba(0,0,0,.25);transition:opacity .3s;";
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.opacity = "1";
    clearTimeout(t._timer);
    t._timer = setTimeout(() => { t.style.opacity = "0"; }, 2600);
  }

  function showExplain(title, bodyHtml) {
    document.getElementById("explainTitle").textContent = title;
    document.getElementById("explainBody").innerHTML = bodyHtml;
    document.getElementById("explainModal").classList.remove("hidden");
  }

  // "Live Demo" fetches real weather (Open-Meteo + NASA POWER) for Leh —
  // no illustrative/hand-authored climate data anywhere in the app.
  async function runLiveDemo() {
    const btn = document.getElementById("runLiveDemoBtn");
    if (btn) btn.disabled = true;
    toast("Fetching live weather for Leh, Ladakh…");
    try {
      await STORE.loadRealClimate("leh");
      const s = STORE.get();
      s.design = STORE.defaultDesign();
      STORE.save();
      const season = STORE.currentSeason();
      const result = ENGINE.runSimulation(s.design, season, s.simConfig);
      STORE.recordSimulation(result);
      const opt = ENGINE.runOptimization(s.design, season, s.simConfig, s.weights);
      STORE.recordOptimization(opt);
      navigate("evaluator");
      toast("Live demo complete: real climate → simulation → optimization.");
    } catch (e) {
      toast("Could not fetch live weather: " + e.message);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function init() {
    document.getElementById("brandName").textContent = CFG.APP_NAME;
    document.title = CFG.APP_NAME + " — Passive Shelter Thermal Design Platform";

    window.addEventListener("hashchange", render);
    document.getElementById("runLiveDemoBtn").addEventListener("click", runLiveDemo);
    document.getElementById("explainClose").addEventListener("click", () => document.getElementById("explainModal").classList.add("hidden"));
    document.getElementById("explainModal").addEventListener("click", (e) => { if (e.target.id === "explainModal") e.currentTarget.classList.add("hidden"); });

    document.getElementById("modeSimple").addEventListener("click", () => { STORE.get().mode = "SIMPLE"; STORE.save(); document.getElementById("modeSimple").classList.add("active"); document.getElementById("modeAdvanced").classList.remove("active"); render(); });
    document.getElementById("modeAdvanced").addEventListener("click", () => { STORE.get().mode = "ADVANCED"; STORE.save(); document.getElementById("modeAdvanced").classList.add("active"); document.getElementById("modeSimple").classList.remove("active"); render(); });

    if (STORE.get().mode === "ADVANCED") { document.getElementById("modeAdvanced").click(); }

    if (!location.hash) location.hash = "#/dashboard";
    render();
  }

  return { render, navigate, toast, showExplain, runLiveDemo, init };
})();

document.addEventListener("DOMContentLoaded", window.APP.init);
