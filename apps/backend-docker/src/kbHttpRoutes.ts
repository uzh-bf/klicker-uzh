import {
  handleKBIngestionWebhook,
  handleKBSourceGateway,
} from '@klicker-uzh/graphql'
import express, { type Express } from 'express'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type KBHttpRouteDependencies = {
  prisma: Parameters<typeof handleKBSourceGateway>[0]['prisma']
  sourceGateway?: typeof handleKBSourceGateway
  ingestionWebhook?: typeof handleKBIngestionWebhook
}

export function registerKBHttpRoutes(
  app: Express,
  {
    prisma,
    sourceGateway = handleKBSourceGateway,
    ingestionWebhook = handleKBIngestionWebhook,
  }: KBHttpRouteDependencies
) {
  app.get(
    '/api/ingestion/resources/:resourceId/versions/:resourceVersion',
    async (req, res) => {
      const resourceVersion = Number(req.params.resourceVersion)
      if (
        !UUID_PATTERN.test(req.params.resourceId) ||
        !/^[1-9]\d*$/.test(req.params.resourceVersion) ||
        !Number.isSafeInteger(resourceVersion)
      ) {
        res.status(404).json({ error: 'Resource not found' })
        return
      }

      try {
        const result = await sourceGateway({
          prisma,
          resourceId: req.params.resourceId,
          resourceVersion,
          authorization: req.headers.authorization,
        })
        if (result.statusCode !== 200) {
          res.status(result.statusCode).json(result.body)
          return
        }

        res.status(200)
        res.set({
          'Cache-Control': 'private, no-store',
          'Content-Length': String(result.contentLength),
          'X-Content-Type-Options': 'nosniff',
        })
        res.setHeader('Content-Type', result.contentType)
        result.stream.on('error', () => res.destroy())
        result.stream.pipe(res)
      } catch {
        console.error('KB source gateway failed')
        res.status(500).json({ error: 'Internal server error' })
      }
    }
  )

  app.post(
    '/api/webhooks/kb-ingestion',
    express.raw({ type: 'application/json', limit: '1mb' }),
    async (req, res) => {
      try {
        if (!Buffer.isBuffer(req.body)) {
          res.status(400).json({ error: 'Invalid request' })
          return
        }

        const result = await ingestionWebhook({
          prisma,
          rawBody: req.body,
          headers: req.headers,
        })
        res.status(result.statusCode).json(result.body)
      } catch {
        console.error('KB ingestion webhook failed')
        res.status(500).json({ error: 'Internal server error' })
      }
    }
  )
}
