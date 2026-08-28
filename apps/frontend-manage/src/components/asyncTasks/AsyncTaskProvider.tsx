import { useApolloClient, useMutation, useQuery } from '@apollo/client'
import {
  AcknowledgeAsyncTasksDocument,
  AsyncTaskKind,
  AsyncTaskStatus,
  type Course,
  GetAsyncTasksDocument,
  type GetAsyncTasksQuery,
  GetUserCoursesDocument,
  StartCourseDuplicationDocument,
} from '@klicker-uzh/graphql/dist/ops'
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

export type AsyncTaskData = GetAsyncTasksQuery['asyncTasks'][number]

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

const COURSE_DUPLICATION_PARTIAL_FAILURE_CODE =
  'COURSE_DUPLICATION_PARTIAL_FAILURE'
const ASYNC_TASK_POLL_INTERVAL = 5000
const EMPTY_ASYNC_TASKS: AsyncTaskData[] = []

function isActiveTask(task: AsyncTaskData) {
  return (
    task.status === AsyncTaskStatus.Queued ||
    task.status === AsyncTaskStatus.Running
  )
}

function isTerminalTask(task: AsyncTaskData) {
  return (
    task.status === AsyncTaskStatus.Succeeded ||
    task.status === AsyncTaskStatus.Failed
  )
}

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
  if (code === COURSE_DUPLICATION_PARTIAL_FAILURE_CODE) return 'partial'

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

export function AsyncTaskProvider({
  children,
}: Readonly<{ children: ReactNode }>) {
  const router = useRouter()
  const t = useTranslations()
  const client = useApolloClient()
  const inFlightSourceCourseIdsRef = useRef(new Set<string>())
  const previousStatusesRef = useRef(new Map<string, AsyncTaskStatus>())
  const statusesInitializedRef = useRef(false)

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
  const attentionCount = activeTasks.length + unreadTerminalTasks.length

  useEffect(() => {
    if (activeTasks.length > 0) {
      startPolling(ASYNC_TASK_POLL_INTERVAL)
    } else {
      stopPolling()
    }

    return stopPolling
  }, [activeTasks.length, startPolling, stopPolling])

  useEffect(() => {
    const handleWindowFocus = () => {
      void refetch()
    }

    window.addEventListener('focus', handleWindowFocus)
    return () => window.removeEventListener('focus', handleWindowFocus)
  }, [refetch])

  useEffect(() => {
    if (loading) return

    const nextStatuses = new Map(
      tasks.map((task) => [task.id, task.status] as const)
    )

    if (statusesInitializedRef.current) {
      for (const task of tasks) {
        if (task.kind !== AsyncTaskKind.CourseDuplication) continue

        const previousStatus = previousStatusesRef.current.get(task.id)
        const wasActive =
          previousStatus === AsyncTaskStatus.Queued ||
          previousStatus === AsyncTaskStatus.Running
        if (!wasActive || !isTerminalTask(task)) continue

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
                  void router.push(`/courses/${resultId}`)
                },
              },
            },
          })
          void client
            .refetchQueries({ include: [GetUserCoursesDocument] })
            .catch((error) =>
              console.error(
                'Failed to refetch courses after duplication',
                error
              )
            )
        } else if (task.status === AsyncTaskStatus.Failed) {
          const errorType: CourseDuplicationErrorType =
            task.errorCode === 'COURSE_DUPLICATION_ACCESS_DENIED'
              ? 'access'
              : task.errorCode === 'COURSE_DUPLICATION_PARTIAL_FAILURE'
                ? 'partial'
                : 'generic'
          toast({
            type: 'error',
            message: getCourseDuplicationErrorMessage(t, errorType),
            options: { duration: 6000 },
          })
        }
      }
    }

    previousStatusesRef.current = nextStatuses
    statusesInitializedRef.current = true
  }, [client, loading, router, t, tasks])

  const refetchTasks = useCallback(async () => {
    await refetch()
  }, [refetch])

  const acknowledgeTerminalTasks = useCallback(async () => {
    const ids = unreadTerminalTasks.map((task) => task.id)
    if (ids.length === 0) return

    try {
      await acknowledgeAsyncTasks({ variables: { ids } })
      await refetch()
    } catch (error) {
      console.error('Failed to acknowledge asynchronous tasks', error)
      toast({
        type: 'error',
        message: t('manage.asyncTasks.acknowledgeFailed'),
      })
    }
  }, [acknowledgeAsyncTasks, refetch, t, unreadTerminalTasks])

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

        if (result.data?.startCourseDuplication) {
          void refetch().catch((error) =>
            console.error(
              'Failed to refresh tasks after starting course duplication',
              error
            )
          )
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
    [activeTasks, refetch, startCourseDuplicationMutation]
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
