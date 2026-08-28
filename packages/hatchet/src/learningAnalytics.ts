import {
  ConcurrencyLimitStrategy,
  NonRetryableError,
  type HatchetClient,
} from '@hatchet-dev/typescript-sdk/index.js'
import {
  COURSE_WORKFLOW_NAME,
  PLATFORM_WORKFLOW_NAME,
  createAnalyticsEngineStubs,
  type CourseWorkflowInput,
  type CourseWorkflowSuccess,
  type PlatformWorkflowInput,
  type PlatformWorkflowSuccess,
} from '@klicker-uzh/analytics-engine-contract'
import type {
  HatchetHandlerGlobalContext,
  HatchetHandlers,
  LearningAnalyticsBatchControlInput,
  LearningAnalyticsBatchDeadlineInput,
  LearningAnalyticsBatchLaneInput,
  LearningAnalyticsBatchLaneOutput,
  LearningAnalyticsCourseControlInput,
  LearningAnalyticsCourseControlOutput,
  LearningAnalyticsCourseCompletionInput,
  LearningAnalyticsCourseStartOutput,
} from '@klicker-uzh/types'

interface ChildRunRef<Output> {
  cancel(): Promise<void>
  readonly output: Promise<Output>
}

const CHILD_METADATA = {
  component: 'public-learning-analytics-coordinator',
  contractVersion: 'v1',
} as const
const DURABLE_EXECUTION_TIMEOUT = '7h'
const NIGHTLY_CRONS = ['30 22 * * *', '30 23 * * *']

export const LEARNING_ANALYTICS_TASK_NAMES = {
  batch: 'learning-analytics-public-batch-v1',
  batchLane: 'learning-analytics-public-batch-lane-v1',
  batchDeadline: 'learning-analytics-batch-deadline',
  batchSelector: 'learning-analytics-batch-selector',
  course: 'learning-analytics-public-course-v1',
  courseCompletion: 'learning-analytics-course-completion',
  courseStart: 'learning-analytics-course-start',
  scheduledDispatch: 'learning-analytics-scheduled-dispatch',
  spawnGate: 'learning-analytics-spawn-gate',
} as const

function courseChildKey(input: LearningAnalyticsCourseControlInput): string {
  return `course:${input.runId}:${input.courseId}:${input.mode}`
}

function fullCourseRequest(
  input: LearningAnalyticsCourseControlInput
): LearningAnalyticsCourseControlInput {
  return {
    contractVersion: input.contractVersion,
    runId: input.runId,
    courseId: input.courseId,
    mode: 'full',
  }
}

function partitionIntoLanes(
  courses: LearningAnalyticsCourseControlInput[],
  laneCount: number
): LearningAnalyticsCourseControlInput[][] {
  const lanes = Array.from(
    { length: laneCount },
    () => [] as LearningAnalyticsCourseControlInput[]
  )
  courses.forEach((course, index) => lanes[index % laneCount]!.push(course))
  return lanes
}

async function cancelAndAwait(refs: ChildRunRef<unknown>[]): Promise<void> {
  await Promise.allSettled(refs.map((ref) => ref.cancel()))
  await Promise.allSettled(refs.map((ref) => ref.output))
}

export function prepareLearningAnalyticsTasks({
  hatchet,
  handlers,
  globalContext,
}: {
  hatchet: HatchetClient
  handlers: HatchetHandlers
  globalContext: HatchetHandlerGlobalContext
}) {
  const requireCoordinatorAvailable =
    handlers.handleRequireLearningAnalyticsCoordinatorAvailable

  const learningAnalyticsCourseStart = hatchet.task({
    name: LEARNING_ANALYTICS_TASK_NAMES.courseStart,
    retries: 3,
    backoff: { factor: 2, maxSeconds: 30 },
    executionTimeout: '2m',
    scheduleTimeout: '30m',
    fn: async (input: LearningAnalyticsCourseControlInput, executionContext) =>
      handlers.handleStartLearningAnalyticsCourse(
        input,
        globalContext,
        executionContext
      ),
  })

  const learningAnalyticsCourseCompletion = hatchet.task({
    name: LEARNING_ANALYTICS_TASK_NAMES.courseCompletion,
    retries: 3,
    backoff: { factor: 2, maxSeconds: 30 },
    executionTimeout: '2m',
    scheduleTimeout: '30m',
    fn: async (
      input: LearningAnalyticsCourseCompletionInput,
      executionContext
    ) =>
      handlers.handleCompleteLearningAnalyticsCourse(
        input,
        globalContext,
        executionContext
      ),
  })

  const learningAnalyticsCourseCoordinator = hatchet.durableTask({
    name: LEARNING_ANALYTICS_TASK_NAMES.course,
    retries: 1,
    backoff: { factor: 2, maxSeconds: 30 },
    executionTimeout: DURABLE_EXECUTION_TIMEOUT,
    scheduleTimeout: '6h',
    concurrency: {
      expression: 'input.courseId',
      maxRuns: 1,
      limitStrategy: ConcurrencyLimitStrategy.GROUP_ROUND_ROBIN,
    },
    fn: async (
      input: LearningAnalyticsCourseControlInput,
      executionContext
    ): Promise<LearningAnalyticsCourseControlOutput> => {
      requireCoordinatorAvailable()
      const start = (await executionContext.runChild(
        learningAnalyticsCourseStart,
        input,
        {
          key: `start:${courseChildKey(input)}`,
          additionalMetadata: {
            ...CHILD_METADATA,
            runId: input.runId,
            courseId: input.courseId,
            mode: input.mode,
          },
        }
      )) as LearningAnalyticsCourseStartOutput
      if (executionContext.cancelled) {
        throw new NonRetryableError(
          `Learning-analytics course ${input.courseId} was cancelled after start`
        )
      }
      const effectiveRequest = start.request ?? fullCourseRequest(input)

      let privateRef: ChildRunRef<CourseWorkflowSuccess> | undefined
      const stubs = createAnalyticsEngineStubs(
        async (workflowName, payload) => {
          if (workflowName !== COURSE_WORKFLOW_NAME) {
            throw new Error(`Unexpected course workflow ${workflowName}`)
          }
          requireCoordinatorAvailable()
          privateRef = await executionContext.runNoWaitChild<
            CourseWorkflowInput,
            CourseWorkflowSuccess
          >(workflowName, payload as CourseWorkflowInput, {
            key: `private:${courseChildKey(effectiveRequest)}`,
            additionalMetadata: {
              ...CHILD_METADATA,
              runId: effectiveRequest.runId,
              courseId: effectiveRequest.courseId,
              mode: effectiveRequest.mode,
            },
          })
          if (executionContext.cancelled) {
            const cancelledRef = privateRef
            privateRef = undefined
            await cancelAndAwait([cancelledRef])
            throw new NonRetryableError(
              `Learning-analytics course ${input.courseId} was cancelled during private dispatch`
            )
          }
          return privateRef.output
        }
      )

      let result: CourseWorkflowSuccess
      try {
        result = await stubs.course(effectiveRequest)
      } catch (error) {
        if (executionContext.cancelled && privateRef) {
          await cancelAndAwait([privateRef])
        }
        throw error
      }

      if (executionContext.cancelled) {
        if (privateRef) {
          await cancelAndAwait([privateRef])
        }
        throw new NonRetryableError(
          `Learning-analytics course ${input.courseId} was cancelled before completion dispatch`
        )
      }

      const completionInput: LearningAnalyticsCourseCompletionInput = {
        request: effectiveRequest,
        completedAt: result.completedAt,
        cleanupOnly: start.cleanupOnly,
        fenceAt: start.fenceAt,
      }

      let completionRef:
        | ChildRunRef<LearningAnalyticsCourseControlOutput>
        | undefined
      try {
        requireCoordinatorAvailable()
        completionRef = await executionContext.runNoWaitChild<
          LearningAnalyticsCourseCompletionInput,
          LearningAnalyticsCourseControlOutput
        >(learningAnalyticsCourseCompletion, completionInput, {
          key: `complete:${courseChildKey(effectiveRequest)}`,
          additionalMetadata: {
            ...CHILD_METADATA,
            runId: effectiveRequest.runId,
            courseId: effectiveRequest.courseId,
            mode: effectiveRequest.mode,
          },
        })
        if (executionContext.cancelled) {
          const cancelledRef = completionRef
          completionRef = undefined
          await cancelAndAwait([cancelledRef])
          throw new NonRetryableError(
            `Learning-analytics course ${input.courseId} was cancelled during completion dispatch`
          )
        }
        const output = await completionRef.output
        if (executionContext.cancelled) {
          const cancelledRef = completionRef
          completionRef = undefined
          await cancelAndAwait([cancelledRef])
          throw new NonRetryableError(
            `Learning-analytics course ${input.courseId} was cancelled during completion`
          )
        }
        return output
      } catch (error) {
        if (executionContext.cancelled && completionRef) {
          await cancelAndAwait([completionRef])
        }
        throw error
      }
    },
  })

  const learningAnalyticsSpawnGate = hatchet.task({
    name: LEARNING_ANALYTICS_TASK_NAMES.spawnGate,
    retries: 3,
    backoff: { factor: 2, maxSeconds: 15 },
    executionTimeout: '1m',
    scheduleTimeout: '15m',
    fn: async (input: { stopSpawningAt: string }, executionContext) => ({
      canStart: await handlers.handleCanStartLearningAnalyticsCourse(
        input,
        globalContext,
        executionContext
      ),
    }),
  })

  const learningAnalyticsBatchDeadline = hatchet.task({
    name: LEARNING_ANALYTICS_TASK_NAMES.batchDeadline,
    retries: 3,
    backoff: { factor: 2, maxSeconds: 15 },
    executionTimeout: '1m',
    scheduleTimeout: '15m',
    fn: async (input: LearningAnalyticsBatchDeadlineInput, executionContext) =>
      handlers.handleGetLearningAnalyticsBatchDeadline(
        input,
        globalContext,
        executionContext
      ),
  })

  const learningAnalyticsBatchLane = hatchet.durableTask({
    name: LEARNING_ANALYTICS_TASK_NAMES.batchLane,
    retries: 1,
    backoff: { factor: 2, maxSeconds: 30 },
    executionTimeout: DURABLE_EXECUTION_TIMEOUT,
    scheduleTimeout: '30m',
    fn: async (
      input: LearningAnalyticsBatchLaneInput,
      executionContext
    ): Promise<LearningAnalyticsBatchLaneOutput> => {
      const completedCourseIds: string[] = []
      const failedCourseIds: string[] = []

      for (let index = 0; index < input.courses.length; index++) {
        if (executionContext.cancelled) {
          throw new NonRetryableError(
            `Learning-analytics lane ${input.runId} was cancelled before the next course`
          )
        }
        const course = input.courses[index]!
        requireCoordinatorAvailable()
        const gate = await executionContext.runChild(
          learningAnalyticsSpawnGate,
          { stopSpawningAt: input.stopSpawningAt },
          {
            key: `spawn-gate:${input.runId}:${course.courseId}`,
            additionalMetadata: {
              ...CHILD_METADATA,
              runId: input.runId,
              courseId: course.courseId,
            },
          }
        )
        if (executionContext.cancelled) {
          throw new NonRetryableError(
            `Learning-analytics lane ${input.runId} was cancelled after spawn gate`
          )
        }
        if (!gate.canStart) {
          return {
            completedCourseIds,
            failedCourseIds,
            notStartedCourseIds: input.courses
              .slice(index)
              .map(({ courseId }) => courseId),
          }
        }

        requireCoordinatorAvailable()
        const courseRef = await executionContext.runNoWaitChild<
          LearningAnalyticsCourseControlInput,
          LearningAnalyticsCourseControlOutput
        >(LEARNING_ANALYTICS_TASK_NAMES.course, course, {
          key: courseChildKey(course),
          additionalMetadata: {
            ...CHILD_METADATA,
            runId: input.runId,
            courseId: course.courseId,
            mode: course.mode,
          },
        })
        if (executionContext.cancelled) {
          await cancelAndAwait([courseRef])
          throw new NonRetryableError(
            `Learning-analytics lane ${input.runId} was cancelled during course dispatch`
          )
        }
        try {
          await courseRef.output
        } catch (error) {
          if (executionContext.cancelled) {
            await cancelAndAwait([courseRef])
            throw error
          }
          failedCourseIds.push(course.courseId)
          continue
        }
        if (executionContext.cancelled) {
          await cancelAndAwait([courseRef])
          throw new NonRetryableError(
            `Learning-analytics lane ${input.runId} was cancelled after course completion`
          )
        }
        completedCourseIds.push(course.courseId)
      }

      return {
        completedCourseIds,
        failedCourseIds,
        notStartedCourseIds: [],
      }
    },
  })

  const learningAnalyticsBatchSelector = hatchet.task({
    name: LEARNING_ANALYTICS_TASK_NAMES.batchSelector,
    retries: 3,
    backoff: { factor: 2, maxSeconds: 30 },
    executionTimeout: '15m',
    scheduleTimeout: '30m',
    fn: async (input: LearningAnalyticsBatchControlInput, executionContext) =>
      handlers.handleSelectLearningAnalyticsBatchCourses(
        input,
        globalContext,
        executionContext
      ),
  })

  const learningAnalyticsBatchCoordinator = hatchet.durableTask({
    name: LEARNING_ANALYTICS_TASK_NAMES.batch,
    retries: 1,
    backoff: { factor: 2, maxSeconds: 30 },
    executionTimeout: DURABLE_EXECUTION_TIMEOUT,
    scheduleTimeout: '30m',
    concurrency: {
      expression: '"global"',
      maxRuns: 1,
      limitStrategy: ConcurrencyLimitStrategy.GROUP_ROUND_ROBIN,
    },
    fn: async (input: LearningAnalyticsBatchControlInput, executionContext) => {
      const activeRefs = new Set<ChildRunRef<unknown>>()
      const pendingDispatches = new Set<Promise<ChildRunRef<unknown>[]>>()
      let stopping = false

      async function trackChild<Output>(
        dispatch: () => Promise<ChildRunRef<Output>>
      ): Promise<ChildRunRef<Output>> {
        if (stopping) {
          throw new NonRetryableError(
            `Learning-analytics batch ${input.runId} is stopping`
          )
        }
        const pending = dispatch().then((ref) => [ref as ChildRunRef<unknown>])
        pendingDispatches.add(pending)
        try {
          const refs = await pending
          const ref = refs[0] as ChildRunRef<Output>
          activeRefs.add(ref)
          if (stopping) {
            throw new NonRetryableError(
              `Learning-analytics batch ${input.runId} stopped during child dispatch`
            )
          }
          return ref
        } finally {
          pendingDispatches.delete(pending)
        }
      }

      async function trackChildren<Output>(
        dispatch: () => Promise<ChildRunRef<Output>[]>
      ): Promise<ChildRunRef<Output>[]> {
        if (stopping) {
          throw new NonRetryableError(
            `Learning-analytics batch ${input.runId} is stopping`
          )
        }
        const pending = dispatch().then((refs) =>
          refs.map((ref) => ref as ChildRunRef<unknown>)
        )
        pendingDispatches.add(pending)
        try {
          const refs = await pending
          refs.forEach((ref) => activeRefs.add(ref))
          if (stopping) {
            throw new NonRetryableError(
              `Learning-analytics batch ${input.runId} stopped during child dispatch`
            )
          }
          return refs as ChildRunRef<Output>[]
        } finally {
          pendingDispatches.delete(pending)
        }
      }

      async function stopTrackedChildren(): Promise<void> {
        stopping = true
        const pending = await Promise.allSettled([...pendingDispatches])
        for (const result of pending) {
          if (result.status === 'fulfilled') {
            result.value.forEach((ref) => activeRefs.add(ref))
          }
        }
        const refs = [...activeRefs]
        activeRefs.clear()
        await cancelAndAwait(refs)
      }

      requireCoordinatorAvailable()
      const deadlineWindow = await executionContext.runChild(
        learningAnalyticsBatchDeadline,
        { hardDeadlineAt: input.hardDeadlineAt },
        {
          key: `deadline:${input.runId}`,
          additionalMetadata: {
            ...CHILD_METADATA,
            runId: input.runId,
          },
        }
      )
      if (
        !Number.isSafeInteger(deadlineWindow.remainingSeconds) ||
        deadlineWindow.remainingSeconds <= 0
      ) {
        throw new NonRetryableError(
          `Learning-analytics batch reached hard deadline ${input.hardDeadlineAt}`
        )
      }
      const deadline = executionContext
        .sleepFor(
          `${deadlineWindow.remainingSeconds}s`,
          `hard-deadline:${input.runId}`
        )
        .then(() => ({ kind: 'deadline' as const }))

      const completion = (async () => {
        requireCoordinatorAvailable()
        const selectorRef = await trackChild(() =>
          executionContext.runNoWaitChild<
            LearningAnalyticsBatchControlInput,
            { courses: LearningAnalyticsCourseControlInput[] }
          >(LEARNING_ANALYTICS_TASK_NAMES.batchSelector, input, {
            key: `select:${input.runId}`,
            additionalMetadata: {
              ...CHILD_METADATA,
              runId: input.runId,
            },
          })
        )
        let selection: { courses: LearningAnalyticsCourseControlInput[] }
        try {
          selection = await selectorRef.output
        } finally {
          activeRefs.delete(selectorRef)
        }

        const laneCount = Math.min(
          input.inFlightLimit,
          selection.courses.length
        )
        const laneInputs =
          laneCount === 0
            ? []
            : partitionIntoLanes(selection.courses, laneCount).map(
                (courses) => ({
                  runId: input.runId,
                  courses,
                  stopSpawningAt: input.stopSpawningAt,
                })
              )
        let laneRefs: ChildRunRef<LearningAnalyticsBatchLaneOutput>[] = []
        if (laneInputs.length > 0) {
          requireCoordinatorAvailable()
          laneRefs = await trackChildren(() =>
            executionContext.bulkRunNoWaitChildren<
              LearningAnalyticsBatchLaneInput,
              LearningAnalyticsBatchLaneOutput
            >(
              laneInputs.map((lane, index) => ({
                workflow: LEARNING_ANALYTICS_TASK_NAMES.batchLane,
                input: lane,
                options: {
                  key: `lane:${input.runId}:${index}`,
                  additionalMetadata: {
                    ...CHILD_METADATA,
                    runId: input.runId,
                    lane: String(index),
                  },
                },
              }))
            )
          )
        }
        const lanes = await Promise.all(
          laneRefs.map(async (ref) => {
            try {
              return await ref.output
            } finally {
              activeRefs.delete(ref)
            }
          })
        )

        const failedCourseIds = lanes.flatMap(
          ({ failedCourseIds }) => failedCourseIds
        )
        const notStartedCourseIds = lanes.flatMap(
          ({ notStartedCourseIds }) => notStartedCourseIds
        )
        const completedCourseIds = lanes.flatMap(
          ({ completedCourseIds }) => completedCourseIds
        )
        if (failedCourseIds.length > 0 || notStartedCourseIds.length > 0) {
          throw new NonRetryableError(
            `Learning-analytics batch incomplete: ${failedCourseIds.length} failed, ${notStartedCourseIds.length} not started`
          )
        }

        let platformCompletedAt: string | undefined
        if (input.includePlatform) {
          const platformInput: PlatformWorkflowInput = {
            contractVersion: 'v1',
            runId: input.runId,
          }
          let platformRef: ChildRunRef<PlatformWorkflowSuccess> | undefined
          const stubs = createAnalyticsEngineStubs(
            async (workflowName, payload) => {
              if (workflowName !== PLATFORM_WORKFLOW_NAME) {
                throw new Error(`Unexpected platform workflow ${workflowName}`)
              }
              requireCoordinatorAvailable()
              platformRef = await trackChild(() =>
                executionContext.runNoWaitChild<
                  PlatformWorkflowInput,
                  PlatformWorkflowSuccess
                >(workflowName, payload as PlatformWorkflowInput, {
                  key: `platform:${input.runId}`,
                  additionalMetadata: {
                    ...CHILD_METADATA,
                    runId: input.runId,
                  },
                })
              )
              try {
                return await platformRef.output
              } finally {
                activeRefs.delete(platformRef)
              }
            }
          )
          const platformResult = await stubs.platform(platformInput)
          platformCompletedAt = platformResult.completedAt
        }

        return {
          runId: input.runId,
          selectedCourses: selection.courses.length,
          completedCourses: completedCourseIds.length,
          ...(platformCompletedAt ? { platformCompletedAt } : {}),
        }
      })().then((output) => ({ kind: 'completed' as const, output }))

      try {
        const outcome = await Promise.race([completion, deadline])
        if (outcome.kind === 'deadline') {
          throw new NonRetryableError(
            `Learning-analytics batch reached hard deadline ${input.hardDeadlineAt}`
          )
        }
        return outcome.output
      } catch (error) {
        await stopTrackedChildren()
        throw error
      }
    },
  })

  const learningAnalyticsScheduledDispatch = hatchet.task({
    name: LEARNING_ANALYTICS_TASK_NAMES.scheduledDispatch,
    retries: 3,
    backoff: { factor: 2, maxSeconds: 30 },
    executionTimeout: '2m',
    scheduleTimeout: '30m',
    onCrons: NIGHTLY_CRONS,
    fn: async (_input: Record<string, never>, executionContext) => {
      const batch = await handlers.handlePrepareScheduledLearningAnalyticsBatch(
        {},
        globalContext,
        executionContext
      )
      if (!batch) return { dispatched: false }

      requireCoordinatorAvailable()
      await executionContext.runNoWaitChild(
        LEARNING_ANALYTICS_TASK_NAMES.batch,
        batch,
        {
          key: `scheduled:${batch.runId}`,
          additionalMetadata: {
            ...CHILD_METADATA,
            runId: batch.runId,
          },
        }
      )
      return { dispatched: true, runId: batch.runId }
    },
  })

  return {
    learningAnalyticsScheduledDispatch,
    learningAnalyticsBatchCoordinator,
    learningAnalyticsBatchSelector,
    learningAnalyticsBatchDeadline,
    learningAnalyticsBatchLane,
    learningAnalyticsSpawnGate,
    learningAnalyticsCourseCoordinator,
    learningAnalyticsCourseStart,
    learningAnalyticsCourseCompletion,
  }
}
