/**
 * Tests for log formatters
 */

import {
  formatForDevelopment,
  formatForProduction,
  formatForTest,
} from '../formatter.js'
import { LogEntry } from '../types.js'

describe('Formatters', () => {
  const baseEntry: LogEntry = {
    timestamp: '2025-06-01T10:00:00.000Z',
    level: 'info',
    service: 'test-service',
    message: 'Test message',
  }
  
  describe('formatForTest', () => {
    it('should return empty string', () => {
      expect(formatForTest(baseEntry)).toBe('')
      
      const withContext = { ...baseEntry, context: { userId: 123 } }
      expect(formatForTest(withContext)).toBe('')
    })
  })
  
  describe('formatForDevelopment', () => {
    it('should format basic log entry', () => {
      const output = formatForDevelopment(baseEntry)
      
      expect(output).toContain('INFO')
      expect(output).toContain('test-service')
      expect(output).toContain('Test message')
      expect(output).toMatch(/\d{1,2}:\d{2}:\d{2}/) // Time format
    })
    
    it('should format log entry with context', () => {
      const entry: LogEntry = {
        ...baseEntry,
        context: {
          userId: 123,
          action: 'login',
          success: true,
        }
      }
      
      const output = formatForDevelopment(entry)
      
      expect(output).toContain('userId')
      expect(output).toContain('123')
      expect(output).toContain('action')
      expect(output).toContain('login')
      expect(output).toContain('success')
      expect(output).toContain('true')
    })
    
    it('should use different colors for log levels', () => {
      const debugEntry = { ...baseEntry, level: 'debug' as const }
      const infoEntry = { ...baseEntry, level: 'info' as const }
      const warnEntry = { ...baseEntry, level: 'warn' as const }
      const errorEntry = { ...baseEntry, level: 'error' as const }
      
      const debugOutput = formatForDevelopment(debugEntry)
      const infoOutput = formatForDevelopment(infoEntry)
      const warnOutput = formatForDevelopment(warnEntry)
      const errorOutput = formatForDevelopment(errorEntry)
      
      // Check for ANSI color codes
      expect(debugOutput).toContain('\x1b[90m') // gray
      expect(infoOutput).toContain('\x1b[36m') // cyan
      expect(warnOutput).toContain('\x1b[33m') // yellow
      expect(errorOutput).toContain('\x1b[31m') // red
    })
    
    it('should handle special values in context', () => {
      const entry: LogEntry = {
        ...baseEntry,
        context: {
          nullValue: null,
          undefinedValue: undefined,
          dateValue: new Date('2025-06-01T10:00:00.000Z'),
          errorValue: new Error('Test error'),
          arrayValue: [1, 2, 3],
          objectValue: { nested: true },
        }
      }
      
      const output = formatForDevelopment(entry)
      
      expect(output).toContain('nullValue')
      expect(output).toContain('null')
      expect(output).not.toContain('undefinedValue') // undefined is skipped
      expect(output).toContain('dateValue')
      expect(output).toContain('2025-06-01T10:00:00.000Z')
      expect(output).toContain('errorValue')
      expect(output).toContain('Error: Test error')
      expect(output).toContain('arrayValue')
      expect(output).toContain('[')
      expect(output).toContain('1,')
      expect(output).toContain('2,')
      expect(output).toContain('3')
      expect(output).toContain('objectValue')
      expect(output).toContain('"nested": true')
    })
  })
  
  describe('formatForProduction', () => {
    it('should format as single-line JSON', () => {
      const output = formatForProduction(baseEntry)
      const parsed = JSON.parse(output)
      
      expect(parsed).toEqual({
        timestamp: '2025-06-01T10:00:00.000Z',
        level: 'info',
        service: 'test-service',
        message: 'Test message',
      })
      
      // Ensure it's single-line
      expect(output).not.toContain('\n')
    })
    
    it('should include context in JSON', () => {
      const entry: LogEntry = {
        ...baseEntry,
        context: {
          userId: 123,
          action: 'login',
          metadata: { ip: '127.0.0.1' },
        }
      }
      
      const output = formatForProduction(entry)
      const parsed = JSON.parse(output)
      
      expect(parsed.context).toEqual({
        userId: 123,
        action: 'login',
        metadata: { ip: '127.0.0.1' },
      })
    })
    
    it('should handle Error objects', () => {
      const error = new Error('Test error')
      const entry: LogEntry = {
        ...baseEntry,
        context: { error }
      }
      
      const output = formatForProduction(entry)
      const parsed = JSON.parse(output)
      
      expect(parsed.context.error).toEqual({
        name: 'Error',
        message: 'Test error',
        stack: expect.any(String),
      })
    })
    
    it('should handle BigInt values', () => {
      const entry: LogEntry = {
        ...baseEntry,
        context: { bigNumber: BigInt(123456789012345678901234567890n) }
      }
      
      const output = formatForProduction(entry)
      const parsed = JSON.parse(output)
      
      expect(parsed.context.bigNumber).toBe('123456789012345678901234567890')
    })
    
    it('should handle undefined by converting to null', () => {
      const entry: LogEntry = {
        ...baseEntry,
        context: { undefinedValue: undefined }
      }
      
      const output = formatForProduction(entry)
      const parsed = JSON.parse(output)
      
      expect(parsed.context.undefinedValue).toBe(null)
    })
    
    it('should handle circular references gracefully', () => {
      const circular: any = { a: 1 }
      circular.self = circular
      
      const entry: LogEntry = {
        ...baseEntry,
        context: { circular }
      }
      
      const output = formatForProduction(entry)
      const parsed = JSON.parse(output)
      
      expect(parsed.context.formatError).toBe('Failed to serialize log entry')
      expect(parsed.context.error).toBeDefined()
    })
  })
})