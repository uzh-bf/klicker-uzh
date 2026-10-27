// The backend under test calls the private Catalyst engine. Public PR CI does
// not provision it, so engine-backed specs run only when the runner is told
// where the engine is (the same URL the backend receives).
export const ADAPTIVE_ENGINE_SKIP_REASON =
  'Requires the adaptive engine (set ADAPTIVE_ENGINE_URL)'

export const adaptiveEngineConfigured = Boolean(process.env.ADAPTIVE_ENGINE_URL)
