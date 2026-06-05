import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server'
import { createCallerFactory, router } from './init.js'
import { activityRouter } from './routers/activity.js'
import { courseRouter } from './routers/course.js'
import { liveQuizRouter } from './routers/liveQuiz.js'
import { participantRouter } from './routers/participant.js'
import { resourcesRouter } from './routers/resources.js'
import { sharingRouter } from './routers/sharing.js'
import { systemRouter } from './routers/system.js'
import { userRouter } from './routers/user.js'

export const appRouter = router({
  activity: activityRouter,
  course: courseRouter,
  liveQuiz: liveQuizRouter,
  participant: participantRouter,
  resources: resourcesRouter,
  sharing: sharingRouter,
  system: systemRouter,
  user: userRouter,
})

export { createCallerFactory }

export type AppRouter = typeof appRouter
export type RouterInputs = inferRouterInputs<AppRouter>
export type RouterOutputs = inferRouterOutputs<AppRouter>
