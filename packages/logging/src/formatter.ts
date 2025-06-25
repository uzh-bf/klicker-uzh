/**
 * Formatters for different environments
 */

import { LogEntry, LogContext, LogLevelString } from './types.js'

/**
 * ANSI color codes for console output
 */
const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
}

/**
 * Get color for log level
 */
function getLevelColor(level: LogLevelString): string {
  switch (level) {
    case 'debug':
      return COLORS.gray
    case 'info':
      return COLORS.cyan
    case 'warn':
      return COLORS.yellow
    case 'error':
      return COLORS.red
  }
}

/**
 * Format log entry for development (human-readable console output)
 */
export function formatForDevelopment(entry: LogEntry): string {
  const { timestamp, level, service, message, context } = entry
  const levelColor = getLevelColor(level)
  const time = new Date(timestamp).toLocaleTimeString()
  
  let output = `${COLORS.gray}[${time}]${COLORS.reset} `
  output += `${levelColor}${level.toUpperCase().padEnd(5)}${COLORS.reset} `
  output += `${COLORS.blue}[${service}]${COLORS.reset} `
  output += message
  
  if (context && Object.keys(context).length > 0) {
    output += '\n' + formatContext(context, '  ')
  }
  
  return output
}

/**
 * Format context object for console output
 */
function formatContext(context: LogContext, indent: string): string {
  const lines: string[] = []
  
  for (const [key, value] of Object.entries(context)) {
    if (value === undefined) continue
    
    const formattedValue = formatValue(value)
    lines.push(`${indent}${COLORS.dim}${key}:${COLORS.reset} ${formattedValue}`)
  }
  
  return lines.join('\n')
}

/**
 * Format individual values for console output
 */
function formatValue(value: unknown): string {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  if (typeof value === 'boolean') return String(value)
  
  if (value instanceof Error) {
    return `${value.name}: ${value.message}`
  }
  
  if (value instanceof Date) {
    return value.toISOString()
  }
  
  // For objects and arrays, use JSON.stringify with 2-space indent
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return '[Circular or unstringifiable object]'
  }
}

/**
 * Custom replacer for JSON.stringify to handle special types
 */
function jsonReplacer(key: string, value: unknown): unknown {
  // Handle undefined (normally omitted by JSON.stringify)
  if (value === undefined) {
    return null
  }
  
  // Handle Error objects
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    }
  }
  
  // Handle BigInt
  if (typeof value === 'bigint') {
    return value.toString()
  }
  
  return value
}

/**
 * Format log entry for production (single-line JSON)
 */
export function formatForProduction(entry: LogEntry): string {
  try {
    return JSON.stringify(entry, jsonReplacer)
  } catch (error) {
    // Fallback for circular references or other errors
    const safeEntry: LogEntry = {
      timestamp: entry.timestamp,
      level: entry.level,
      service: entry.service,
      message: entry.message,
      context: {
        formatError: 'Failed to serialize log entry',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    }
    return JSON.stringify(safeEntry)
  }
}

/**
 * No-op formatter for test environment (returns empty string)
 */
export function formatForTest(_entry: LogEntry): string {
  return ''
}