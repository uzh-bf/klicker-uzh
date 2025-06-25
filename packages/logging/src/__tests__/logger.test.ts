/**
 * Tests for core logger implementation
 */

import { 
  createLogger, 
  parseLogLevel, 
  shouldLog, 
  mergeContext,
  createLogEntry,
  createLoggerState,
  generateCorrelationId,
} from '../logger.js'
import { LogLevel } from '../types.js'

describe('Logger', () => {
  const originalNodeEnv = process.env.NODE_ENV
  const originalLogLevel = process.env.LOG_LEVEL
  let consoleLogSpy: jest.SpyInstance
  let consoleErrorSpy: jest.SpyInstance
  
  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation()
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()
  })
  
  afterEach(() => {
    consoleLogSpy.mockRestore()
    consoleErrorSpy.mockRestore()
    process.env.NODE_ENV = originalNodeEnv
    if (originalLogLevel !== undefined) {
      process.env.LOG_LEVEL = originalLogLevel
    } else {
      delete process.env.LOG_LEVEL
    }
  })
  
  describe('Test Environment', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'test'
    })
    
    it('should be completely silent in test environment', () => {
      const logger = createLogger({ service: 'test-service' })
      
      logger.debug('Debug message')
      logger.info('Info message')
      logger.warn('Warning message')
      logger.error('Error message')
      
      expect(consoleLogSpy).not.toHaveBeenCalled()
      expect(consoleErrorSpy).not.toHaveBeenCalled()
    })
    
    it('should create child loggers that are also silent', () => {
      const logger = createLogger({ service: 'test-service' })
      const childLogger = logger.child({ requestId: '123' })
      
      childLogger.info('Child logger message')
      
      expect(consoleLogSpy).not.toHaveBeenCalled()
    })
  })
  
  describe('Development Environment', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development'
    })
    
    it('should output human-readable logs in development', () => {
      const logger = createLogger({ service: 'dev-service' })
      
      logger.info('Test message')
      
      expect(consoleLogSpy).toHaveBeenCalledTimes(1)
      const output = consoleLogSpy.mock.calls[0][0]
      expect(output).toContain('INFO')
      expect(output).toContain('dev-service')
      expect(output).toContain('Test message')
    })
    
    it('should include context in development logs', () => {
      const logger = createLogger({ service: 'dev-service' })
      
      logger.info('Test message', { userId: 123, action: 'login' })
      
      expect(consoleLogSpy).toHaveBeenCalledTimes(1)
      const output = consoleLogSpy.mock.calls[0][0]
      expect(output).toContain('userId')
      expect(output).toContain('123')
      expect(output).toContain('action')
      expect(output).toContain('login')
    })
    
    it('should respect log level in development', () => {
      const logger = createLogger({ 
        service: 'dev-service',
        level: 'warn'
      })
      
      logger.debug('Debug message')
      logger.info('Info message')
      logger.warn('Warning message')
      logger.error('Error message')
      
      expect(consoleLogSpy).toHaveBeenCalledTimes(2)
      const calls = consoleLogSpy.mock.calls
      expect(calls[0][0]).toContain('WARN')
      expect(calls[1][0]).toContain('ERROR')
    })
  })
  
  describe('Production Environment', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production'
    })
    
    it('should output JSON logs in production', () => {
      const logger = createLogger({ service: 'prod-service' })
      
      logger.info('Test message')
      
      expect(consoleLogSpy).toHaveBeenCalledTimes(1)
      const output = consoleLogSpy.mock.calls[0][0]
      const parsed = JSON.parse(output)
      
      expect(parsed.level).toBe('info')
      expect(parsed.service).toBe('prod-service')
      expect(parsed.message).toBe('Test message')
      expect(parsed.timestamp).toBeDefined()
    })
    
    it('should include context in JSON output', () => {
      const logger = createLogger({ service: 'prod-service' })
      
      logger.info('Test message', { userId: 123, action: 'login' })
      
      expect(consoleLogSpy).toHaveBeenCalledTimes(1)
      const output = consoleLogSpy.mock.calls[0][0]
      const parsed = JSON.parse(output)
      
      expect(parsed.context).toEqual({
        userId: 123,
        action: 'login'
      })
    })
    
    it('should handle Error objects in production', () => {
      const logger = createLogger({ service: 'prod-service' })
      const error = new Error('Test error')
      
      logger.error('Operation failed', { error })
      
      expect(consoleLogSpy).toHaveBeenCalledTimes(1)
      const output = consoleLogSpy.mock.calls[0][0]
      const parsed = JSON.parse(output)
      
      expect(parsed.context.error).toEqual({
        name: 'Error',
        message: 'Test error',
        stack: expect.any(String)
      })
    })
  })
  
  describe('Child Loggers', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production'
    })
    
    it('should inherit context from parent logger', () => {
      const logger = createLogger({ 
        service: 'parent-service',
        context: { appVersion: '1.0.0' }
      })
      
      logger.info('Parent message')
      
      const childLogger = logger.child({ requestId: 'req-123' })
      childLogger.info('Child message')
      
      expect(consoleLogSpy).toHaveBeenCalledTimes(2)
      
      const parentOutput = JSON.parse(consoleLogSpy.mock.calls[0][0])
      expect(parentOutput.context).toEqual({ appVersion: '1.0.0' })
      
      const childOutput = JSON.parse(consoleLogSpy.mock.calls[1][0])
      expect(childOutput.context).toEqual({
        appVersion: '1.0.0',
        requestId: 'req-123'
      })
    })
    
    it('should allow nested child loggers', () => {
      const logger = createLogger({ service: 'root' })
      const child1 = logger.child({ level1: 'a' })
      const child2 = child1.child({ level2: 'b' })
      
      child2.info('Nested message')
      
      expect(consoleLogSpy).toHaveBeenCalledTimes(1)
      const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
      expect(output.context).toEqual({
        level1: 'a',
        level2: 'b'
      })
    })
  })
  
  describe('Log Level Filtering', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production'
    })
    
    it('should respect environment variable LOG_LEVEL', () => {
      process.env.LOG_LEVEL = 'error'
      const logger = createLogger({ service: 'test' })
      
      logger.debug('Debug')
      logger.info('Info')
      logger.warn('Warn')
      logger.error('Error')
      
      expect(consoleLogSpy).toHaveBeenCalledTimes(1)
      const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
      expect(output.level).toBe('error')
    })
    
    it('should allow logger-specific level override', () => {
      process.env.LOG_LEVEL = 'error'
      const logger = createLogger({ 
        service: 'test',
        level: 'debug'
      })
      
      logger.debug('Debug message')
      
      expect(consoleLogSpy).toHaveBeenCalledTimes(1)
    })
  })
  
  describe('Error Handling', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production'
    })
    
    it('should not crash on circular references', () => {
      const logger = createLogger({ service: 'test' })
      
      const obj: any = { a: 1 }
      obj.circular = obj
      
      expect(() => {
        logger.info('Circular reference test', { obj })
      }).not.toThrow()
      
      expect(consoleLogSpy).toHaveBeenCalled()
    })
    
    it('should handle formatter errors gracefully', () => {
      const logger = createLogger({ service: 'test' })
      
      // Create an object that will throw during stringification
      const badObject = {
        toJSON() {
          throw new Error('Stringify error')
        }
      }
      
      expect(() => {
        logger.info('Bad object test', { bad: badObject })
      }).not.toThrow()
    })
  })
  
  describe('Utility Functions', () => {
    describe('parseLogLevel', () => {
      it('should parse all log level strings correctly', () => {
        expect(parseLogLevel('debug')).toBe(LogLevel.DEBUG)
        expect(parseLogLevel('info')).toBe(LogLevel.INFO)
        expect(parseLogLevel('warn')).toBe(LogLevel.WARN)
        expect(parseLogLevel('error')).toBe(LogLevel.ERROR)
      })
    })
    
    describe('shouldLog', () => {
      it('should return true when message level >= configured level', () => {
        expect(shouldLog(LogLevel.ERROR, LogLevel.DEBUG)).toBe(true)
        expect(shouldLog(LogLevel.WARN, LogLevel.WARN)).toBe(true)
        expect(shouldLog(LogLevel.INFO, LogLevel.ERROR)).toBe(false)
        expect(shouldLog(LogLevel.DEBUG, LogLevel.INFO)).toBe(false)
      })
    })
    
    describe('mergeContext', () => {
      it('should return undefined when both contexts are empty', () => {
        expect(mergeContext({}, undefined)).toBeUndefined()
        expect(mergeContext({}, {})).toBeUndefined()
      })
      
      it('should return base context when message context is empty', () => {
        const baseContext = { base: 'value' }
        expect(mergeContext(baseContext, undefined)).toBe(baseContext)
        expect(mergeContext(baseContext, {})).toBe(baseContext)
      })
      
      it('should return message context when base context is empty', () => {
        const messageContext = { message: 'value' }
        expect(mergeContext({}, messageContext)).toBe(messageContext)
      })
      
      it('should merge both contexts with message context taking precedence', () => {
        const baseContext = { shared: 'base', base: 'value' }
        const messageContext = { shared: 'message', message: 'value' }
        
        expect(mergeContext(baseContext, messageContext)).toEqual({
          shared: 'message',
          base: 'value',
          message: 'value'
        })
      })
    })
    
    describe('createLogEntry', () => {
      it('should create log entry with correct structure', () => {
        const entry = createLogEntry(
          'info',
          'Test message',
          'test-service',
          { base: 'value' },
          undefined, // correlationId
          { message: 'context' }
        )
        
        expect(entry).toEqual({
          timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
          level: 'info',
          service: 'test-service',
          message: 'Test message',
          context: {
            base: 'value',
            message: 'context'
          }
        })
      })
    })
    
    describe('createLoggerState', () => {
      beforeEach(() => {
        process.env.NODE_ENV = 'test'
      })
      
      it('should create logger state with correct defaults', () => {
        const state = createLoggerState({ service: 'test-service' })
        
        expect(state.service).toBe('test-service')
        expect(state.environment).toBe('test')
        expect(state.logLevel).toBe(LogLevel.ERROR) // Test environment defaults to ERROR level
        expect(state.baseContext).toEqual({})
        expect(typeof state.formatter).toBe('function')
        expect(typeof state.output).toBe('function')
      })
      
      it('should respect provided configuration', () => {
        const state = createLoggerState({
          service: 'custom-service',
          level: 'warn',
          context: { custom: 'context' }
        })
        
        expect(state.service).toBe('custom-service')
        expect(state.logLevel).toBe(LogLevel.WARN)
        expect(state.baseContext).toEqual({ custom: 'context' })
      })
    })
  })
  
  describe('Correlation ID Support', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development'
    })
    
    it('should generate valid correlation IDs', () => {
      const id1 = generateCorrelationId()
      const id2 = generateCorrelationId()
      
      // Should be valid UUIDs
      expect(id1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
      expect(id2).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
      
      // Should be unique
      expect(id1).not.toBe(id2)
    })
    
    it('should include correlation ID in logger config', () => {
      const correlationId = generateCorrelationId()
      const logger = createLogger({ 
        service: 'test-service',
        correlationId 
      })
      
      logger.info('Test message')
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining(correlationId.substring(0, 8))
      )
    })
    
    it('should propagate correlation ID to child loggers', () => {
      const correlationId = generateCorrelationId()
      const parentLogger = createLogger({ 
        service: 'parent-service',
        correlationId 
      })
      
      const childLogger = parentLogger.child({ operation: 'test-op' })
      
      childLogger.info('Child message')
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining(correlationId.substring(0, 8))
      )
    })
    
    it('should include correlation ID in production JSON output', () => {
      process.env.NODE_ENV = 'production'
      const correlationId = generateCorrelationId()
      const logger = createLogger({ 
        service: 'prod-service',
        correlationId 
      })
      
      logger.info('Test message')
      
      expect(consoleLogSpy).toHaveBeenCalled()
      const logOutput = consoleLogSpy.mock.calls[0][0]
      const parsed = JSON.parse(logOutput)
      
      expect(parsed.correlationId).toBe(correlationId)
    })
    
    it('should not show correlation ID when not provided', () => {
      const logger = createLogger({ service: 'test-service' })
      
      logger.info('Test message')
      
      const output = consoleLogSpy.mock.calls[0][0]
      // Check that there's no correlation ID (8-char UUID segment) in brackets
      expect(output).not.toMatch(/\[[0-9a-f]{8}\]/)
    })
    
    it('should include correlation ID in log entry creation', () => {
      const correlationId = generateCorrelationId()
      const entry = createLogEntry(
        'info',
        'Test message',
        'test-service',
        {},
        correlationId,
        { extra: 'context' }
      )
      
      expect(entry.correlationId).toBe(correlationId)
      expect(entry.level).toBe('info')
      expect(entry.message).toBe('Test message')
      expect(entry.context).toEqual({ extra: 'context' })
    })
  })
})