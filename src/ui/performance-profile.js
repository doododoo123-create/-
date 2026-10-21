// Display-only profile. Never stored in world data or passed to the simulation engine.
export function mobileProfile(){return globalThis.document?.documentElement?.dataset.performance==='mobile';}
