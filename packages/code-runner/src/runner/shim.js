// Loader plumbing inside the sandboxed code runner, not a security boundary:
// the runtimes request their files under a fixed fake base URL, and this shim
// rewrites those requests to the blob: URLs of the verified bytes. Unknown
// files fail closed. The runner document's CSP, which blob workers inherit,
// is what blocks the network.
;(() => {
  const FAKE = 'https://assets.invalid/'
  const assets = self.__ASSETS || {}
  const rewrite = (url) => {
    const value = String(url instanceof Request ? url.url : url)
    if (!value.startsWith(FAKE)) return value
    const id = value.slice(FAKE.length).split('?')[0]
    return assets[id] || 'blob:unmapped-asset'
  }
  self.__rewrite = rewrite

  const realFetch = self.fetch.bind(self)
  self.fetch = (input, init) => {
    const value = String(input instanceof Request ? input.url : input)
    return realFetch(value.startsWith(FAKE) ? rewrite(value) : input, init)
  }

  const RealXHR = self.XMLHttpRequest
  if (RealXHR) {
    self.XMLHttpRequest = class extends RealXHR {
      open(method, url, ...rest) {
        // blob: URLs accept only an uppercase GET. webR uses "get", and its
        // lazy filesystem probes sizes with HEAD; a GET of an in-memory blob
        // returns the same headers.
        const upper = String(method).toUpperCase()
        const fake = String(url).startsWith(FAKE)
        const verb =
          fake && (upper === 'GET' || upper === 'HEAD') ? 'GET' : method
        return super.open(verb, rewrite(url), ...rest)
      }
    }
  }

  if (self.importScripts) {
    const realImport = self.importScripts.bind(self)
    self.importScripts = (...urls) => realImport(...urls.map(rewrite))
  }
})()
