// Maps contain application source. This flag is for a disposable, synthetic CI
// build only, never a deployment mode or a default change to production builds.
export function enableCoverageMaps(config, env = process.env) {
  if (!env.KLICKER_BROWSER_COVERAGE) return config
  if (
    env.KLICKER_BROWSER_COVERAGE !== '1' ||
    env.GITHUB_ACTIONS !== 'true' ||
    env.CI !== 'true' ||
    env.NODE_ENV !== 'production' ||
    env.KLICKER_PLAYWRIGHT_FIXTURES !== '1'
  ) {
    throw new Error(
      'Browser coverage maps require the synthetic production CI build'
    )
  }
  return { ...config, productionBrowserSourceMaps: true }
}
