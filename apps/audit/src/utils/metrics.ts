import type { Hono } from 'hono'
import client from 'prom-client'

// Initialize default metrics (CPU, memory, etc.)
client.collectDefaultMetrics({
  prefix: 'audit_',
})

// Custom metrics for audit service (low-cardinality only)
export const metrics = {
  // Counter: Total number of /audit requests received
  requestsTotal: new client.Counter({
    name: 'audit_requests_total',
    help: 'Total number of audit requests received',
  }),

  // Counter: Total number of events successfully written to storage
  writesTotal: new client.Counter({
    name: 'audit_writes_total',
    help: 'Total number of events written to Azure Table Storage',
  }),

  // Counter: Total number of storage write errors
  writeErrorsTotal: new client.Counter({
    name: 'audit_write_errors_total',
    help: 'Total number of storage write errors',
  }),

  // Histogram: Write latency distribution
  writeLatency: new client.Histogram({
    name: 'audit_write_latency_seconds',
    help: 'Write latency distribution in seconds',
    buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  }),
}

/**
 * Setup metrics endpoint for Prometheus scraping
 */
export function setupMetrics(app: Hono): void {
  app.get('/metrics', async (c) => {
    try {
      const register = client.register
      c.header('Content-Type', register.contentType)
      return c.text(await register.metrics())
    } catch (error) {
      return c.text('Error generating metrics', 500)
    }
  })
}
