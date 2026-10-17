export type BrowserEngine = 'chromium' | 'webkit' | 'gecko' | 'unknown'

/**
 * Classifies the browser engine from the user agent. Browser code execution
 * is qualified on Chromium and WebKit only: Firefox workers reached the
 * network despite the runner policy. Every iOS browser uses WebKit, whatever
 * its brand. A spoofed user agent only changes what its own user can run.
 */
export function detectBrowserEngine(userAgent: string): BrowserEngine {
  if (/\b(CriOS|FxiOS|EdgiOS)\//.test(userAgent)) return 'webkit'
  if (/\bFirefox\//.test(userAgent)) return 'gecko'
  if (/\b(Chrome|Chromium)\//.test(userAgent)) return 'chromium'
  if (/\bAppleWebKit\//.test(userAgent) && /\bSafari\//.test(userAgent)) {
    return 'webkit'
  }
  return 'unknown'
}

export function isCodeExecutionSupported(engine: BrowserEngine): boolean {
  return engine === 'chromium' || engine === 'webkit'
}
