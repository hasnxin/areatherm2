# AreaTherm — Architecture, Thermal Model & Optimization Methodology

"Design the shelter for the climate — not the climate for the shelter."

> **Naming**: "AreaTherm" is a placeholder brand name. It appears only in
> `app/js/config.js` (`APP_NAME`, `APP_SUBTITLE`) and is trivial to change —
> nothing else in the codebase hard-codes it.

## 0. Environment note (read this first)

This machine has **no Java, Maven, Node, npm, or Docker installed** (only
Python 3.13). Given the DRDO evaluation criterion "the core workflow must
actually function" and "test the complete workflow" before declaring
completion, building an Angular/Spring Boot/MySQL stack that cannot be
compiled or run here would produce an *unverifiable* mockup — exactly what
the brief prohibits ("Do NOT build only a calculator" / "not a superficial
UI mockup").

**Decision**: Phase 1 of this prototype is a self-contained, dependency-free
web application (plain HTML/CSS/JS, no build step, no external services)
that implements the *entire* workflow — including the real physics engine
and the real multi-parameter optimizer — client-side. It runs by opening
`app/index.html` in any browser. This is not a wireframe: every number shown
is computed by the same equations documented in §4 below.

Section 1 below is the target production architecture. The prototype's code
is deliberately organized (see §6, file layout) so each JS module maps onto
a specific Spring Boot service / Angular feature module, making the port
mechanical rather than a redesign.

---

## 1. Proposed Production Architecture (target)

```
┌───────────────────────────────────────────────────────────────────────┐
│  Angular 18+ SPA (feature modules mirror the nav in §5)                │
│  - Dashboard, Location/Climate, Shelter Designer, Materials,           │
│    Thermal Simulation, Optimization, What-If, Validation, Reports      │
│  - Apache ECharts for time-series/Sankey, Three.js for 3D preview      │
│  - Role-aware routing (Simple Mode / Advanced Engineering Mode)        │
└───────────────────────────────────────────────────────────────────────┘
                              │ REST (JSON) + JWT
┌───────────────────────────────────────────────────────────────────────┐
│  Spring Boot 3 (modular monolith, package-by-feature)                 │
│  ├─ api/            REST controllers (versioned /api/v1/...)          │
│  ├─ climate/         ClimateProfileService, external-source adapters  │
│  │                    (stubs today: NASA POWER / ERA5 / IMD clients)  │
│  ├─ design/          ShelterDesignService, geometry validation        │
│  ├─ material/        MaterialLibraryService (seeded + custom)         │
│  ├─ thermal/         ThermalEngine (pure, stateless, unit-tested)     │
│  ├─ optimization/    CandidateGenerator, MultiCriteriaScorer,         │
│  │                    SensitivityAnalyzer                             │
│  ├─ validation/      MeasuredDataService, ErrorMetricsService         │
│  ├─ report/          ReportService (PDF via OpenPDF/Flying Saucer)    │
│  ├─ ml/              Surrogate-model layer (optional, §9)             │
│  ├─ security/        Spring Security + JWT, role-based guards         │
│  └─ audit/           Versioning + audit log (Envers or manual)        │
└───────────────────────────────────────────────────────────────────────┘
        │                              │
┌───────────────┐            ┌──────────────────┐
│ MySQL 8       │            │ Redis (optional)  │
│ schema in     │            │ - simulation job   │
│ DATABASE_     │            │   cache             │
│ SCHEMA.sql    │            │ - session/rate-limit│
└───────────────┘            └──────────────────┘
```

Key principle: **`thermal/` and `optimization/` contain zero framework
dependencies** — pure functions taking value objects and returning value
objects. This is what makes them unit-testable, reusable from a batch job,
and reusable from the ML surrogate trainer. The JS prototype mirrors this:
`app/js/engine.js` has no DOM code in it at all.

Deployment: each service Dockerized (`Dockerfile` per module in a real
build), `docker-compose.yml` for app+MySQL+Redis locally, ECS/EKS-compatible
on AWS. Not implemented in this environment (no Docker present) — documented
here for when the target infra is available.

---

## 2. Database Model (target MySQL — see `DATABASE_SCHEMA.sql`)

Entities exactly as specified in the brief, §20:

`user`, `location`, `climate_profile`, `climate_profile_hourly` (time series
child table), `shelter_design`, `material`, `material_layer` (join: which
material + thickness is used in which design layer — wall/roof/floor),
`opening`, `thermal_mass`, `comfort_profile`, `simulation`,
`simulation_result` (time series child table), `optimization_run`,
`design_candidate`, `validation_dataset`, `validation_dataset_point`,
`report`.

Versioning: `climate_profile.version`, `material.version`,
`simulation.model_version`, `optimization_run.algorithm_version` columns +
an `audit_log` table (entity, entity_id, action, actor, before/after JSON,
timestamp) satisfy "maintain versioning" (§20) and "audit logs" (§28).

The prototype's `app/js/store.js` implements the *same* entities as
in-memory/localStorage objects, field-for-field compatible with the SQL
schema, so a future API client swap is a data-layer change only.

---

## 3. Thermal Model (physics-based, transparent — see `app/js/engine.js`)

Single-zone, two-node lumped-capacitance (RC) network, explicit hourly (or
15/30-min) time-stepping. Two temperature nodes: **indoor air** (`T_air`)
and **thermal mass** (`T_mass`), so charge/discharge behaviour of thermal
mass is visible, not hand-waved.

### 3.1 Sol-air temperature (opaque surfaces: wall, roof)

```
T_sol-air(t) = T_amb(t) + (α_surface × G_surface(t)) / h_o
```
- `α_surface` — solar absorptivity of the outer finish
- `G_surface(t)` — irradiance on that surface (horizontal for roof,
  orientation-adjusted for walls via an orientation factor table, §3.5)
- `h_o` — outside film coefficient (default 23 W/m²K, wind-adjusted)

This folds opaque-surface solar gain into the conduction term, standard
building-physics practice (ASHRAE sol-air temperature concept), and is
disclosed as an assumption (longwave sky-radiation correction term is
omitted — see Assumptions panel).

### 3.2 Conduction losses/gains

```
Q_wall(t)  = U_wall  × A_wall  × (T_air(t) − T_sol-air,wall(t))
Q_roof(t)  = U_roof  × A_roof  × (T_air(t) − T_sol-air,roof(t))
Q_floor(t) = U_floor × A_floor × (T_air(t) − T_ground)
Q_window,cond(t) = U_window × A_window × (T_air(t) − T_amb(t))
```
Positive `Q` = heat leaving the shelter (a loss) when indoor is warmer.
`T_ground` is a configurable assumption (default: monthly mean ambient).

### 3.3 Solar heat gain through glazing

```
Q_solar,window(t) = Σ_windows  A_window × G(t) × orientation_factor × SHGC
```
`SHGC` (solar heat gain coefficient) comes from the glazing's material
record; `orientation_factor` from §3.5.

### 3.4 Ventilation / infiltration

```
Q_vent(t) = ACH × Volume / 3600 × ρ_air × Cp_air × (T_air(t) − T_amb(t))
```
`ρ_air` = 1.2 kg/m³, `Cp_air` = 1005 J/kg·K, `ACH` derived from the
air-leakage-rate input.

### 3.5 Orientation factor (documented assumption, user-editable)

Default table (relative solar aperture effectiveness through the winter
low-sun-angle window typical of Ladakh):
`South = 1.00, SE/SW = 0.85, East/West = 0.55, NE/NW = 0.30, North = 0.15`,
plus true azimuth-based cosine model when a custom azimuth is entered.

### 3.6 Thermal mass node

```
Q_exchange(t) = h_mass × A_mass × (T_air(t) − T_mass(t))
C_mass × dT_mass/dt = Q_exchange(t) + f_solar_to_mass × Q_solar,window(t)
```
`C_mass = mass × Cp_material` (PCM materials use an elevated apparent `Cp`
across their phase-change band — a documented simplification of latent
heat, not a full enthalpy method).

### 3.7 Indoor air energy balance (explicit Euler, Δt = time step)

```
C_air × ΔT_air/Δt =
    Q_solar,window(t) + Q_internal(t) − Q_exchange(t)
    − Q_wall(t) − Q_roof(t) − Q_floor(t) − Q_window,cond(t) − Q_vent(t)

C_air = Volume × ρ_air × Cp_air   (× furnishing factor, default 1.0)
```

### 3.8 Derived outputs (all shown with full working in "Explain
Calculation")

- Heating/cooling requirement: hours where `T_air` is outside the comfort
  band, integrated as `Σ U_total × A_total × |T_comfort_bound − T_air(t)|
  × Δt` — the auxiliary energy that *would* be needed to hold comfort.
- Comfort hours = count of timesteps with `comfort_min ≤ T_air ≤
  comfort_max`.
- Solar utilization % = (solar energy that reduced/avoided a loss) ÷
  (total incident solar energy on the envelope).
- Thermal Comfort Score (0–100) = weighted blend of daytime comfort %,
  night comfort %, solar utilization %, heat-retention % — weights
  configurable, shown in full in Explain Calculation.

All formulas above are re-printed, with the run's actual numbers substituted
step by step, in every "Explain Calculation" panel — nothing is a black box.

---

## 4. Optimization Methodology

```
Baseline design + variable ranges
        ↓
Candidate generator (orientation × wall system × insulation thickness ×
                      window % × glazing × thermal-mass level)
        ↓
Thermal Engine run per candidate (same equations as §3)
        ↓
Multi-criteria weighted score:
  Thermal Comfort 40% · Heat Retention 25% · Solar Utilization 15% ·
  Energy Efficiency 10% · Cost 10%   (all weights user-adjustable, live)
        ↓
Rank → Top 5 shown as Design A–E, highest-scoring = Recommended
        ↓
Sensitivity analysis: perturb one parameter at a time from the
  recommended design, measure Δ(comfort score) → ranked impact bars
```

This is a **weighted-sum multi-criteria evaluation over a sampled design
space** (documented as such — not a black-box "AI recommendation"). Section
9 covers the optional ML surrogate layer.

---

## 5. UI Screen Map

```
Dashboard
├── Location & Climate     (10 reference locations, live Open-Meteo + NASA POWER, charts)
├── Shelter Designer       (geometry, shape, orientation, 2D preview)
├── Materials              (library: wall/roof/insulation/mass/window)
├── Thermal Simulation     (run, indoor-vs-ambient-vs-comfort chart,
│                            heat-flow Sankey, Explain Calculation)
├── Optimization           (weights, candidate table, comparison,
│                            recommended design, sensitivity chart)
├── What-If Analysis       (single-parameter before/after)
├── Validation             (measured-data entry, MAE/RMSE/MAPE/R²)
├── Reports                (assembled report, print/PDF)
├── Evaluator Summary       (2–3 minute story for a DRDO reviewer)
└── Settings                (assumptions & limitations, units, weights)
```
Every screen offers **Simple Mode** (fewer fields, sane defaults, big
live-demo button) and **Advanced Mode** (full parameter set, editable
material properties, editable orientation-factor table, custom time steps).

---

## 6. Prototype File Layout (maps to §1)

```
app/
  index.html            SPA shell + nav (→ Angular AppComponent/routes)
  css/styles.css        design system (scientific/technical)
  js/config.js          branding + units + default weights
  js/data.js            10 reference locations, material library,
                         comfort profiles      (→ seed data / Flyway)
  js/weather-api.js     Open-Meteo live weather client (→ climate/ adapter)
  js/nasa-power.js      NASA POWER climatology client (→ climate/ adapter)
  js/engine.js          solar + thermal RC model + optimizer +
                         validation stats      (→ thermal/, optimization/)
  js/charts.js          dependency-free inline-SVG chart renderer
                         (→ ECharts config builders)
  js/store.js           entity state + localStorage persistence
                         (→ JPA repositories / REST client)
  js/ui.js              screen rendering + event wiring
                         (→ Angular components)
  js/app.js             router/bootstrap                (→ Angular routing)
```

---

## 7. Implementation Plan (status)

Phases 1–11 from the brief are delivered in this pass as a single running
prototype rather than sequential milestones (feasible because there is no
build/deploy step to gate on). Validation (Phase 9) and Reports (Phase 10)
are included. Live weather-API integration is implemented client-side:
Open-Meteo (`app/js/weather-api.js`) drives the hourly simulation, and
NASA POWER (`app/js/nasa-power.js`) supplies real 20-year solar/temperature
climatology, for all 10 reference locations, with a Guided Setup wizard as
the simplified entry point. No hand-authored or illustrative climate
dataset ships with the app. Not implemented (explicitly out of scope for
this pass, tracked for the production build): real authentication/RBAC
persistence, ERA5/IMD archive integration (NASA POWER covers solar/temp
climatology; ERA5/IMD would add other historical variables), 3D preview
(2D top-down + elevation preview only), server-side PDF rendering (browser
print-to-PDF is used instead), ML surrogate model (architecture documented
in §9, not trained — no labelled field data exists yet to train or
validate one).

## 8. Assumptions register (also shown live in-app under Settings)

Steady vs transient: transient (explicit hourly RC model), not steady-state.
Outside film coefficient fixed at 23 W/m²K, wind-adjusted by a simple linear
factor. Sky longwave radiation exchange is not separately modelled (folded
into the sol-air simplification). Ground temperature defaults to monthly
mean ambient unless overridden. Internal gains are constant-per-hour unless
an occupancy schedule is supplied. PCM modelled via elevated apparent
specific heat over its melt band, not a full enthalpy method. Weather inputs
are a live Open-Meteo forecast average blended with NASA POWER climatology
for the annual solar/temperature figures — never claimed as measured or
field-validated.

## 9. AI/ML Layer (documented, not built)

```
Physics Model  →  Simulation Dataset (candidate runs + scores)
               →  ML Surrogate (e.g. gradient-boosted regressor) trained
                   to predict comfort score from design parameters, so the
                   optimizer can search a larger space without a full
                   physics run per candidate
               →  Optimization Engine uses surrogate for coarse search,
                   physics engine to verify the final shortlist
```
Every ML-derived number would be labelled **"ML-based estimation"**, never
mixed with **"Model Prediction"** (physics) or **"Field measurement"**
values. Not implemented here — no training data exists yet, and the brief
explicitly prohibits claiming ML accuracy without validation data.
