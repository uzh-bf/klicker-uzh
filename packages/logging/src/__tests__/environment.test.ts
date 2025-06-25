/**
 * Tests for environment detection and configuration
 */

import {
  detectEnvironment,
  getDefaultLogLevel,
  parseLogLevel,
  getLogLevelString,
  isTest,
  isDevelopment,
  isProduction,
  getEnvironmentConfig,
} from '../environment.js'
import { LogLevel } from '../types.js'

describe('Environment Detection', () => {
  const originalNodeEnv = process.env.NODE_ENV
  const originalLogLevel = process.env.LOG_LEVEL
  
  beforeEach(() => {
    delete process.env.NODE_ENV
    delete process.env.LOG_LEVEL
  })
  
  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv
    if (originalLogLevel !== undefined) {
      process.env.LOG_LEVEL = originalLogLevel
    }
  })
  
  describe('detectEnvironment', () => {
    it('should detect test environment', () => {
      process.env.NODE_ENV = 'test'
      expect(detectEnvironment()).toBe('test')
    })
    
    it('should detect production environment', () => {
      process.env.NODE_ENV = 'production'
      expect(detectEnvironment()).toBe('production')
      
      process.env.NODE_ENV = 'prod'
      expect(detectEnvironment()).toBe('production')
    })
    
    it('should detect development environment', () => {
      process.env.NODE_ENV = 'development'
      expect(detectEnvironment()).toBe('development')
      
      process.env.NODE_ENV = 'dev'
      expect(detectEnvironment()).toBe('development')
    })
    
    it('should default to development for unknown values', () => {
      process.env.NODE_ENV = 'staging'
      expect(detectEnvironment()).toBe('development')
      
      delete process.env.NODE_ENV
      expect(detectEnvironment()).toBe('development')
    })
    
    it('should handle case insensitive values', () => {
      process.env.NODE_ENV = 'TEST'
      expect(detectEnvironment()).toBe('test')
      
      process.env.NODE_ENV = 'Production'
      expect(detectEnvironment()).toBe('production')
    })
  })
  
  describe('getDefaultLogLevel', () => {
    it('should return ERROR for test environment', () => {
      expect(getDefaultLogLevel('test')).toBe(LogLevel.ERROR)
    })
    
    it('should return INFO for production environment', () => {
      expect(getDefaultLogLevel('production')).toBe(LogLevel.INFO)
    })
    
    it('should return DEBUG for development environment', () => {
      expect(getDefaultLogLevel('development')).toBe(LogLevel.DEBUG)
    })
  })
  
  describe('parseLogLevel', () => {
    it('should parse valid log levels', () => {
      expect(parseLogLevel('debug')).toBe(LogLevel.DEBUG)
      expect(parseLogLevel('info')).toBe(LogLevel.INFO)
      expect(parseLogLevel('warn')).toBe(LogLevel.WARN)
      expect(parseLogLevel('warning')).toBe(LogLevel.WARN)
      expect(parseLogLevel('error')).toBe(LogLevel.ERROR)
    })
    
    it('should handle case insensitive values', () => {
      expect(parseLogLevel('DEBUG')).toBe(LogLevel.DEBUG)
      expect(parseLogLevel('Info')).toBe(LogLevel.INFO)
      expect(parseLogLevel('WARN')).toBe(LogLevel.WARN)
    })
    
    it('should return undefined for invalid values', () => {
      expect(parseLogLevel('invalid')).toBeUndefined()
      expect(parseLogLevel('')).toBeUndefined()
      expect(parseLogLevel(undefined)).toBeUndefined()
    })
  })
  
  describe('getLogLevelString', () => {
    it('should convert log level enum to string', () => {
      expect(getLogLevelString(LogLevel.DEBUG)).toBe('debug')
      expect(getLogLevelString(LogLevel.INFO)).toBe('info')
      expect(getLogLevelString(LogLevel.WARN)).toBe('warn')
      expect(getLogLevelString(LogLevel.ERROR)).toBe('error')
    })
  })
  
  describe('Type guards', () => {
    it('should correctly identify test environment', () => {
      expect(isTest('test')).toBe(true)
      expect(isTest('development')).toBe(false)
      expect(isTest('production')).toBe(false)
    })
    
    it('should correctly identify development environment', () => {
      expect(isDevelopment('development')).toBe(true)
      expect(isDevelopment('test')).toBe(false)
      expect(isDevelopment('production')).toBe(false)
    })
    
    it('should correctly identify production environment', () => {
      expect(isProduction('production')).toBe(true)
      expect(isProduction('test')).toBe(false)
      expect(isProduction('development')).toBe(false)
    })
  })
  
  describe('getEnvironmentConfig', () => {
    it('should return complete environment configuration', () => {
      process.env.NODE_ENV = 'production'
      const config = getEnvironmentConfig()
      
      expect(config).toEqual({
        environment: 'production',
        logLevel: LogLevel.INFO,
        isTest: false,
        isDevelopment: false,
        isProduction: true,
      })
    })
    
    it('should respect environment override', () => {
      process.env.NODE_ENV = 'production'
      const config = getEnvironmentConfig('test')
      
      expect(config).toEqual({
        environment: 'test',
        logLevel: LogLevel.ERROR,
        isTest: true,
        isDevelopment: false,
        isProduction: false,
      })
    })
    
    it('should respect LOG_LEVEL environment variable', () => {
      process.env.NODE_ENV = 'production'
      process.env.LOG_LEVEL = 'debug'
      const config = getEnvironmentConfig()
      
      expect(config).toEqual({
        environment: 'production',
        logLevel: LogLevel.DEBUG,
        isTest: false,
        isDevelopment: false,
        isProduction: true,
      })
    })
    
    it('should ignore invalid LOG_LEVEL values', () => {
      process.env.NODE_ENV = 'production'
      process.env.LOG_LEVEL = 'invalid'
      const config = getEnvironmentConfig()
      
      expect(config.logLevel).toBe(LogLevel.INFO) // Default for production
    })
  })
})