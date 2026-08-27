import { ConcurrencyLimitStrategy } from '@hatchet-dev/typescript-sdk/index.js'
import { describe, expect, it, vi } from 'vitest'
import { prepareLearningAnalyticsTasks } from '../src/learningAnalytics.js'

type ChildOptions = {
  key?: string
  additionalMetadata?: Record<string, string>
}

type TaskDefinition = {
  name: string
  fn: (input: unknown, context: FakeExecutionContext) => unknown
  onCrons?: string[]
  concurrency?: Record<string, unknown>
}

type TaskOptions = TaskDefinition

type ChildRef<Output> = {
  cancel: () => Promise<void>
  output: Promise<Output>
}

type FakeExecutionContext = {
  cancelled?: boolean
  runChild: (
    workflow: TaskDefinition,
    input: unknown,
    options?: ChildOptions
  ) => Promise<unknown>
  runNoWaitChild: (
    workflow: TaskDefinition | string,
    input: unknown,
    options?: ChildOptions
  ) => Promise<ChildRef<unknown>>
  bulkRunNoWaitChildren: (
    requests: Array<{
      workflow: TaskDefinition | string
      input: unknown
      options?: ChildOptions
    }>
  ) => Promise<Array<ChildRef<unknown>>>
  sleepFor: (duration: string, key: string) => Promise<void>
}

const RUN_ID = '00000000-0000-4000-8000-000000000001'
const COURSE_IDS = [
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000003',
  '00000000-0000-4000-8000-000000000004',
] as const

function courseInput(
  courseId: string,
  mode: 'incremental' | 'finalize' | 'full' = 'incremental'
) {
  return {
    contractVersion: 'v1' as const,
    runId: RUN_ID,
    courseId,
    mode,
  }
}

function batchInput(
  overrides: Partial<{
    includePlatform: boolean
    inFlightLimit: number
    selection: 'explicit-full' | 'nightly'
  }> = {}
) {
  return {
    runId: RUN_ID,
    batchDate: '2026-08-27',
    selection: 'nightly' as const,
    includePlatform: false,
    inFlightLimit: 2,
    stopSpawningAt: '2026-08-27T05:45:00+02:00',
    hardDeadlineAt: '2026-08-27T06:00:00+02:00',
    ...overrides,
  }
}

function resolvedRef<Output>(output: Output): ChildRef<Output> {
  return {
    cancel: vi.fn(async () => {}),
    output: Promise.resolve(output),
  }
}

function deferred<Value>() {
  let resolve!: (value: Value) => void
  const promise = new Promise<Value>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

function prepare(
  handlerOverrides: Record<string, (...args: never[]) => unknown> = {}
) {
  const definitions = new Map<string, TaskDefinition>()
  const register = (options: TaskOptions) => {
    const definition = { ...options }
    definitions.set(definition.name, definition)
    return definition
  }
  const fakeHatchet = {
    task: register,
    durableTask: register,
  }
  const handlers = handlerOverrides
  const tasks = prepareLearningAnalyticsTasks({
    hatchet: fakeHatchet as never,
    handlers: handlers as never,
    globalContext: {} as never,
  })

  return { definitions, tasks }
}

function task(
  definitions: Map<string, TaskDefinition>,
  name: string
): TaskDefinition {
  const definition = definitions.get(name)
  if (!definition) throw new Error(`Task ${name} was not registered`)
  return definition
}

describe('@klicker-uzh/hatchet learning-analytics coordinator', () => {
  it('registers the public workflows with stable names and control-plane limits', () => {
    const { definitions, tasks } = prepare()

    expect(Object.keys(tasks)).toEqual([
      'learningAnalyticsScheduledDispatch',
      'learningAnalyticsBatchCoordinator',
      'learningAnalyticsBatchSelector',
      'learningAnalyticsBatchDeadline',
      'learningAnalyticsBatchLane',
      'learningAnalyticsSpawnGate',
      'learningAnalyticsCourseCoordinator',
      'learningAnalyticsCourseStart',
      'learningAnalyticsCourseCompletion',
    ])
    expect([...definitions.keys()]).toEqual([
      'learning-analytics-course-start',
      'learning-analytics-course-completion',
      'learning-analytics-public-course-v1',
      'learning-analytics-spawn-gate',
      'learning-analytics-batch-deadline',
      'learning-analytics-public-batch-lane-v1',
      'learning-analytics-batch-selector',
      'learning-analytics-public-batch-v1',
      'learning-analytics-scheduled-dispatch',
    ])

    expect(
      task(definitions, 'learning-analytics-scheduled-dispatch').onCrons
    ).toEqual(['30 22 * * *', '30 23 * * *'])
    expect(
      task(definitions, 'learning-analytics-public-course-v1').concurrency
    ).toEqual({
      expression: 'input.courseId',
      maxRuns: 1,
      limitStrategy: ConcurrencyLimitStrategy.GROUP_ROUND_ROBIN,
    })
    expect(
      task(definitions, 'learning-analytics-public-batch-v1').concurrency
    ).toEqual({
      expression: '"global"',
      maxRuns: 1,
      limitStrategy: ConcurrencyLimitStrategy.GROUP_ROUND_ROBIN,
    })
  })

  it('runs one course through public start, private v1 contract, and completion with deterministic keys', async () => {
    const events: string[] = []
    const fenceAt = '2026-08-27T02:00:00.000Z'
    const completion = vi.fn(async (_input: unknown) => ({
      courseId: COURSE_IDS[0],
      completedAt: '2026-08-27T03:00:00Z',
      cleanupOnly: false,
    }))
    const { definitions } = prepare({
      handleStartLearningAnalyticsCourse: async () => {
        events.push('start')
        return {
          courseId: COURSE_IDS[0],
          request: courseInput(COURSE_IDS[0]),
          cleanupOnly: false,
          fenceAt,
        }
      },
      handleCompleteLearningAnalyticsCourse: completion,
    })
    const childCalls: Array<{ name: string; key?: string }> = []
    const privateInputs: unknown[] = []
    const context: FakeExecutionContext = {
      runChild: async (workflow, input, options) => {
        childCalls.push({ name: workflow.name, key: options?.key })
        if (workflow.name === 'learning-analytics-course-start') {
          events.push('start')
          return {
            courseId: (input as { courseId: string }).courseId,
            request: input as ReturnType<typeof courseInput>,
            cleanupOnly: false,
            fenceAt,
          }
        }
        throw new Error(`Unexpected child ${workflow.name}`)
      },
      runNoWaitChild: async (workflow, input, options) => {
        const name = typeof workflow === 'string' ? workflow : workflow.name
        childCalls.push({
          name,
          key: options?.key,
        })
        if (name === 'learning-analytics-course-completion') {
          events.push('completion')
          return resolvedRef(await completion(input))
        }
        events.push('private')
        privateInputs.push(input)
        return resolvedRef({
          ...(input as Record<string, unknown>),
          completedAt: '2026-08-27T03:00:00Z',
        })
      },
      bulkRunNoWaitChildren: async () => [],
      sleepFor: async () => {},
    }

    const output = await task(
      definitions,
      'learning-analytics-public-course-v1'
    ).fn(courseInput(COURSE_IDS[0]), context)

    expect(output).toEqual({
      courseId: COURSE_IDS[0],
      completedAt: '2026-08-27T03:00:00Z',
      cleanupOnly: false,
    })
    expect(events).toEqual(['start', 'private', 'completion'])
    expect(childCalls.map(({ name, key }) => [name, key])).toEqual([
      [
        'learning-analytics-course-start',
        `start:course:${RUN_ID}:${COURSE_IDS[0]}:incremental`,
      ],
      [
        'learning-analytics-course-v1',
        `private:course:${RUN_ID}:${COURSE_IDS[0]}:incremental`,
      ],
      [
        'learning-analytics-course-completion',
        `complete:course:${RUN_ID}:${COURSE_IDS[0]}:incremental`,
      ],
    ])
    expect(completion).toHaveBeenCalledWith(
      expect.objectContaining({
        request: courseInput(COURSE_IDS[0]),
        completedAt: '2026-08-27T03:00:00Z',
        cleanupOnly: false,
        fenceAt,
      })
    )
    expect(privateInputs[0]).not.toHaveProperty('fenceAt')
  })

  it('uses the effective request from start for private and completion dispatch', async () => {
    const initialRequest = courseInput(COURSE_IDS[0], 'incremental')
    const effectiveRequest = courseInput(COURSE_IDS[0], 'full')
    const fenceAt = '2026-08-27T02:00:00.000Z'
    const calls: Array<{
      name: string
      key?: string
      metadata?: Record<string, string>
    }> = []
    const completion = vi.fn(async (_input: unknown) => ({
      courseId: COURSE_IDS[0],
      completedAt: '2026-08-27T03:00:00Z',
      cleanupOnly: false,
    }))
    const { definitions } = prepare()
    const context: FakeExecutionContext = {
      runChild: async (workflow, input, options) => {
        calls.push({
          name: workflow.name,
          key: options?.key,
          metadata: options?.additionalMetadata,
        })
        if (workflow.name === 'learning-analytics-course-start') {
          return {
            courseId: COURSE_IDS[0],
            request: effectiveRequest,
            cleanupOnly: false,
            fenceAt,
          }
        }
        throw new Error(`Unexpected child ${workflow.name}`)
      },
      runNoWaitChild: async (workflow, input, options) => {
        const name = typeof workflow === 'string' ? workflow : workflow.name
        calls.push({
          name,
          key: options?.key,
          metadata: options?.additionalMetadata,
        })
        if (name === 'learning-analytics-course-completion') {
          return resolvedRef(await completion(input))
        }
        expect(input).toEqual(effectiveRequest)
        return resolvedRef({
          ...effectiveRequest,
          completedAt: '2026-08-27T03:00:00Z',
        })
      },
      bulkRunNoWaitChildren: async () => [],
      sleepFor: async () => {},
    }

    await task(definitions, 'learning-analytics-public-course-v1').fn(
      initialRequest,
      context
    )

    expect(calls).toEqual([
      {
        name: 'learning-analytics-course-start',
        key: `start:course:${RUN_ID}:${COURSE_IDS[0]}:incremental`,
        metadata: {
          component: 'public-learning-analytics-coordinator',
          contractVersion: 'v1',
          runId: RUN_ID,
          courseId: COURSE_IDS[0],
          mode: 'incremental',
        },
      },
      {
        name: 'learning-analytics-course-v1',
        key: `private:course:${RUN_ID}:${COURSE_IDS[0]}:full`,
        metadata: {
          component: 'public-learning-analytics-coordinator',
          contractVersion: 'v1',
          runId: RUN_ID,
          courseId: COURSE_IDS[0],
          mode: 'full',
        },
      },
      {
        name: 'learning-analytics-course-completion',
        key: `complete:course:${RUN_ID}:${COURSE_IDS[0]}:full`,
        metadata: {
          component: 'public-learning-analytics-coordinator',
          contractVersion: 'v1',
          runId: RUN_ID,
          courseId: COURSE_IDS[0],
          mode: 'full',
        },
      },
    ])
    expect(completion).toHaveBeenCalledWith(
      expect.objectContaining({
        request: effectiveRequest,
        completedAt: '2026-08-27T03:00:00Z',
        cleanupOnly: false,
        fenceAt,
      })
    )
  })

  it('forces a full request when a rolling-upgrade start task returns the legacy output', async () => {
    const initialRequest = courseInput(COURSE_IDS[0], 'incremental')
    const fullRequest = courseInput(COURSE_IDS[0], 'full')
    const privateInputs: unknown[] = []
    const completionInputs: unknown[] = []
    const { definitions } = prepare()
    const context: FakeExecutionContext = {
      runChild: async (workflow) => {
        expect(workflow.name).toBe('learning-analytics-course-start')
        return {
          courseId: COURSE_IDS[0],
          cleanupOnly: false,
          fenceAt: '2026-08-27T02:00:00.000Z',
        }
      },
      runNoWaitChild: async (workflow, input) => {
        const name = typeof workflow === 'string' ? workflow : workflow.name
        if (name === 'learning-analytics-course-completion') {
          completionInputs.push(input)
          return resolvedRef({
            courseId: COURSE_IDS[0],
            completedAt: '2026-08-27T03:00:00Z',
            cleanupOnly: false,
          })
        }
        privateInputs.push(input)
        return resolvedRef({
          ...fullRequest,
          completedAt: '2026-08-27T03:00:00Z',
        })
      },
      bulkRunNoWaitChildren: async () => [],
      sleepFor: async () => {},
    }

    await task(definitions, 'learning-analytics-public-course-v1').fn(
      initialRequest,
      context
    )

    expect(privateInputs).toEqual([fullRequest])
    expect(completionInputs).toEqual([
      expect.objectContaining({ request: fullRequest }),
    ])
  })

  it('cancels and waits for a private course child when the durable course is cancelled', async () => {
    const cancel = vi.fn(async () => {})
    const privateError = new Error('private course failed')
    const { definitions } = prepare({
      handleStartLearningAnalyticsCourse: async () => ({
        courseId: COURSE_IDS[0],
        request: courseInput(COURSE_IDS[0]),
        cleanupOnly: false,
        fenceAt: '2026-08-27T02:00:00.000Z',
      }),
    })
    const context: FakeExecutionContext = {
      cancelled: true,
      runChild: async () => ({
        courseId: COURSE_IDS[0],
        request: courseInput(COURSE_IDS[0]),
        cleanupOnly: false,
        fenceAt: '2026-08-27T02:00:00.000Z',
      }),
      runNoWaitChild: async () => ({
        cancel,
        output: Promise.reject(privateError),
      }),
      bulkRunNoWaitChildren: async () => [],
      sleepFor: async () => {},
    }

    await expect(
      task(definitions, 'learning-analytics-public-course-v1').fn(
        courseInput(COURSE_IDS[0]),
        context
      )
    ).rejects.toThrow('cancelled during private dispatch')
    expect(cancel).toHaveBeenCalledOnce()
  })

  it('cancels a private child whose reference resolves after course cancellation', async () => {
    const dispatch = deferred<ChildRef<unknown>>()
    const output = deferred<unknown>()
    const cancel = vi.fn(async () => output.resolve(undefined))
    const { definitions } = prepare()
    const context: FakeExecutionContext = {
      cancelled: true,
      runChild: async () => ({
        courseId: COURSE_IDS[0],
        request: courseInput(COURSE_IDS[0]),
        cleanupOnly: false,
        fenceAt: '2026-08-27T02:00:00.000Z',
      }),
      runNoWaitChild: async () => dispatch.promise,
      bulkRunNoWaitChildren: async () => [],
      sleepFor: async () => {},
    }

    const pending = task(definitions, 'learning-analytics-public-course-v1').fn(
      courseInput(COURSE_IDS[0]),
      context
    )
    dispatch.resolve({ cancel, output: output.promise })

    await expect(pending).rejects.toThrow('cancelled during private dispatch')
    expect(cancel).toHaveBeenCalledOnce()
  })

  it('cancels a completed private child and skips completion after course cancellation', async () => {
    const events: string[] = []
    const cancel = vi.fn(async () => {})
    const privateOutput = deferred<{
      contractVersion: 'v1'
      runId: string
      courseId: string
      mode: 'incremental' | 'finalize' | 'full'
      completedAt: string
    }>()
    const outputAccessed = deferred<void>()
    const { definitions } = prepare()
    const context: FakeExecutionContext = {
      cancelled: false,
      runChild: async (workflow) => {
        events.push(workflow.name)
        if (workflow.name === 'learning-analytics-course-start') {
          return {
            courseId: COURSE_IDS[0],
            request: courseInput(COURSE_IDS[0]),
            cleanupOnly: false,
            fenceAt: '2026-08-27T02:00:00.000Z',
          }
        }
        throw new Error('course completion must not be dispatched')
      },
      runNoWaitChild: async () => ({
        cancel,
        get output() {
          outputAccessed.resolve()
          return privateOutput.promise
        },
      }),
      bulkRunNoWaitChildren: async () => [],
      sleepFor: async () => {},
    }

    const pending = task(definitions, 'learning-analytics-public-course-v1').fn(
      courseInput(COURSE_IDS[0]),
      context
    )
    await outputAccessed.promise
    context.cancelled = true
    privateOutput.resolve({
      ...courseInput(COURSE_IDS[0]),
      completedAt: '2026-08-27T03:00:00Z',
    })

    await expect(pending).rejects.toThrow(
      'cancelled before completion dispatch'
    )
    expect(cancel).toHaveBeenCalledOnce()
    expect(events).toEqual(['learning-analytics-course-start'])
  })

  it('cancels and awaits completion when the course is cancelled after dispatch', async () => {
    const completionOutput = deferred<{
      courseId: string
      completedAt: string
      cleanupOnly: boolean
    }>()
    const completionDispatched = deferred<void>()
    const cancelCompletion = vi.fn(async () => {})
    const { definitions } = prepare()
    const context: FakeExecutionContext = {
      cancelled: false,
      runChild: async (workflow) => {
        expect(workflow.name).toBe('learning-analytics-course-start')
        return {
          courseId: COURSE_IDS[0],
          request: courseInput(COURSE_IDS[0]),
          cleanupOnly: false,
          fenceAt: '2026-08-27T02:00:00.000Z',
        }
      },
      runNoWaitChild: async (workflow, input) => {
        const name = typeof workflow === 'string' ? workflow : workflow.name
        if (name === 'learning-analytics-course-completion') {
          completionDispatched.resolve()
          return { cancel: cancelCompletion, output: completionOutput.promise }
        }
        return resolvedRef({
          ...(input as Record<string, unknown>),
          completedAt: '2026-08-27T03:00:00Z',
        })
      },
      bulkRunNoWaitChildren: async () => [],
      sleepFor: async () => {},
    }

    const pending = task(definitions, 'learning-analytics-public-course-v1').fn(
      courseInput(COURSE_IDS[0]),
      context
    )
    await completionDispatched.promise
    context.cancelled = true
    completionOutput.resolve({
      courseId: COURSE_IDS[0],
      completedAt: '2026-08-27T03:00:00Z',
      cleanupOnly: false,
    })

    await expect(pending).rejects.toThrow('cancelled during completion')
    expect(cancelCompletion).toHaveBeenCalledOnce()
  })

  it('replenishes a lane sequentially and stops spawning at the gate', async () => {
    const courses = [courseInput(COURSE_IDS[0]), courseInput(COURSE_IDS[1])]
    const spawned: string[] = []
    let gateCalls = 0
    const { definitions } = prepare()
    const context: FakeExecutionContext = {
      runChild: async (workflow) => {
        expect(workflow.name).toBe('learning-analytics-spawn-gate')
        gateCalls += 1
        return { canStart: gateCalls === 1 }
      },
      runNoWaitChild: async (workflow, input, options) => {
        expect(typeof workflow === 'string' ? workflow : workflow.name).toBe(
          'learning-analytics-public-course-v1'
        )
        spawned.push((input as { courseId: string }).courseId)
        expect(options?.key).toBe(
          `course:${RUN_ID}:${(input as { courseId: string }).courseId}:incremental`
        )
        return resolvedRef({
          courseId: (input as { courseId: string }).courseId,
          completedAt: '2026-08-27T03:00:00Z',
          cleanupOnly: false,
        })
      },
      bulkRunNoWaitChildren: async () => [],
      sleepFor: async () => {},
    }

    const output = await task(
      definitions,
      'learning-analytics-public-batch-lane-v1'
    ).fn(
      {
        runId: RUN_ID,
        courses,
        stopSpawningAt: '2026-08-27T05:45:00+02:00',
      },
      context
    )

    expect(spawned).toEqual([COURSE_IDS[0]])
    expect(output).toEqual({
      completedCourseIds: [COURSE_IDS[0]],
      failedCourseIds: [],
      notStartedCourseIds: [COURSE_IDS[1]],
    })
  })

  it('cancels a finished course reference before recording success or starting the next course', async () => {
    const courses = [courseInput(COURSE_IDS[0]), courseInput(COURSE_IDS[1])]
    const spawned: string[] = []
    const cancel = vi.fn(async () => {})
    const courseOutput = deferred<{
      courseId: string
      completedAt: string
      cleanupOnly: boolean
    }>()
    const outputAccessed = deferred<void>()
    const { definitions } = prepare()
    let gateCalls = 0
    const context: FakeExecutionContext = {
      cancelled: false,
      runChild: async (workflow) => {
        expect(workflow.name).toBe('learning-analytics-spawn-gate')
        gateCalls += 1
        return { canStart: true }
      },
      runNoWaitChild: async (_workflow, input) => {
        const courseId = (input as { courseId: string }).courseId
        spawned.push(courseId)
        if (spawned.length > 1) {
          throw new Error('next course must not be dispatched')
        }
        return {
          cancel,
          get output() {
            outputAccessed.resolve()
            return courseOutput.promise
          },
        }
      },
      bulkRunNoWaitChildren: async () => [],
      sleepFor: async () => {},
    }

    const pending = task(
      definitions,
      'learning-analytics-public-batch-lane-v1'
    ).fn(
      {
        runId: RUN_ID,
        courses,
        stopSpawningAt: '2026-08-27T05:45:00+02:00',
      },
      context
    )
    await outputAccessed.promise
    context.cancelled = true
    courseOutput.resolve({
      courseId: COURSE_IDS[0],
      completedAt: '2026-08-27T03:00:00Z',
      cleanupOnly: false,
    })

    await expect(pending).rejects.toThrow('cancelled after course completion')
    expect(cancel).toHaveBeenCalledOnce()
    expect(gateCalls).toBe(1)
    expect(spawned).toEqual([COURSE_IDS[0]])
  })

  it('does not start the platform workflow until every course lane has completed', async () => {
    const events: string[] = []
    const courses = COURSE_IDS.map((courseId) => courseInput(courseId))
    const batch = batchInput({ includePlatform: true })
    const sleepFor = vi.fn(() => new Promise<void>(() => {}))
    const { definitions } = prepare()
    const context: FakeExecutionContext = {
      runChild: async (workflow, input, options) => {
        expect(workflow.name).toBe('learning-analytics-batch-deadline')
        expect(input).toEqual({ hardDeadlineAt: batch.hardDeadlineAt })
        expect(options?.key).toBe(`deadline:${RUN_ID}`)
        return { remainingSeconds: 3600 }
      },
      runNoWaitChild: async (workflow, input, options) => {
        const name = typeof workflow === 'string' ? workflow : workflow.name
        if (name === 'learning-analytics-batch-selector') {
          return resolvedRef({ courses })
        }
        expect(name).toBe('learning-analytics-platform-v1')
        events.push('platform')
        expect(input).toEqual({ contractVersion: 'v1', runId: RUN_ID })
        expect(options?.key).toBe(`platform:${RUN_ID}`)
        return resolvedRef({
          contractVersion: 'v1',
          runId: RUN_ID,
          completedAt: '2026-08-27T04:00:00Z',
        })
      },
      bulkRunNoWaitChildren: async (requests) => {
        events.push('courses')
        expect(requests).toHaveLength(2)
        expect(
          requests.map(({ input }) => (input as { courses: unknown[] }).courses)
        ).toEqual([[courses[0], courses[2]], [courses[1]]])
        return requests.map(() =>
          resolvedRef({
            completedCourseIds: [],
            failedCourseIds: [],
            notStartedCourseIds: [],
          })
        )
      },
      sleepFor,
    }

    const output = await task(
      definitions,
      'learning-analytics-public-batch-v1'
    ).fn(batch, context)

    expect(events).toEqual(['courses', 'platform'])
    expect(output).toEqual({
      runId: RUN_ID,
      selectedCourses: courses.length,
      completedCourses: 0,
      platformCompletedAt: '2026-08-27T04:00:00Z',
    })
    expect(sleepFor).toHaveBeenCalledWith('3600s', `hard-deadline:${RUN_ID}`)
  })

  it('cancels and waits for active course lanes at the hard deadline', async () => {
    let releaseDeadline!: () => void
    let releaseLane!: () => void
    const cancel = vi.fn(async () => releaseLane())
    const laneOutput = new Promise<unknown>((resolve) => {
      releaseLane = () =>
        resolve({
          completedCourseIds: [],
          failedCourseIds: [],
          notStartedCourseIds: [],
        })
    })
    const { definitions } = prepare()
    const context: FakeExecutionContext = {
      runChild: async (workflow) => {
        expect(workflow.name).toBe('learning-analytics-batch-deadline')
        return { remainingSeconds: 1 }
      },
      runNoWaitChild: async (workflow) => {
        const name = typeof workflow === 'string' ? workflow : workflow.name
        expect(name).toBe('learning-analytics-batch-selector')
        return resolvedRef({ courses: [courseInput(COURSE_IDS[0])] })
      },
      bulkRunNoWaitChildren: async () => [{ cancel, output: laneOutput }],
      sleepFor: () =>
        new Promise<void>((resolve) => {
          releaseDeadline = resolve
        }),
    }

    const pending = task(definitions, 'learning-analytics-public-batch-v1').fn(
      batchInput(),
      context
    )
    await vi.waitFor(() => expect(releaseDeadline).toBeTypeOf('function'))
    releaseDeadline()

    await expect(pending).rejects.toThrow('hard deadline')
    expect(cancel).toHaveBeenCalledOnce()
  })

  it('cancels a selector whose reference resolves after the hard deadline', async () => {
    const selectorDispatch = deferred<ChildRef<unknown>>()
    let releaseDeadline!: () => void
    const cancel = vi.fn(async () => {})
    const { definitions } = prepare()
    const context: FakeExecutionContext = {
      runChild: async () => ({ remainingSeconds: 1 }),
      runNoWaitChild: async () => selectorDispatch.promise,
      bulkRunNoWaitChildren: async () => [],
      sleepFor: () =>
        new Promise<void>((resolve) => {
          releaseDeadline = resolve
        }),
    }

    const pending = task(definitions, 'learning-analytics-public-batch-v1').fn(
      batchInput(),
      context
    )
    await vi.waitFor(() => expect(releaseDeadline).toBeTypeOf('function'))
    releaseDeadline()
    await Promise.resolve()
    selectorDispatch.resolve({
      cancel,
      output: Promise.resolve({ courses: [] }),
    })

    await expect(pending).rejects.toThrow('hard deadline')
    expect(cancel).toHaveBeenCalledOnce()
  })

  it('cancels course lanes whose references resolve after the hard deadline', async () => {
    const laneDispatch = deferred<Array<ChildRef<unknown>>>()
    let releaseDeadline!: () => void
    const cancel = vi.fn(async () => {})
    const { definitions } = prepare()
    const context: FakeExecutionContext = {
      runChild: async () => ({ remainingSeconds: 1 }),
      runNoWaitChild: async () =>
        resolvedRef({ courses: [courseInput(COURSE_IDS[0])] }),
      bulkRunNoWaitChildren: async () => laneDispatch.promise,
      sleepFor: () =>
        new Promise<void>((resolve) => {
          releaseDeadline = resolve
        }),
    }

    const pending = task(definitions, 'learning-analytics-public-batch-v1').fn(
      batchInput(),
      context
    )
    await vi.waitFor(() => expect(releaseDeadline).toBeTypeOf('function'))
    releaseDeadline()
    await Promise.resolve()
    laneDispatch.resolve([
      {
        cancel,
        output: Promise.resolve({
          completedCourseIds: [],
          failedCourseIds: [],
          notStartedCourseIds: [],
        }),
      },
    ])

    await expect(pending).rejects.toThrow('hard deadline')
    expect(cancel).toHaveBeenCalledOnce()
  })

  it('cancels an in-flight platform child when the hard deadline expires after course lanes', async () => {
    let releaseDeadline!: () => void
    let releasePlatform!: () => void
    let cancelled = false
    const cancel = vi.fn(async () => {
      cancelled = true
      releasePlatform()
    })
    const platformOutput = new Promise<unknown>((resolve) => {
      releasePlatform = () =>
        resolve({
          contractVersion: 'v1',
          runId: RUN_ID,
          completedAt: '2026-08-27T04:00:00Z',
        })
    })
    const { definitions } = prepare()
    const context: FakeExecutionContext = {
      runChild: async (workflow) => {
        expect(workflow.name).toBe('learning-analytics-batch-deadline')
        return { remainingSeconds: 1 }
      },
      runNoWaitChild: async (workflow) => {
        const name = typeof workflow === 'string' ? workflow : workflow.name
        if (name === 'learning-analytics-batch-selector') {
          return resolvedRef({ courses: [courseInput(COURSE_IDS[0])] })
        }
        expect(name).toBe('learning-analytics-platform-v1')
        setTimeout(() => {
          releaseDeadline()
          setTimeout(() => {
            if (!cancelled) releasePlatform()
          }, 0)
        }, 0)
        return { cancel, output: platformOutput }
      },
      bulkRunNoWaitChildren: async () => [
        resolvedRef({
          completedCourseIds: [COURSE_IDS[0]],
          failedCourseIds: [],
          notStartedCourseIds: [],
        }),
      ],
      sleepFor: () =>
        new Promise<void>((resolve) => {
          releaseDeadline = resolve
        }),
    }

    await expect(
      task(definitions, 'learning-analytics-public-batch-v1').fn(
        batchInput({ includePlatform: true }),
        context
      )
    ).rejects.toThrow('hard deadline')
    expect(cancel).toHaveBeenCalledOnce()
  })

  it('fails immediately when the database clock is already at the hard deadline', async () => {
    const runNoWaitChild = vi.fn(async () => resolvedRef(undefined))
    const sleepFor = vi.fn(async () => {})
    const { definitions } = prepare()
    const context: FakeExecutionContext = {
      runChild: async (workflow) => {
        expect(workflow.name).toBe('learning-analytics-batch-deadline')
        return { remainingSeconds: 0 }
      },
      runNoWaitChild,
      bulkRunNoWaitChildren: async () => [],
      sleepFor,
    }

    await expect(
      task(definitions, 'learning-analytics-public-batch-v1').fn(
        batchInput(),
        context
      )
    ).rejects.toThrow('hard deadline')
    expect(sleepFor).not.toHaveBeenCalled()
    expect(runNoWaitChild).not.toHaveBeenCalled()
  })

  it('dispatches only when the database-clock handler produces a batch', async () => {
    const batch = batchInput()
    const dispatches: unknown[] = []
    const { definitions } = prepare({
      handlePrepareScheduledLearningAnalyticsBatch: async () => batch,
    })
    const context: FakeExecutionContext = {
      runChild: async () => undefined,
      runNoWaitChild: async (workflow, input, options) => {
        dispatches.push({
          name: typeof workflow === 'string' ? workflow : workflow.name,
          input,
          key: options?.key,
        })
        return resolvedRef(undefined)
      },
      bulkRunNoWaitChildren: async () => [],
      sleepFor: async () => {},
    }

    await expect(
      task(definitions, 'learning-analytics-scheduled-dispatch').fn({}, context)
    ).resolves.toEqual({ dispatched: true, runId: RUN_ID })
    expect(dispatches).toEqual([
      {
        name: 'learning-analytics-public-batch-v1',
        input: batch,
        key: `scheduled:${RUN_ID}`,
      },
    ])
  })
})
