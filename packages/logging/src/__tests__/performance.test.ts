/**
 * Performance tests for logging package
 */

import { createOperationContext, createPerformanceContext } from '../context.js'
import { createLogger } from '../logger.js'

describe('Performance', () => {
  const originalNodeEnv = process.env.NODE_ENV
  let consoleLogSpy: jest.SpyInstance

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation()
  })

  afterEach(() => {
    consoleLogSpy.mockRestore()
    process.env.NODE_ENV = originalNodeEnv
  })

  describe('Logging Overhead', () => {
    it('should meet <1ms per log call requirement in production', () => {
      process.env.NODE_ENV = 'production'
      const logger = createLogger({ service: 'perf-test' })

      const iterations = 1000
      const start = process.hrtime.bigint()

      for (let i = 0; i < iterations; i++) {
        logger.info('Test message', { index: i, value: 'test' })
      }

      const end = process.hrtime.bigint()
      const durationNs = Number(end - start)
      const durationMs = durationNs / 1_000_000
      const perCallMs = durationMs / iterations

      // Restore console.log temporarily to show performance result
      consoleLogSpy.mockRestore()
      console.log(
        `Performance: ${perCallMs.toFixed(3)}ms per call (${iterations} calls in ${durationMs.toFixed(1)}ms)`
      )
      consoleLogSpy = jest.spyOn(console, 'log').mockImplementation()

      expect(perCallMs).toBeLessThan(1)
    })

    it('should handle high-volume logging efficiently', () => {
      process.env.NODE_ENV = 'production'
      const logger = createLogger({ service: 'high-volume-test' })

      // Simulate 1000 operations per minute (16.67 per second)
      const operationsPerMinute = 1000
      const testDurationMs = 3000 // 3 seconds
      const expectedOperations = Math.floor(
        (operationsPerMinute * testDurationMs) / 60000
      )

      const start = process.hrtime.bigint()
      let operations = 0

      const deadline = Date.now() + testDurationMs
      while (Date.now() < deadline) {
        logger.info(
          'Operation processed',
          createOperationContext(`op-${operations}`, 'TEST_OPERATION')
        )
        operations++

        // Simulate some work between logs (1-5ms)
        const workTime = Math.random() * 4 + 1
        const workEnd = Date.now() + workTime
        while (Date.now() < workEnd) {
          // Busy wait
        }
      }

      const end = process.hrtime.bigint()
      const durationMs = Number(end - start) / 1_000_000
      const opsPerSecond = operations / (durationMs / 1000)

      consoleLogSpy.mockRestore()
      console.log(
        `High-volume test: ${operations} operations in ${durationMs.toFixed(0)}ms (${opsPerSecond.toFixed(1)} ops/sec)`
      )
      consoleLogSpy = jest.spyOn(console, 'log').mockImplementation()

      expect(operations).toBeGreaterThanOrEqual(expectedOperations * 0.9) // Allow 10% variance
    })
  })

  describe('Memory Usage', () => {
    it('should not leak memory with child loggers', () => {
      process.env.NODE_ENV = 'production'
      const logger = createLogger({ service: 'memory-test' })

      const memBefore = process.memoryUsage().heapUsed

      // Create many child loggers
      for (let i = 0; i < 1000; i++) {
        const childLogger = logger.child({ requestId: `req-${i}` })
        childLogger.info('Child logger message')
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc()
      }

      const memAfter = process.memoryUsage().heapUsed
      const memIncreaseMB = (memAfter - memBefore) / 1024 / 1024

      consoleLogSpy.mockRestore()
      console.log(`Memory increase: ${memIncreaseMB.toFixed(2)}MB`)
      consoleLogSpy = jest.spyOn(console, 'log').mockImplementation()

      // Should not increase by more than 10MB for 1000 child loggers
      expect(memIncreaseMB).toBeLessThan(10)
    })

    it('should handle large contexts efficiently', () => {
      process.env.NODE_ENV = 'production'
      const logger = createLogger({ service: 'context-test' })

      const largeContext = {
        users: Array(100)
          .fill(null)
          .map((_, i) => ({
            id: `user-${i}`,
            name: `User ${i}`,
            email: `user${i}@example.com`,
            metadata: { active: true, score: Math.random() * 100 },
          })),
        timestamp: Date.now(),
        operation: 'BULK_UPDATE',
      }

      const start = process.hrtime.bigint()

      for (let i = 0; i < 100; i++) {
        logger.info('Bulk operation', largeContext)
      }

      const end = process.hrtime.bigint()
      const durationMs = Number(end - start) / 1_000_000
      const perCallMs = durationMs / 100

      consoleLogSpy.mockRestore()
      console.log(`Large context: ${perCallMs.toFixed(3)}ms per call`)
      consoleLogSpy = jest.spyOn(console, 'log').mockImplementation()

      // Even with large contexts, should stay under 5ms
      expect(perCallMs).toBeLessThan(5)
    })
  })

  describe('Context Creation Performance', () => {
    it('should create contexts quickly', () => {
      const iterations = 10000
      const start = process.hrtime.bigint()

      for (let i = 0; i < iterations; i++) {
        createOperationContext(`op-${i}`, 'TEST_TYPE', { index: i })
      }

      const end = process.hrtime.bigint()
      const durationMs = Number(end - start) / 1_000_000
      const perCallUs = (durationMs * 1000) / iterations

      consoleLogSpy.mockRestore()
      console.log(`Context creation: ${perCallUs.toFixed(2)}μs per call`)
      consoleLogSpy = jest.spyOn(console, 'log').mockImplementation()

      // Context creation should be very fast (under 10 microseconds)
      expect(perCallUs).toBeLessThan(10)
    })

    it('should calculate performance metrics efficiently', () => {
      const iterations = 10000
      const durations: number[] = []

      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now() - Math.random() * 1000 // Random duration 0-1000ms
        const start = process.hrtime.bigint()

        createPerformanceContext(startTime, { operation: 'test' })

        const end = process.hrtime.bigint()
        durations.push(Number(end - start))
      }

      const avgDurationNs =
        durations.reduce((a, b) => a + b, 0) / durations.length
      const avgDurationUs = avgDurationNs / 1000

      consoleLogSpy.mockRestore()
      console.log(`Performance context: ${avgDurationUs.toFixed(2)}μs per call`)
      consoleLogSpy = jest.spyOn(console, 'log').mockImplementation()

      expect(avgDurationUs).toBeLessThan(10)
    })
  })
})
