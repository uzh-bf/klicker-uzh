export type EdgeLogLevel =
  | 'trace'
  | 'debug'
  | 'info'
  | 'warn'
  | 'error'
  | 'fatal'
  | 'silent'

type EmittedEdgeLogLevel = Exclude<EdgeLogLevel, 'silent'>

export interface EdgeHttpFields {
  method?: string
  route?: string
  statusCode?: number
  durationMs?: number
}

export interface EdgeLogFields {
  event: string
  requestId?: string
  correlationId?: string
  traceId?: string
  spanId?: string
  audience?: string
  http?: EdgeHttpFields
  err?: Error
  outcome?: string
}

export type EdgeLogBindings = Omit<EdgeLogFields, 'event' | 'err'>

export type EdgeSink = (level: EmittedEdgeLogLevel, line: string) => void

export interface EdgeLogger {
  child(bindings: EdgeLogBindings): EdgeLogger
  trace(fields: EdgeLogFields, msg: string): void
  debug(fields: EdgeLogFields, msg: string): void
  info(fields: EdgeLogFields, msg: string): void
  warn(fields: EdgeLogFields, msg: string): void
  error(fields: EdgeLogFields, msg: string): void
  fatal(fields: EdgeLogFields, msg: string): void
}

export interface CreateEdgeLoggerOptions {
  service: string
  level?: string
  sink?: EdgeSink
}

const LEVEL_VALUES: Record<EdgeLogLevel, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
  silent: Number.POSITIVE_INFINITY,
}

function resolveLevel(level?: string): EdgeLogLevel {
  const normalized = level?.toLowerCase()
  return normalized && normalized in LEVEL_VALUES
    ? (normalized as EdgeLogLevel)
    : 'info'
}

function defaultSink(level: EmittedEdgeLogLevel, line: string): void {
  if (level === 'fatal' || level === 'error') {
    console.error(line)
  } else if (level === 'warn') {
    console.warn(line)
  } else if (level === 'info') {
    console.info(line)
  } else {
    console.debug(line)
  }
}

function approvedHttpFields(http: EdgeHttpFields): EdgeHttpFields {
  return {
    ...(typeof http.method === 'string' ? { method: http.method } : {}),
    ...(typeof http.route === 'string' ? { route: http.route } : {}),
    ...(typeof http.statusCode === 'number'
      ? { statusCode: http.statusCode }
      : {}),
    ...(typeof http.durationMs === 'number'
      ? { durationMs: http.durationMs }
      : {}),
  }
}

function approvedFields(
  fields: Partial<EdgeLogFields>
): Record<string, unknown> {
  return {
    ...(typeof fields.event === 'string' ? { event: fields.event } : {}),
    ...(typeof fields.requestId === 'string'
      ? { requestId: fields.requestId }
      : {}),
    ...(typeof fields.correlationId === 'string'
      ? { correlationId: fields.correlationId }
      : {}),
    ...(typeof fields.traceId === 'string' ? { traceId: fields.traceId } : {}),
    ...(typeof fields.spanId === 'string' ? { spanId: fields.spanId } : {}),
    ...(typeof fields.audience === 'string'
      ? { audience: fields.audience }
      : {}),
    ...(fields.http ? { http: approvedHttpFields(fields.http) } : {}),
    ...(fields.err instanceof Error
      ? {
          err: {
            type: fields.err.name,
            message: fields.err.message,
          },
        }
      : {}),
    ...(typeof fields.outcome === 'string' ? { outcome: fields.outcome } : {}),
  }
}

function makeEdgeLogger({
  service,
  threshold,
  sink,
  bindings,
}: {
  service: string
  threshold: EdgeLogLevel
  sink: EdgeSink
  bindings: Record<string, unknown>
}): EdgeLogger {
  const write = (
    level: EmittedEdgeLogLevel,
    fields: EdgeLogFields,
    msg: string
  ) => {
    if (LEVEL_VALUES[level] < LEVEL_VALUES[threshold]) return

    sink(
      level,
      JSON.stringify({
        time: Date.now(),
        level,
        service,
        ...bindings,
        ...approvedFields(fields),
        msg,
      })
    )
  }

  return {
    child(childBindings) {
      return makeEdgeLogger({
        service,
        threshold,
        sink,
        bindings: {
          ...bindings,
          ...approvedFields(childBindings),
        },
      })
    },
    trace: (fields, msg) => write('trace', fields, msg),
    debug: (fields, msg) => write('debug', fields, msg),
    info: (fields, msg) => write('info', fields, msg),
    warn: (fields, msg) => write('warn', fields, msg),
    error: (fields, msg) => write('error', fields, msg),
    fatal: (fields, msg) => write('fatal', fields, msg),
  }
}

export function createEdgeLogger(options: CreateEdgeLoggerOptions): EdgeLogger {
  return makeEdgeLogger({
    service: options.service,
    threshold: resolveLevel(options.level),
    sink: options.sink ?? defaultSink,
    bindings: {},
  })
}
