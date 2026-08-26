import express from 'express'

export function createRequestAwareExpressApp() {
  const app = express()

  // Production and local routed traffic reach this service through one ingress.
  app.set('trust proxy', 1)

  return app
}
