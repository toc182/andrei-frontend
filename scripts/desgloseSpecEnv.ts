// Node-side stand-in for the browser global that src/services/api.ts reads at
// import time (window.location.hostname for API_BASE_URL). The spec never
// makes network calls — it only needs the module to load. Must be the FIRST
// import of desglose.spec.ts (ESM executes imports in order).
(globalThis as { window?: unknown }).window = { location: { hostname: 'localhost' } };
