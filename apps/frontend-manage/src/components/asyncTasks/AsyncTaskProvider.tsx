import { useApolloClient, useMutation, useQuery } from '@apollo/client'
import {
  AcknowledgeAsyncTasksDocument,
  AsyncTaskKind,
  AsyncTaskStatus,
  type Course,
  GetAsyncTasksDocument,
  GetUserCoursesDocument,
  StartCourseDuplicationDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { COURSE_DUPLICATION_ERROR_CODES } from '@klicker-uzh/types'
import { toast } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { useRouter } from 'next/router'
import { useTranslations } from 'next-intl'
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from 'react'
import {
  type CourseDuplicationErrorType,
  type CourseDuplicationFormData,
  getCourseDuplicationErrorMessage,
} from '../courses/modals/CourseDuplicationModal'
import {
  type AsyncTaskData,
  getManageCoursePath,
  isActiveTask,
  isTerminalTask,
} from './asyncTaskHelpers'

export type { AsyncTaskData } from './asyncTaskHelpers'

type CourseDuplicationSourceCourse = Pick<
  Course,
  | 'id'
  | 'isGamificationEnabled'
  | 'maxGroupSize'
  | 'name'
  | 'preferredGroupSize'
>

interface StartCourseDuplicationArgs {
  course: CourseDuplicationSourceCourse
  values: CourseDuplicationFormData
  onError: (errorType?: CourseDuplicationErrorType) => void
}

interface AsyncTaskContextValue {
  tasks: AsyncTaskData[]
  activeTasks: AsyncTaskData[]
  attentionCount: number
  loading: boolean
  acknowledgeTerminalTasks: () => Promise<void>
  refetchTasks: () => Promise<void>
  isSourceCourseDuplicating: (sourceCourseId: string) => boolean
  startCourseDuplication: (args: StartCourseDuplicationArgs) => Promise<boolean>
}

const AsyncTaskContext = createContext<AsyncTaskContextValue | null>(null)

const COURSE_DUPLICATION_STORAGE_KEY = 'course-duplication-job-ids'
const ASYNC_TASK_POLL_INTERVAL = 5000
const EMPTY_ASYNC_TASKS: AsyncTaskData[] = []

function getCourseDuplicationGroupSize(
  value: number | string | null | undefined,
  fallback: number
) {
  if (value === undefined || value === null || value === '') {
    return fallback
  }

  const parsedValue = Number(value)
  return Number.isFinite(parsedValue) ? parsedValue : fallback
}

function getGraphQLErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined

  const extensions = (error as { extensions?: { code?: unknown } }).extensions
  if (typeof extensions?.code === 'string') return extensions.code

  const graphQLErrors = (error as { graphQLErrors?: unknown[] }).graphQLErrors
  for (const graphQLError of graphQLErrors ?? []) {
    const code = getGraphQLErrorCode(graphQLError)
    if (code) return code
  }

  const errors = (error as { errors?: unknown[] }).errors
  for (const nestedError of errors ?? []) {
    const code = getGraphQLErrorCode(nestedError)
    if (code) return code
  }

  return undefined
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error

  if (error && typeof error === 'object') {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string') return message
  }

  return String(error)
}

function getCourseDuplicationErrorType(
  error: unknown
): CourseDuplicationErrorType {
  const code = getGraphQLErrorCode(error)
  if (code === COURSE_DUPLICATION_ERROR_CODES.partialFailure) return 'partial'

  const normalizedMessage = getErrorMessage(error).toLowerCase()
  if (normalizedMessage.includes('not all')) return 'partial'
  if (
    normalizedMessage.includes('access') ||
    normalizedMessage.includes('permission')
  ) {
    return 'access'
  }

  return 'generic'
}

function getCourseDuplicationTaskErrorType(
  errorCode: string | null | undefined
): CourseDuplicationErrorType {
  switch (errorCode) {
    case COURSE_DUPLICATION_ERROR_CODES.accessDenied:
      return 'access'
    case COURSE_DUPLICATION_ERROR_CODES.partialFailure:
      return 'partial'
    default:
      return 'generic'
  }
}

function readStoredCourseDuplicationJobIds() {
  try {
    const storedValue = window.localStorage.getItem(
      COURSE_DUPLICATION_STORAGE_KEY
    )
    const parsedValue = storedValue ? JSON.parse(storedValue) : []

    return new Set(
      Array.isArray(parsedValue)
        ? parsedValue.filter(
            (value): value is string => typeof value === 'string'
          )
        : []
    )
  } catch (error) {
    console.error('Failed to read course duplication jobs from storage', error)
    return new Set<string>()
  }
}

function writeStoredCourseDuplicationJobIds(jobIds: Set<string>) {
  try {
    if (jobIds.size === 0) {
      window.localStorage.removeItem(COURSE_DUPLICATION_STORAGE_KEY)
      return
    }

    window.localStorage.setItem(
      COURSE_DUPLICATION_STORAGE_KEY,
      JSON.stringify([...jobIds])
    )
  } catch (error) {
    console.error('Failed to persist course duplication jobs', error)
  }
}

export function AsyncTaskProvider({
  children,
}: Readonly<{ children: ReactNode }>) {
  const router = useRouter()
  const t = useTranslations()
  const client = useApolloClient()
  const inFlightSourceCourseIdsRef = useRef(new Set<string>())
  const previousStatusesRef = useRef(new Map<string, AsyncTaskStatus>())
  const trackedCourseDuplicationIdsRef = useRef(new Set<string>())

  const { data, loading, refetch, startPolling, stopPolling } = useQuery(
    GetAsyncTasksDocument,
    {
      fetchPolicy: 'cache-and-network',
      nextFetchPolicy: 'cache-first',
      ssr: false,
    }
  )
  const [acknowledgeAsyncTasks] = useMutation(AcknowledgeAsyncTasksDocument)
  const [startCourseDuplicationMutation] = useMutation(
    StartCourseDuplicationDocument
  )

  const tasks = data?.asyncTasks ?? EMPTY_ASYNC_TASKS
  const activeTasks = useMemo(() => tasks.filter(isActiveTask), [tasks])
  const unreadTerminalTasks = useMemo(
    () => tasks.filter((task) => isTerminalTask(task) && !task.readAt),
    [tasks]
  )
  const attentionCount =
    data?.asyncTaskAttentionCount ??
    activeTasks.length + unreadTerminalTasks.length
  const hasActiveTasks = activeTasks.length > 0

  const refetchTasks = useCallback(async () => {
    try {
      await refetch()
    } catch (error) {
      console.error('Failed to refresh asynchronous tasks', error)
    }
  }, [refetch])

  useEffect(() => {
    trackedCourseDuplicationIdsRef.current = readStoredCourseDuplicationJobIds()
  }, [])

  useEffect(() => {
    if (hasActiveTasks) {
      startPolling(ASYNC_TASK_POLL_INTERVAL)
    } else {
      stopPolling()
    }

    return stopPolling
  }, [hasActiveTasks, startPolling, stopPolling])

  useEffect(() => {
    const handleWindowFocus = () => {
      void refetchTasks()
    }

    window.addEventListener('focus', handleWindowFocus)
    return () => window.removeEventListener('focus', handleWindowFocus)
  }, [refetchTasks])

  useEffect(() => {
    if (loading) return

    const nextStatuses = new Map(
      tasks.map((task) => [task.id, task.status] as const)
    )

    // Toast only jobs started or observed as active in this browser. Persisted
    // ids preserve the existing completion signal across reloads without
    // making local storage the source of truth for task state.
    let trackedIdsChanged = false
    for (const task of tasks) {
      if (task.kind !== AsyncTaskKind.CourseDuplication) continue

      const previousStatus = previousStatusesRef.current.get(task.id)
      const wasActive =
        previousStatus === AsyncTaskStatus.Queued ||
        previousStatus === AsyncTaskStatus.Running
      const wasStartedHere = trackedCourseDuplicationIdsRef.current.has(task.id)
      if ((!wasActive && !wasStartedHere) || !isTerminalTask(task)) continue

      if (trackedCourseDuplicationIdsRef.current.delete(task.id)) {
        trackedIdsChanged = true
      }

      if (task.status === AsyncTaskStatus.Succeeded && task.resultId) {
        const resultId = task.resultId
        toast({
          type: 'success',
          message: t('manage.courseList.courseDuplicationSucceeded', {
            name: task.targetName ?? task.subjectName,
          }),
          options: {
            duration: 30_000,
            action: {
              label: t('manage.courseList.courseDuplicationOpenCourse'),
              onClick: () => {
                void router.push(getManageCoursePath(resultId))
              },
            },
          },
        })
        void client
          .refetchQueries({ include: [GetUserCoursesDocument] })
          .catch((error) =>
            console.error('Failed to refetch courses after duplication', error)
          )
      } else if (task.status === AsyncTaskStatus.Failed) {
        toast({
          type: 'error',
          message: getCourseDuplicationErrorMessage(
            t,
            getCourseDuplicationTaskErrorType(task.errorCode)
          ),
          options: { duration: 6000 },
        })
      }
    }

    if (trackedIdsChanged) {
      writeStoredCourseDuplicationJobIds(trackedCourseDuplicationIdsRef.current)
    }

    previousStatusesRef.current = nextStatuses
  }, [client, loading, router, t, tasks])

  const acknowledgeTerminalTasks = useCallback(async () => {
    const ids = unreadTerminalTasks.map((task) => task.id)
    if (ids.length === 0) return

    try {
      await acknowledgeAsyncTasks({ variables: { ids } })
    } catch (error) {
      console.error('Failed to acknowledge asynchronous tasks', error)
      toast({
        type: 'error',
        message: t('manage.asyncTasks.acknowledgeFailed'),
      })
      return
    }

    await refetchTasks()
  }, [acknowledgeAsyncTasks, refetchTasks, t, unreadTerminalTasks])

  const isSourceCourseDuplicating = useCallback(
    (sourceCourseId: string) =>
      inFlightSourceCourseIdsRef.current.has(sourceCourseId) ||
      activeTasks.some(
        (task) =>
          task.kind === AsyncTaskKind.CourseDuplication &&
          task.subjectId === sourceCourseId
      ),
    [activeTasks]
  )

  const startCourseDuplication = useCallback(
    async ({ course, values, onError }: StartCourseDuplicationArgs) => {
      if (
        inFlightSourceCourseIdsRef.current.has(course.id) ||
        activeTasks.some(
          (task) =>
            task.kind === AsyncTaskKind.CourseDuplication &&
            task.subjectId === course.id
        )
      ) {
        onError('inProgress')
        return false
      }

      inFlightSourceCourseIdsRef.current.add(course.id)

      try {
        const result = await startCourseDuplicationMutation({
          variables: {
            name: values.name,
            displayName: values.displayName,
            description:
              !values.description?.match(/^(<br>(\n)*)$/g) &&
              values.description !== ''
                ? values.description
                : null,
            language: values.language,
            color: values.color,
            startDate: dayjs(values.startDate).utc().toISOString(),
            endDate: dayjs(values.endDate).utc().toISOString(),
            notificationEmail: values.notificationEmail,
            isGamificationEnabled: course.isGamificationEnabled,
            isGroupCreationEnabled: values.isGroupCreationEnabled,
            groupDeadlineDate: dayjs(values.groupCreationDeadline)
              .utc()
              .toISOString(),
            maxGroupSize: getCourseDuplicationGroupSize(
              values.maxGroupSize,
              course.maxGroupSize
            ),
            preferredGroupSize: getCourseDuplicationGroupSize(
              values.preferredGroupSize,
              course.preferredGroupSize
            ),
            sourceCourseId: course.id,
            duplicateLiveQuizzes: values.copyLiveQuizzes,
            duplicatePracticeQuizzes: values.copyPracticeQuizzes,
            duplicateMicrolearnings: values.copyMicroLearnings,
            duplicateGroupActivities: values.copyGroupActivities,
          },
        })

        const startedJob = result.data?.startCourseDuplication
        if (startedJob) {
          trackedCourseDuplicationIdsRef.current.add(startedJob.id)
          writeStoredCourseDuplicationJobIds(
            trackedCourseDuplicationIdsRef.current
          )
          void refetchTasks()
          return true
        }

        onError(
          result.errors?.[0]
            ? getCourseDuplicationErrorType(result.errors[0])
            : 'generic'
        )
      } catch (error) {
        onError(getCourseDuplicationErrorType(error))
        console.error(error)
      } finally {
        inFlightSourceCourseIdsRef.current.delete(course.id)
      }

      return false
    },
    [activeTasks, refetchTasks, startCourseDuplicationMutation]
  )

  const value = useMemo(
    () => ({
      tasks,
      activeTasks,
      attentionCount,
      loading,
      acknowledgeTerminalTasks,
      refetchTasks,
      isSourceCourseDuplicating,
      startCourseDuplication,
    }),
    [
      acknowledgeTerminalTasks,
      activeTasks,
      attentionCount,
      isSourceCourseDuplicating,
      loading,
      refetchTasks,
      startCourseDuplication,
      tasks,
    ]
  )

  return (
    <AsyncTaskContext.Provider value={value}>
      {children}
    </AsyncTaskContext.Provider>
  )
}

export function useAsyncTasks() {
  const context = useContext(AsyncTaskContext)
  if (!context) {
    throw new Error('useAsyncTasks must be used within AsyncTaskProvider')
  }
  return context
}

export function useCourseDuplicationStatus() {
  const { isSourceCourseDuplicating, startCourseDuplication } = useAsyncTasks()
  return { isSourceCourseDuplicating, startCourseDuplication }
}
