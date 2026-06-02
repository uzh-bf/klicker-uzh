import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server'
import { createCallerFactory, router } from './init.js'
import { courseRouter } from './routers/course.js'
import { liveQuizRouter } from './routers/liveQuiz.js'
import { participantRouter } from './routers/participant.js'
import { systemRouter } from './routers/system.js'
import { userRouter } from './routers/user.js'

export const appRouter = router({
  course: courseRouter,
  liveQuiz: liveQuizRouter,
  participant: participantRouter,
  system: systemRouter,
  user: userRouter,
})

export { createCallerFactory }

export type AppRouter = typeof appRouter
export type RouterInputs = inferRouterInputs<AppRouter>
export type RouterOutputs = inferRouterOutputs<AppRouter>
