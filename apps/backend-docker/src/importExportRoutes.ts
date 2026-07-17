import {
  downloadLocalElementExportPackage,
  getImportExportErrorCode,
  getLocalImportedMediaDownload,
  ImportExportErrorCode,
  uploadPreparedElementImportPackage,
} from '@klicker-uzh/graphql'
import { UserLoginScope, UserRole } from '@klicker-uzh/prisma/client'
import { ELEMENT_IMPORT_EXPORT_PACKAGE_MAX_BYTES } from '@klicker-uzh/types'
import type { Express as ExpressApplication, Request, Response } from 'express'

declare global {
  namespace Express {
    interface Request {
      locals: { user?: unknown }
    }
  }
}

const IMPORT_UPLOAD_CAPABILITY_HEADER = 'x-klicker-import-upload-capability'
const ZIP_CONTENT_TYPE = 'application/zip'
const DEFAULT_UPLOAD_BODY_TIMEOUT_MS = 60_000

type ImportExportServiceContext = Parameters<
  typeof uploadPreparedElementImportPackage
>[1]

export type ImportExportRouteContext = Omit<
  ImportExportServiceContext,
  'req' | 'res' | 'user'
>

type ImportExportRouteUser = ImportExportServiceContext['user']

export type ImportExportRouteServices = {
  uploadPreparedElementImportPackage: typeof uploadPreparedElementImportPackage
  downloadLocalElementExportPackage: typeof downloadLocalElementExportPackage
  getLocalImportedMediaDownload: typeof getLocalImportedMediaDownload
}

type RegisterImportExportRoutesOptions = {
  context: ImportExportRouteContext
  manageOrigin: string
  localStorageEnabled: boolean
  uploadBodyTimeoutMs?: number
  services?: Partial<ImportExportRouteServices>
}

const DEFAULT_SERVICES: ImportExportRouteServices = {
  uploadPreparedElementImportPackage,
  downloadLocalElementExportPackage,
  getLocalImportedMediaDownload,
}

const USER_ROLES = new Set<string>(Object.values(UserRole))
const USER_LOGIN_SCOPES = new Set<string>(Object.values(UserLoginScope))

class UploadBodyTimeoutError extends Error {
  constructor() {
    super('Upload body deadline exceeded.')
    this.name = 'UploadBodyTimeoutError'
  }
}

function isAllowedManageOrigin(origin: unknown, manageOrigin: string) {
  return typeof origin === 'string' && origin === manageOrigin
}

function removeImportExportCorsHeaders(res: Response) {
  res.removeHeader('Access-Control-Allow-Origin')
  res.removeHeader('Access-Control-Allow-Credentials')
}

function importExportHttpStatus(code: string) {
  switch (code) {
    case ImportExportErrorCode.UPLOAD_TOO_LARGE:
    case ImportExportErrorCode.PACKAGE_TOO_LARGE:
      return 413
    case ImportExportErrorCode.UNSUPPORTED_FILE_TYPE:
      return 415
    case ImportExportErrorCode.RATE_LIMITED:
      return 429
    case ImportExportErrorCode.RATE_LIMIT_UNAVAILABLE:
    case ImportExportErrorCode.INFRASTRUCTURE_FAILURE:
      return 503
    case ImportExportErrorCode.IMPORT_IN_PROGRESS:
      return 409
    case ImportExportErrorCode.PACKAGE_NOT_FOUND:
    case ImportExportErrorCode.PACKAGE_EXPIRED:
    case ImportExportErrorCode.TOKEN_INVALID:
    case ImportExportErrorCode.DISABLED:
      return 404
    default:
      return 400
  }
}

function readImportExportRouteUser(req: Request): ImportExportRouteUser | null {
  const candidate: unknown = req.locals?.user
  if (!candidate || typeof candidate !== 'object') return null

  const sub = Reflect.get(candidate, 'sub')
  const role = Reflect.get(candidate, 'role')
  const scope = Reflect.get(candidate, 'scope')
  if (
    typeof sub !== 'string' ||
    typeof role !== 'string' ||
    !USER_ROLES.has(role) ||
    typeof scope !== 'string' ||
    !USER_LOGIN_SCOPES.has(scope)
  ) {
    return null
  }

  return {
    sub,
    role: role as UserRole,
    scope: scope as UserLoginScope,
    catalystInstitutional:
      Reflect.get(candidate, 'catalystInstitutional') === true,
    catalystIndividual: Reflect.get(candidate, 'catalystIndividual') === true,
  }
}

function parseUploadContentLength(req: Request) {
  const header = req.headers['content-length']
  if (typeof header !== 'string' || !/^[1-9][0-9]*$/.test(header)) {
    return {
      ok: false,
      code: ImportExportErrorCode.INVALID_PACKAGE,
    } as const
  }

  const maximum = String(ELEMENT_IMPORT_EXPORT_PACKAGE_MAX_BYTES)
  if (
    header.length > maximum.length ||
    (header.length === maximum.length && header > maximum)
  ) {
    return {
      ok: false,
      code: ImportExportErrorCode.UPLOAD_TOO_LARGE,
    } as const
  }

  return { ok: true, contentLength: Number(header) } as const
}

function sendJsonAndCloseUnreadRequest(
  req: Request,
  res: Response,
  status: number,
  body: Readonly<Record<string, unknown>>
) {
  if (res.headersSent || res.writableEnded || res.destroyed) return

  const hasUnreadRequestData = !req.readableEnded
  if (hasUnreadRequestData) {
    res.shouldKeepAlive = false
    res.setHeader('Connection', 'close')
    res.once('finish', () => {
      if (!req.readableEnded && !req.destroyed) req.destroy()
    })
  }

  res.status(status).json(body)
}

function nextUploadChunk<T>(
  iterator: AsyncIterator<T>,
  signal: AbortSignal
): Promise<IteratorResult<T>> {
  if (signal.aborted) return Promise.reject(new UploadBodyTimeoutError())

  return new Promise((resolve, reject) => {
    const abort = () => {
      reject(new UploadBodyTimeoutError())
    }
    signal.addEventListener('abort', abort, { once: true })

    iterator.next().then(
      (result) => {
        signal.removeEventListener('abort', abort)
        resolve(result)
      },
      (error: unknown) => {
        signal.removeEventListener('abort', abort)
        reject(error)
      }
    )
  })
}

async function* withUploadBodyDeadline(
  request: Request,
  signal: AbortSignal
): AsyncGenerator<Uint8Array> {
  const iterator = request[Symbol.asyncIterator]()
  while (true) {
    const next = await nextUploadChunk(iterator, signal)
    if (next.done) return
    if (!(next.value instanceof Uint8Array)) {
      throw new TypeError('Upload request yielded a non-binary chunk.')
    }
    yield next.value
  }
}

function createUploadBodyDeadline(request: Request, timeoutMs: number) {
  const controller = new AbortController()
  let timeout: NodeJS.Timeout | null = setTimeout(
    () => controller.abort(),
    timeoutMs
  )
  timeout.unref()

  async function* stream() {
    try {
      yield* withUploadBodyDeadline(request, controller.signal)
    } finally {
      if (timeout) clearTimeout(timeout)
      timeout = null
    }
  }

  return {
    signal: controller.signal,
    stream: stream(),
    dispose() {
      if (timeout) clearTimeout(timeout)
      timeout = null
    },
  }
}

function createServiceContext(
  context: ImportExportRouteContext,
  user: ImportExportRouteUser
): ImportExportServiceContext {
  return { ...context, user }
}

export function registerImportExportPreflightRoute(
  app: ExpressApplication,
  { manageOrigin }: { manageOrigin: string }
) {
  app.options('/api/import-export-packages/:artifactId/upload', (req, res) => {
    const origin = req.get('Origin')
    res.setHeader('Cache-Control', 'no-store')
    if (!isAllowedManageOrigin(origin, manageOrigin)) {
      res.status(403).end()
      return
    }

    res.setHeader('Access-Control-Allow-Origin', origin!)
    res.setHeader('Access-Control-Allow-Credentials', 'true')
    res.setHeader('Access-Control-Allow-Methods', 'PUT')
    res.setHeader(
      'Access-Control-Allow-Headers',
      `Content-Type, ${IMPORT_UPLOAD_CAPABILITY_HEADER}`
    )
    res.setHeader('Vary', 'Origin')
    res.status(204).end()
  })
}

export function registerImportExportRoutes(
  app: ExpressApplication,
  {
    context,
    manageOrigin,
    localStorageEnabled,
    uploadBodyTimeoutMs = DEFAULT_UPLOAD_BODY_TIMEOUT_MS,
    services: serviceOverrides,
  }: RegisterImportExportRoutesOptions
) {
  const services = { ...DEFAULT_SERVICES, ...serviceOverrides }

  app.put(
    '/api/import-export-packages/:artifactId/upload',
    async (req, res) => {
      res.setHeader('Cache-Control', 'no-store')
      if (!isAllowedManageOrigin(req.get('Origin'), manageOrigin)) {
        removeImportExportCorsHeaders(res)
        sendJsonAndCloseUnreadRequest(req, res, 403, {
          code: ImportExportErrorCode.TOKEN_INVALID,
        })
        return
      }

      const user = readImportExportRouteUser(req)
      if (!user) {
        sendJsonAndCloseUnreadRequest(req, res, 401, {
          code: ImportExportErrorCode.TOKEN_INVALID,
        })
        return
      }

      const contentType = req.get('Content-Type') ?? ''
      if (contentType.trim().toLowerCase() !== ZIP_CONTENT_TYPE) {
        sendJsonAndCloseUnreadRequest(req, res, 415, {
          code: ImportExportErrorCode.UNSUPPORTED_FILE_TYPE,
        })
        return
      }

      const parsedContentLength = parseUploadContentLength(req)
      if (!parsedContentLength.ok) {
        sendJsonAndCloseUnreadRequest(
          req,
          res,
          importExportHttpStatus(parsedContentLength.code),
          { code: parsedContentLength.code }
        )
        return
      }

      const bodyDeadline = createUploadBodyDeadline(req, uploadBodyTimeoutMs)

      try {
        const result = await services.uploadPreparedElementImportPackage(
          {
            artifactId: req.params.artifactId,
            capability: req.get(IMPORT_UPLOAD_CAPABILITY_HEADER) ?? '',
            contentLength: parsedContentLength.contentLength,
            contentType,
            stream: bodyDeadline.stream,
          },
          createServiceContext(context, user)
        )

        if (result.replayed && !req.readableEnded) {
          sendJsonAndCloseUnreadRequest(req, res, 201, {
            bytes: result.bytes,
            sha256: result.sha256,
            replayed: true,
          })
          return
        }

        res.status(201).json({
          bytes: result.bytes,
          sha256: result.sha256,
          replayed: result.replayed,
        })
      } catch (error) {
        if (req.aborted || res.destroyed) {
          return
        }

        if (
          bodyDeadline.signal.aborted ||
          error instanceof UploadBodyTimeoutError
        ) {
          sendJsonAndCloseUnreadRequest(req, res, 408, {
            code: ImportExportErrorCode.INVALID_PACKAGE,
          })
          return
        }

        const code = getImportExportErrorCode(error)
        if (code === ImportExportErrorCode.INFRASTRUCTURE_FAILURE) {
          console.error('[ImportExportPackageUpload] request failed')
        }
        sendJsonAndCloseUnreadRequest(req, res, importExportHttpStatus(code), {
          code,
        })
      } finally {
        bodyDeadline.dispose()
      }
    }
  )

  if (!localStorageEnabled) return

  app.get(
    '/api/import-export-packages/:artifactId/download',
    async (req, res) => {
      res.setHeader('Cache-Control', 'private, no-store')
      try {
        if (!isAllowedManageOrigin(req.get('Origin'), manageOrigin)) {
          removeImportExportCorsHeaders(res)
          res
            .status(404)
            .json({ code: ImportExportErrorCode.PACKAGE_NOT_FOUND })
          return
        }
        const user = readImportExportRouteUser(req)
        if (!user) {
          res
            .status(404)
            .json({ code: ImportExportErrorCode.PACKAGE_NOT_FOUND })
          return
        }

        const buffer = await services.downloadLocalElementExportPackage(
          {
            artifactId: req.params.artifactId,
            capability:
              typeof req.query.capability === 'string'
                ? req.query.capability
                : '',
          },
          createServiceContext(context, user)
        )
        res.setHeader('Content-Type', ZIP_CONTENT_TYPE)
        res.send(buffer)
      } catch (error) {
        const code = getImportExportErrorCode(error)
        res.status(importExportHttpStatus(code)).json({ code })
      }
    }
  )

  // Azure media containers are blob-public. This development/test-only route
  // mirrors that read behavior, but only a committed MediaFile row authorizes
  // serving a canonical local target.
  app.get('/api/import-export-media/:ownerId/:filename', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox")
    try {
      const media = await services.getLocalImportedMediaDownload(
        {
          ownerId: req.params.ownerId,
          filename: req.params.filename,
        },
        context
      )
      if (!media) {
        res.status(404).end()
        return
      }

      res.type(media.contentType)
      // nosemgrep: javascript.express.security.audit.xss.direct-response-write.direct-response-write -- this is an allowlisted binary media response protected by nosniff and a sandboxed CSP, not HTML.
      res.send(media.buffer)
    } catch {
      res.status(404).end()
    }
  })
}
