// Load drill for the PWA spot burst tier. It runs inside the cluster (see
// pwa-burst-pod.yaml) because only there can it reach individual Pods.
//
// - `service` ramps unauthenticated /login renders plus their static assets
//   through the PWA Service, which splits traffic across baseline and burst
//   Pods and drives the burst HPA.
// - `probe_baseline` and `probe_burst` send the same small constant rate to
//   one named Pod of each tier, so their latencies compare at equal load.
//
// /login renders without calling any other backend, so the load stays on the
// PWA Pods. Every request carries a `phase` tag (ramp, plateau, cool) so the
// summary can judge failures from the plateau on.
import { check } from 'k6'
import http from 'k6/http'

const serviceUrl = __ENV.PWA_SERVICE_URL
const baselinePod = __ENV.PWA_BASELINE_POD_URL
const burstPod = __ENV.PWA_BURST_POD_URL

if (!serviceUrl || !baselinePod || !burstPod) {
  throw new Error(
    'PWA_SERVICE_URL, PWA_BASELINE_POD_URL and PWA_BURST_POD_URL must be set'
  )
}

const startRate = Number(__ENV.START_RATE || 2)
const peakRate = Number(__ENV.PEAK_RATE || 30)
const probeRate = Number(__ENV.PROBE_RATE || 2)
const rampMinutes = Number(__ENV.RAMP_MINUTES || 10)
const plateauMinutes = Number(__ENV.PLATEAU_MINUTES || 10)
const coolMinutes = Number(__ENV.COOL_MINUTES || 15)
const assetsPerPage = Number(__ENV.ASSETS_PER_PAGE || 2)
const totalMinutes = rampMinutes + plateauMinutes + coolMinutes

if (peakRate > 100) {
  throw new Error('PEAK_RATE above 100 requests per second is not allowed')
}

const probeScenario = (url, tier) => ({
  executor: 'constant-arrival-rate',
  exec: 'probe',
  rate: probeRate,
  timeUnit: '1s',
  duration: `${totalMinutes}m`,
  preAllocatedVUs: 5,
  maxVUs: 20,
  env: { PROBE_URL: url },
  tags: { target: 'pod', tier },
})

export const options = {
  scenarios: {
    service: {
      executor: 'ramping-arrival-rate',
      exec: 'service',
      startRate,
      timeUnit: '1s',
      preAllocatedVUs: 20,
      maxVUs: 200,
      stages: [
        { duration: `${rampMinutes}m`, target: peakRate },
        { duration: `${plateauMinutes}m`, target: peakRate },
        { duration: '1m', target: startRate },
        { duration: `${coolMinutes - 1}m`, target: startRate },
      ],
      tags: { target: 'service' },
    },
    probe_baseline: probeScenario(baselinePod, 'baseline'),
    probe_burst: probeScenario(burstPod, 'burst'),
  },
  // These thresholds only make the per-phase and per-tier figures appear in
  // the summary; the drill verdict is read from them against P5 and P6.
  thresholds: {
    'http_req_failed{target:service,phase:ramp}': ['rate>=0'],
    'http_req_failed{target:service,phase:plateau}': ['rate>=0'],
    'http_req_failed{target:service,phase:cool}': ['rate>=0'],
    'http_req_duration{target:service,phase:plateau}': ['p(95)>=0'],
    'http_req_duration{tier:baseline}': ['p(95)>=0'],
    'http_req_duration{tier:burst}': ['p(95)>=0'],
    'http_req_failed{tier:baseline}': ['rate>=0'],
    'http_req_failed{tier:burst}': ['rate>=0'],
  },
  summaryTrendStats: ['avg', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
}

export function setup() {
  const res = http.get(`${serviceUrl}/login`)
  if (res.status !== 200) {
    throw new Error(`PWA login page returned ${res.status}`)
  }
  const assets = [
    ...new Set(res.body.match(/\/_next\/static\/[^"'\s]+\.(?:js|css)/g) || []),
  ]
  if (assets.length === 0) {
    throw new Error('No static assets found on the PWA login page')
  }
  return { assets, startedAt: Date.now() }
}

function phase(startedAt) {
  const minutes = (Date.now() - startedAt) / 60000
  if (minutes < rampMinutes) return 'ramp'
  if (minutes < rampMinutes + plateauMinutes) return 'plateau'
  return 'cool'
}

export function service(data) {
  const tags = { phase: phase(data.startedAt) }
  const page = http.get(`${serviceUrl}/login`, {
    tags: { ...tags, kind: 'page' },
  })
  check(page, { 'page 200': (r) => r.status === 200 })
  for (let i = 0; i < assetsPerPage; i++) {
    const asset = data.assets[Math.floor(Math.random() * data.assets.length)]
    const res = http.get(`${serviceUrl}${asset}`, {
      tags: { ...tags, kind: 'asset' },
    })
    check(res, { 'asset 200': (r) => r.status === 200 })
  }
}

export function probe(data) {
  const res = http.get(`${__ENV.PROBE_URL}/login`, {
    tags: { phase: phase(data.startedAt), kind: 'page' },
  })
  check(res, { 'probe 200': (r) => r.status === 200 })
}
