/**
 * Tests for context utilities
 */

import {
  sanitizeContext,
  createOperationContext,
  createUserContext,
  createRequestContext,
  createPerformanceContext,
} from '../context.js'

describe('Context Utilities', () => {
  describe('sanitizeContext', () => {
    it('should handle invalid inputs', () => {
      expect(sanitizeContext(null as any)).toEqual({})
      expect(sanitizeContext(undefined as any)).toEqual({})
      expect(sanitizeContext('string' as any)).toEqual({})
      expect(sanitizeContext(123 as any)).toEqual({})
    })
    
    it('should pass through valid context', () => {
      const context = { userId: 123, action: 'login' }
      expect(sanitizeContext(context)).toEqual(context)
    })
    
    it('should handle circular references', () => {
      const context: any = { a: 1 }
      context.circular = context
      
      const result = sanitizeContext(context)
      expect(result).toEqual({
        _warning: 'Context contains circular references',
      })
    })
    
    it('should truncate large contexts', () => {
      const largeContext: any = {}
      // Create a context that exceeds 1000 characters when stringified
      for (let i = 0; i < 100; i++) {
        largeContext[`field${i}`] = 'This is a long value that will contribute to size'
      }
      
      const result = sanitizeContext(largeContext)
      expect(result._warning).toBe('Context too large, truncated')
      expect(result._originalSize).toBeGreaterThan(1000)
    })
  })
  
  describe('createOperationContext', () => {
    it('should create basic operation context', () => {
      const context = createOperationContext('op-123')
      expect(context).toEqual({
        operationId: 'op-123',
      })
    })
    
    it('should include operation type when provided', () => {
      const context = createOperationContext('op-123', 'PROCESS_USER_ACCESS')
      expect(context).toEqual({
        operationId: 'op-123',
        operationType: 'PROCESS_USER_ACCESS',
      })
    })
    
    it('should merge additional context', () => {
      const context = createOperationContext('op-123', 'PROCESS_USER_ACCESS', {
        userId: 'user-456',
        priority: 10,
      })
      expect(context).toEqual({
        operationId: 'op-123',
        operationType: 'PROCESS_USER_ACCESS',
        userId: 'user-456',
        priority: 10,
      })
    })
  })
  
  describe('createUserContext', () => {
    it('should create basic user context', () => {
      const context = createUserContext('user-123')
      expect(context).toEqual({
        userId: 'user-123',
      })
    })
    
    it('should merge additional context', () => {
      const context = createUserContext('user-123', {
        role: 'admin',
        email: 'user@example.com',
      })
      expect(context).toEqual({
        userId: 'user-123',
        role: 'admin',
        email: 'user@example.com',
      })
    })
  })
  
  describe('createRequestContext', () => {
    it('should create basic request context', () => {
      const context = createRequestContext('req-123')
      expect(context).toEqual({
        requestId: 'req-123',
      })
    })
    
    it('should include method and path when provided', () => {
      const context = createRequestContext('req-123', 'POST', '/api/users')
      expect(context).toEqual({
        requestId: 'req-123',
        method: 'POST',
        path: '/api/users',
      })
    })
    
    it('should merge additional context', () => {
      const context = createRequestContext('req-123', 'GET', '/api/users', {
        ip: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
      })
      expect(context).toEqual({
        requestId: 'req-123',
        method: 'GET',
        path: '/api/users',
        ip: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
      })
    })
  })
  
  describe('createPerformanceContext', () => {
    it('should calculate duration', () => {
      const startTime = Date.now() - 150 // 150ms ago
      const context = createPerformanceContext(startTime)
      
      expect(context.duration).toBeGreaterThanOrEqual(150)
      expect(context.duration).toBeLessThan(200) // Allow some wiggle room
      expect(context.durationMs).toBe(context.duration)
    })
    
    it('should merge additional context', () => {
      const startTime = Date.now() - 100
      const context = createPerformanceContext(startTime, {
        operationCount: 50,
        success: true,
      })
      
      expect(context).toMatchObject({
        duration: expect.any(Number),
        durationMs: expect.any(Number),
        operationCount: 50,
        success: true,
      })
    })
  })
})