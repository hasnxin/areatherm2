/* AreaTherm — small shared UI helpers. */
window.U = {
  n(x, d) { d = d == null ? 1 : d; return Number.isFinite(x) ? x.toFixed(d) : "—"; },
  qs(sel, root) { return (root || document).querySelector(sel); },
  qsa(sel, root) { return Array.from((root || document).querySelectorAll(sel)); },
  on(sel, evt, fn, root) { const e = this.qs(sel, root); if (e) e.addEventListener(evt, fn); },
  esc(s) { return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); },
  // Data-source transparency badge: pass a state.climateSource object
  // ({type:'REAL', apiSource, label, period}). Used on every screen that
  // shows climate-derived numbers.
  badge(climateSource) {
    if (!climateSource) return "";
    const isReal = climateSource.type === "REAL";
    const icon = isReal ? "✓" : "⚠";
    const cls = isReal ? "real" : "illustrative";
    const period = climateSource.period ? ` — ${this.esc(climateSource.period)}` : "";
    return `<span class="data-badge ${cls}">${icon} Data source: ${this.esc(climateSource.label)}${period}</span>`;
  }
};
