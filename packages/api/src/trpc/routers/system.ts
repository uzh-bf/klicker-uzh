import { z } from 'zod'
import { publicProcedure, router } from '../init.js'

export const systemRouter = router({
  health: publicProcedure.input(z.void()).query(() => ({
    api: 'trpc' as const,
    status: 'ok' as const,
  })),
})
