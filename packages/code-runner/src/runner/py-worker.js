// Python worker of the sandboxed code runner. The runner prepends the asset
// map, the output cap and the loader shim. Each runner serves one run, so
// interpreter state never carries over between runs.
const FAKE = 'https://assets.invalid/'
const OUTPUT_CAP = self.__OUTPUT_CAP
let pyodide

self.addEventListener('securitypolicyviolation', () =>
  self.postMessage({ type: 'diagnostic' })
)

async function init() {
  try {
    importScripts(`${FAKE}pyodide/pyodide.js`)
    const asm = await import(self.__rewrite(`${FAKE}pyodide/pyodide.asm.mjs`))
    pyodide = await loadPyodide({
      indexURL: `${FAKE}pyodide/`,
      createPyodideModule: asm.default,
    })
    self.postMessage({ type: 'ready' })
  } catch (error) {
    self.postMessage({
      type: 'init-error',
      error: String(error).slice(0, 2000),
    })
  }
}

self.addEventListener('message', async (event) => {
  const message = event.data
  if (message?.type !== 'run' || !pyodide) return
  const out = { stdout: '', stderr: '', truncated: false }
  const append = (stream, line) => {
    const chunk = `${line}\n`
    const room = OUTPUT_CAP - out[stream].length
    if (chunk.length > room) {
      out[stream] += chunk.slice(0, Math.max(0, room))
      out.truncated = true
    } else {
      out[stream] += chunk
    }
  }
  pyodide.setStdout({ batched: (line) => append('stdout', line) })
  pyodide.setStderr({ batched: (line) => append('stderr', line) })
  let status = 'ok'
  let error = null
  try {
    // Only the standard library is available; imports are not resolved to
    // downloadable packages, so a missing module fails with a plain error.
    await pyodide.runPythonAsync(message.code)
  } catch (caught) {
    status = 'error'
    error = String(caught).slice(-2000)
  }
  self.postMessage({
    type: 'result',
    attemptId: message.attemptId,
    generation: message.generation,
    status,
    ...out,
    error,
  })
})

init()
