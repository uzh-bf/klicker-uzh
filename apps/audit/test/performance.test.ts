import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { AzureTableTestHelper } from './utils/azure-table-helper.js'

const BASE_URL = 'http://localhost:7080'
const AUTH_TOKEN = process.env.AUDIT_TOKEN || 'test-secret-token-123'

// Test helper instance
const tableHelper = new AzureTableTestHelper()

// Helper function to make authenticated requests
async function makeAuthenticatedRequest(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = `${BASE_URL}${path}`
  const response = await fetch(url, {
    ...options,
    headers: {
      'X-Internal-Token': AUTH_TOKEN,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  return response
}

// Helper to generate test events
function generateTestEvent(index: number) {
  return {
    subject: `user:perf-user-${index}`,
    action: `test.performance.action${index % 5}`, // 5 different actions
    eventId: `perf-${Date.now()}-${index}`,
    resourceId: `resource-${index}`,
    sessionId: `session-${Math.floor(index / 10)}`, // Group every 10 events
    attributes: {
      index,
      timestamp: Date.now(),
      batch: Math.floor(index / 50), // Group every 50 events
      metadata: {
        source: 'performance-test',
        priority: index % 3 === 0 ? 'high' : 'normal',
        tags: [`tag-${index % 10}`, `category-${index % 5}`],
      },
    },
  }
}

// Helper to measure performance
async function measurePerformance<T>(name: string, fn: () => Promise<T>) {
  const startTime = Date.now()
  const startMemory = process.memoryUsage()

  const result = await fn()

  const endTime = Date.now()
  const endMemory = process.memoryUsage()

  const duration = endTime - startTime
  const memoryDelta = {
    rss: endMemory.rss - startMemory.rss,
    heapUsed: endMemory.heapUsed - startMemory.heapUsed,
    heapTotal: endMemory.heapTotal - startMemory.heapTotal,
    external: endMemory.external - startMemory.external,
  }

  console.log(`Performance [${name}]:`)
  console.log(`  Duration: ${duration}ms`)
  console.log(
    `  Memory Delta: RSS=${(memoryDelta.rss / 1024 / 1024).toFixed(2)}MB, Heap=${(memoryDelta.heapUsed / 1024 / 1024).toFixed(2)}MB`
  )

  return { result, duration, memoryDelta }
}

describe('Performance and Load Tests', () => {
  beforeAll(async () => {
    console.log('Setting up performance tests...')
    await tableHelper.setup()
    await tableHelper.cleanup()
  })

  beforeEach(async () => {
    await tableHelper.cleanup()
  })

  afterAll(async () => {
    console.log('Cleaning up performance tests...')
    await tableHelper.cleanup()
  })

  describe('Single Request Performance', () => {
    it('should process simple events quickly (under 100ms)', async () => {
      const event = generateTestEvent(1)

      const { duration } = await measurePerformance(
        'Single Simple Event',
        async () => {
          const response = await makeAuthenticatedRequest('/audit', {
            method: 'POST',
            body: JSON.stringify(event),
          })
          expect(response.status).toBe(200)
          return response
        }
      )

      // Single events should be processed very quickly
      expect(duration).toBeLessThan(100)

      // Verify persistence
      await new Promise((resolve) => setTimeout(resolve, 500))
      const entities = (await tableHelper.getAllEntities()).filter(
        (entity) => entity.rowKey === event.eventId
      )
      expect(entities.length).toBe(1)
    })

    it('should process complex events efficiently (under 200ms)', async () => {
      const complexEvent = {
        subject: 'user:complex-perf',
        action: 'test.complex-performance',
        eventId: `complex-perf-${Date.now()}`,
        resourceId: 'resource-complex',
        sessionId: 'session-complex',
        userId: 'user-complex',
        attributes: {
          // Large but reasonable attributes
          records: Array.from({ length: 100 }, (_, i) => ({
            id: `record-${i}`,
            timestamp: Date.now() - i * 1000,
            value: Math.random() * 1000,
            metadata: {
              source: 'sensor',
              quality: i % 2 === 0 ? 'high' : 'medium',
              tags: [`tag-${i % 10}`, `category-${i % 5}`],
              location: {
                lat: 47.6062 + (Math.random() - 0.5) * 0.1,
                lng: -122.3321 + (Math.random() - 0.5) * 0.1,
              },
            },
          })),
          summary: {
            totalRecords: 100,
            avgValue: 500,
            categories: ['A', 'B', 'C', 'D', 'E'],
            generatedAt: new Date().toISOString(),
          },
        },
      }

      const { duration } = await measurePerformance(
        'Complex Event',
        async () => {
          const response = await makeAuthenticatedRequest('/audit', {
            method: 'POST',
            body: JSON.stringify(complexEvent),
          })
          expect(response.status).toBe(200)
          return response
        }
      )

      // Complex events should still be reasonably fast
      expect(duration).toBeLessThan(200)

      // Verify persistence and data integrity
      await new Promise((resolve) => setTimeout(resolve, 1000))
      const entities = await tableHelper.getAllEntities()
      expect(entities.length).toBe(1)

      const attributes = JSON.parse(entities[0]!.attributes!)
      expect(attributes.records.length).toBe(100)
    })
  })

  describe('Concurrent Request Handling', () => {
    it('should handle 50 concurrent requests efficiently', async () => {
      const eventCount = 50

      const { result: responses, duration } = await measurePerformance(
        '50 Concurrent Requests',
        async () => {
          const requests = Array.from({ length: eventCount }, (_, i) =>
            makeAuthenticatedRequest('/audit', {
              method: 'POST',
              body: JSON.stringify(generateTestEvent(i)),
            })
          )

          return Promise.all(requests)
        }
      )

      // All requests should be successful
      responses.forEach((response, index) => {
        expect(response.status).toBe(200)
      })

      // Should handle 50 concurrent requests reasonably quickly (under 5 seconds)
      expect(duration).toBeLessThan(5000)

      // Calculate throughput
      const throughput = (eventCount / duration) * 1000 // events per second
      console.log(`  Throughput: ${throughput.toFixed(2)} events/second`)

      // Verify all events were persisted
      await tableHelper.waitForEntityCount(eventCount, 15000)
      const entities = await tableHelper.getAllEntities()
      expect(entities.length).toBe(eventCount)
    })

    it('should handle 200 concurrent requests with reasonable performance', async () => {
      const eventCount = 200

      const { result: responses, duration } = await measurePerformance(
        '200 Concurrent Requests',
        async () => {
          const requests = Array.from({ length: eventCount }, (_, i) =>
            makeAuthenticatedRequest('/audit', {
              method: 'POST',
              body: JSON.stringify(generateTestEvent(i)),
            })
          )

          return Promise.all(requests)
        }
      )

      // Check success rate
      const successfulResponses = responses.filter((r) => r.status === 200)
      const successRate = (successfulResponses.length / responses.length) * 100

      console.log(
        `  Success rate: ${successRate.toFixed(1)}% (${successfulResponses.length}/${responses.length})`
      )

      // Should have high success rate (>95%)
      expect(successRate).toBeGreaterThanOrEqual(95)

      // Should handle 200 requests in reasonable time (under 15 seconds)
      expect(duration).toBeLessThan(15000)

      const throughput = (successfulResponses.length / duration) * 1000
      console.log(`  Throughput: ${throughput.toFixed(2)} events/second`)

      // Verify persistence (allow for some eventual consistency)
      await new Promise((resolve) => setTimeout(resolve, 5000)) // Extra wait time
      const entities = await tableHelper.getAllEntities()

      // Should persist at least 95% of successful submissions
      const persistenceRate =
        (entities.length / successfulResponses.length) * 100
      console.log(
        `  Persistence rate: ${persistenceRate.toFixed(1)}% (${entities.length}/${successfulResponses.length})`
      )
      expect(persistenceRate).toBeGreaterThanOrEqual(95)
    })
  })

  describe('Sustained Load Testing', () => {
    it('should handle sustained load over time without degradation', async () => {
      const batchSize = 25
      const numBatches = 10
      const batchDelayMs = 500

      const batchResults: Array<{
        batch: number
        duration: number
        successCount: number
        throughput: number
      }> = []
      let totalEvents = 0

      const { duration: totalDuration } = await measurePerformance(
        'Sustained Load Test',
        async () => {
          for (let batch = 0; batch < numBatches; batch++) {
            const batchStart = Date.now()

            const requests = Array.from({ length: batchSize }, (_, i) => {
              const eventIndex = batch * batchSize + i
              return makeAuthenticatedRequest('/audit', {
                method: 'POST',
                body: JSON.stringify(generateTestEvent(eventIndex)),
              })
            })

            const responses = await Promise.all(requests)
            const batchDuration = Date.now() - batchStart
            const successCount = responses.filter(
              (r) => r.status === 200
            ).length

            batchResults.push({
              batch,
              duration: batchDuration,
              successCount,
              throughput: (successCount / batchDuration) * 1000,
            })

            totalEvents += successCount

            console.log(
              `  Batch ${batch + 1}/${numBatches}: ${successCount}/${batchSize} success, ${batchDuration}ms, ${((successCount / batchDuration) * 1000).toFixed(2)} events/sec`
            )

            // Wait between batches
            if (batch < numBatches - 1) {
              await new Promise((resolve) => setTimeout(resolve, batchDelayMs))
            }
          }
        }
      )

      // Analyze performance consistency
      const throughputs = batchResults.map((r) => r.throughput)
      const avgThroughput =
        throughputs.reduce((a, b) => a + b, 0) / throughputs.length
      const maxThroughput = Math.max(...throughputs)
      const minThroughput = Math.min(...throughputs)
      const throughputVariance =
        ((maxThroughput - minThroughput) / avgThroughput) * 100

      console.log(`  Overall: ${totalEvents} events in ${totalDuration}ms`)
      console.log(`  Avg throughput: ${avgThroughput.toFixed(2)} events/sec`)
      console.log(`  Throughput variance: ${throughputVariance.toFixed(1)}%`)

      // Performance should not degrade significantly over time
      expect(throughputVariance).toBeLessThanOrEqual(250)

      // Overall success rate should be high
      const overallSuccessRate = (totalEvents / (batchSize * numBatches)) * 100
      expect(overallSuccessRate).toBeGreaterThanOrEqual(95)

      // Verify persistence
      await new Promise((resolve) => setTimeout(resolve, 3000))
      const entities = await tableHelper.getAllEntities(totalEvents + 100)
      const persistenceRate = (entities.length / totalEvents) * 100
      console.log(
        `  Final persistence rate: ${persistenceRate.toFixed(1)}% (${entities.length}/${totalEvents})`
      )
      expect(persistenceRate).toBeGreaterThanOrEqual(95)
    })
  })

  describe('Memory Usage and Resource Management', () => {
    it('should not have significant memory leaks during high load', async () => {
      const iterations = 5
      const eventsPerIteration = 50

      const memorySnapshots: Array<{
        iteration: number
        successCount: number
        heapUsed: number
        memoryDelta: number
        memoryDeltaMB: number
      }> = []

      for (let iteration = 0; iteration < iterations; iteration++) {
        // Force garbage collection if available
        if ((global as any).gc) {
          ;(global as any).gc()
        }

        const memoryBefore = process.memoryUsage()

        // Submit batch of events
        const requests = Array.from({ length: eventsPerIteration }, (_, i) => {
          const eventIndex = iteration * eventsPerIteration + i
          return makeAuthenticatedRequest('/audit', {
            method: 'POST',
            body: JSON.stringify(generateTestEvent(eventIndex)),
          })
        })

        const responses = await Promise.all(requests)
        const successCount = responses.filter((r) => r.status === 200).length

        // Wait a bit for processing
        await new Promise((resolve) => setTimeout(resolve, 1000))

        if ((global as any).gc) {
          ;(global as any).gc()
        }

        const memoryAfter = process.memoryUsage()
        const memoryDelta = memoryAfter.heapUsed - memoryBefore.heapUsed

        memorySnapshots.push({
          iteration,
          successCount,
          heapUsed: memoryAfter.heapUsed,
          memoryDelta,
          memoryDeltaMB: memoryDelta / 1024 / 1024,
        })

        console.log(
          `  Iteration ${iteration + 1}: ${successCount} events, heap=${(memoryAfter.heapUsed / 1024 / 1024).toFixed(2)}MB, delta=${(memoryDelta / 1024 / 1024).toFixed(2)}MB`
        )
      }

      // Check for memory growth trend
      const firstHeap = memorySnapshots[0]!.heapUsed
      const lastHeap = memorySnapshots[memorySnapshots.length - 1]!.heapUsed
      const totalGrowth = ((lastHeap - firstHeap) / firstHeap) * 100

      console.log(`  Total heap growth: ${totalGrowth.toFixed(2)}%`)

      // Should not have excessive memory growth (allow up to 50% growth)
      expect(totalGrowth).toBeLessThan(50)

      // Verify all events were processed
      await new Promise((resolve) => setTimeout(resolve, 2000))
      const totalExpectedEvents = iterations * eventsPerIteration
      const entities = await tableHelper.getAllEntities()

      const persistenceRate = (entities.length / totalExpectedEvents) * 100
      expect(persistenceRate).toBeGreaterThanOrEqual(90)
    })
  })

  describe('Error Rate and Reliability', () => {
    it('should maintain low error rates under normal load', async () => {
      const totalRequests = 100

      const { result: responses, duration } = await measurePerformance(
        'Error Rate Test',
        async () => {
          const requests = Array.from(
            { length: totalRequests },
            (_, i) =>
              makeAuthenticatedRequest('/audit', {
                method: 'POST',
                body: JSON.stringify(generateTestEvent(i)),
              }).catch((error) => ({ status: 0, error }) as any) // Catch network errors
          )

          return Promise.all(requests)
        }
      )

      // Analyze response codes
      const statusCounts: Record<number, number> = {}
      responses.forEach((response) => {
        const status = response.status
        statusCounts[status] = (statusCounts[status] || 0) + 1
      })

      console.log('  Response distribution:', statusCounts)

      // Calculate error rate
      const successCount = statusCounts[200] || 0
      const errorRate = ((totalRequests - successCount) / totalRequests) * 100

      console.log(
        `  Success rate: ${((successCount / totalRequests) * 100).toFixed(2)}%`
      )
      console.log(`  Error rate: ${errorRate.toFixed(2)}%`)

      // Should have very low error rate under normal conditions
      expect(errorRate).toBeLessThan(5)

      // Verify persistence
      await new Promise((resolve) => setTimeout(resolve, 2000))
      const entities = await tableHelper.getAllEntities()
      const persistenceRate = (entities.length / successCount) * 100
      expect(persistenceRate).toBeGreaterThanOrEqual(95)
    })
  })

  describe('Database Performance Impact', () => {
    it('should not significantly slow down due to large numbers of existing records', async () => {
      // First, populate database with many records
      console.log('  Populating database with existing records...')
      const populateCount = 1000
      const populateRequests = Array.from({ length: populateCount }, (_, i) =>
        makeAuthenticatedRequest('/audit', {
          method: 'POST',
          body: JSON.stringify(generateTestEvent(i)),
        })
      )

      await Promise.all(populateRequests)
      await new Promise((resolve) => setTimeout(resolve, 5000)) // Wait for population

      // Verify population
      const existingCount = await tableHelper.getEntityCount()
      console.log(`  Database populated with ${existingCount} total records`)

      // Now test performance with existing data
      const testEvent = generateTestEvent(9999)

      const { duration } = await measurePerformance(
        'Performance With Existing Data',
        async () => {
          const response = await makeAuthenticatedRequest('/audit', {
            method: 'POST',
            body: JSON.stringify(testEvent),
          })
          expect(response.status).toBe(200)
          return response
        }
      )

      // Should still be fast even with many existing records
      expect(duration).toBeLessThan(500)

      // Verify the new event was persisted
      await new Promise((resolve) => setTimeout(resolve, 1000))
      const entities = await tableHelper.getAllEntities()
      const testEntity = entities.find((e) => e.rowKey === testEvent.eventId)
      expect(testEntity).toBeTruthy()
    })
  })
})
