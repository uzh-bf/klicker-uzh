import express, { Request, Response } from 'express'

const app: express.Express = express()
const PORT = process.env.PORT || 3020

// Middleware to parse JSON requests
app.use(express.json())

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() })
})

// Main endpoint that responds with hello world
app.get('/', (req: Request, res: Response) => {
  res.json({ message: 'hello world' })
})

// Additional hello endpoint for explicit hello world requests
app.post('/hello', (req: Request, res: Response) => {
  res.json({
    message: 'hello world',
    timestamp: new Date().toISOString(),
    api: 'olat-api',
  })
})

// Start the server
app.listen(PORT, () => {
  console.log(`🚀 OLAT API server is running on port ${PORT}`)
  console.log(`📍 Health check: http://localhost:${PORT}/health`)
  console.log(`👋 Hello endpoint: http://localhost:${PORT}/hello`)
})

export default app
