// Inline bootstrap of the sandboxed code runner documents. The document is
// opaque (iframe sandbox plus CSP sandbox) and its CSP allows only this
// script, blob: URLs and WebAssembly, so the runtimes can reach no network.
// The embedding Chat page hands over a private MessageChannel port once and
// then transfers every verified runtime file as bytes.
;(() => {
  const FAKE = 'https://assets.invalid/'
  const MAX_MESSAGE_CHARS = 256 * 1024
  const MAX_DIAGNOSTICS = 10
  const WORKER_TYPES = new Set(['ready', 'init-error', 'result'])
  let port = null
  let worker = null
  let webR = null
  let profile = null
  let outputCap = 65536
  let diagnostics = 0

  const send = (message) => port?.postMessage(message)

  function diagnostic() {
    if (diagnostics >= MAX_DIAGNOSTICS) return
    diagnostics += 1
    send({ type: 'diagnostic' })
  }

  // Escaping can make a result's JSON far longer than its capped text, so
  // halve the longer stream until the message fits the host's size limit.
  function sendResult(result) {
    let fitted = result
    while (JSON.stringify(fitted).length > MAX_MESSAGE_CHARS) {
      const key =
        fitted.stdout.length >= fitted.stderr.length ? 'stdout' : 'stderr'
      if (!fitted[key]) return
      fitted = {
        ...fitted,
        [key]: fitted[key].slice(0, Math.floor(fitted[key].length / 2)),
        truncated: true,
      }
    }
    send(fitted)
  }

  document.addEventListener('securitypolicyviolation', diagnostic)

  window.addEventListener('message', (event) => {
    // Only the embedding page may hand over the bridge port, and only once.
    if (event.source !== window.parent || port) return
    const data = event.data
    if (data?.type !== 'hello' || data.v !== 1 || !event.ports[0]) {
      return
    }
    port = event.ports[0]
    port.onmessage = (message) => onHost(message.data)
  })

  function onHost(message) {
    if (!message || typeof message !== 'object') return
    if (message.type === 'init' && !profile) {
      init(message).catch((error) =>
        send({ type: 'init-error', error: String(error).slice(0, 2000) })
      )
    } else if (message.type === 'run' && profile) {
      // run reports every failure to the host itself.
      void run(message)
    }
  }

  async function text(url) {
    return (await fetch(url)).text()
  }

  function loadScript(url) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = url
      script.onload = resolve
      script.onerror = () => reject(new Error('runner script failed to load'))
      document.head.appendChild(script)
    })
  }

  function blobUrl(source) {
    return URL.createObjectURL(new Blob([source], { type: 'text/javascript' }))
  }

  async function init(message) {
    profile = message.profile
    outputCap = message.outputCap
    const assets = {}
    for (const [id, asset] of Object.entries(message.assets)) {
      assets[id] = URL.createObjectURL(
        new Blob([asset.bytes], { type: asset.type })
      )
    }
    const shim = await text(assets['runner/shim.js'])
    const prelude = `self.__ASSETS=${JSON.stringify(assets)};self.__OUTPUT_CAP=${outputCap};\n`

    if (profile === 'python-core') {
      const body = await text(assets['runner/py-worker.js'])
      worker = new Worker(blobUrl(`${prelude}${shim}\n${body}`))
      worker.onerror = () =>
        send({ type: 'init-error', error: 'The Python worker failed.' })
      worker.onmessage = (event) => {
        const data = event.data
        if (!data || typeof data !== 'object') return
        if (data.type === 'diagnostic') {
          diagnostic()
          return
        }
        if (!WORKER_TYPES.has(data.type)) return
        try {
          if (
            data.type === 'result' &&
            typeof data.stdout === 'string' &&
            typeof data.stderr === 'string'
          ) {
            sendResult(data)
          } else if (JSON.stringify(data).length <= MAX_MESSAGE_CHARS) {
            send(data)
          }
        } catch {}
      }
      return
    }

    // R: webR spawns its own worker from webr-worker.js, so compose that
    // worker with the prelude and shim, and give the document the same shim.
    const workerUrl = blobUrl(
      `${prelude}${shim}\n${await text(assets['webr/webr-worker.js'])}`
    )
    window.__ASSETS = { ...assets, 'webr/webr-worker.js': workerUrl }
    await loadScript(blobUrl(shim))
    const { WebR, ChannelType } = await import(assets['webr/webr.js'])
    webR = new WebR({
      baseUrl: `${FAKE}webr/`,
      repoUrl: `${FAKE}repo/`,
      channelType: ChannelType.PostMessage,
      interactive: false,
    })
    await webR.init()
    send({ type: 'ready' })
  }

  function append(out, stream, chunk) {
    const room = outputCap - out[stream].length
    if (chunk.length > room) {
      out[stream] += chunk.slice(0, Math.max(0, room))
      out.truncated = true
    } else {
      out[stream] += chunk
    }
  }

  async function run(message) {
    if (profile === 'python-core') {
      worker?.postMessage({
        type: 'run',
        attemptId: message.attemptId,
        generation: message.generation,
        code: message.code,
      })
      return
    }
    const out = { stdout: '', stderr: '', truncated: false }
    let status = 'ok'
    let error = null
    let shelter
    try {
      shelter = await new webR.Shelter()
      const captured = await shelter.captureR(message.code, {
        withAutoprint: true,
        captureStreams: true,
        captureConditions: true,
        // Report R errors as captured conditions, keeping earlier output.
        throwJsException: false,
      })
      for (const item of captured.output) {
        if (item.type === 'stdout' || item.type === 'stderr') {
          append(out, item.type, `${item.data}\n`)
          continue
        }
        let text = ''
        try {
          text = await (await item.data.get('message')).toString()
        } catch {}
        if (item.type === 'error') {
          status = 'error'
          error = text.slice(0, 2000)
        } else {
          append(out, 'stderr', `${item.type}: ${text}\n`)
        }
      }
    } catch (caught) {
      status = 'error'
      error = String(caught).slice(-2000)
    } finally {
      try {
        shelter?.purge()
      } catch {}
    }
    sendResult({
      type: 'result',
      attemptId: message.attemptId,
      generation: message.generation,
      status,
      ...out,
      error,
    })
  }
})()
