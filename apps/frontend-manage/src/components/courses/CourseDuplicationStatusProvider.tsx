import { useApolloClient, useLazyQuery, useMutation } from '@apollo/client'
import { faCopy } from '@fortawesome/free-regular-svg-icons'
import { faChevronUp } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  type Course,
  CourseDuplicationJobStatus,
  type CourseDuplicationStatus as CourseDuplicationStatusData,
  GetCourseDuplicationStatusesDocument,
  type GetCourseDuplicationStatusesQuery,
  GetUserCoursesDocument,
  StartCourseDuplicationDocument,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  toast,
} from '@uzh-bf/design-system'
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
  useState,
} from 'react'
import {
  type CourseDuplicationErrorType,
  type CourseDuplicationFormData,
  getCourseDuplicationErrorMessage,
} from './modals/CourseDuplicationModal'

type CourseDuplicationSourceCourse = Pick<
  Course,
  | 'id'
  | 'isGamificationEnabled'
  | 'maxGroupSize'
  | 'name'
  | 'preferredGroupSize'
>

type CourseDuplicationJob = Pick<
  CourseDuplicationStatusData,
  | 'createdAt'
  | 'createdCourseId'
  | 'errorMessage'
  | 'errorType'
  | 'id'
  | 'sourceCourseId'
  | 'sourceCourseName'
  | 'status'
  | 'targetCourseName'
  | 'updatedAt'
>

type CourseDuplicationStatusResponse =
  GetCourseDuplicationStatusesQuery['courseDuplicationStatuses']

interface StartCourseDuplicationArgs {
  course: CourseDuplicationSourceCourse
  values: CourseDuplicationFormData
  onError: (errorType?: CourseDuplicationErrorType) => void
}

interface CourseDuplicationStatusContextValue {
  isSourceCourseDuplicating: (sourceCourseId: string) => boolean
  startCourseDuplication: (args: StartCourseDuplicationArgs) => Promise<boolean>
}

const CourseDuplicationStatusContext =
  createContext<CourseDuplicationStatusContextValue | null>(null)

const COURSE_DUPLICATION_PARTIAL_FAILURE_CODE =
  'COURSE_DUPLICATION_PARTIAL_FAILURE'
const COURSE_DUPLICATION_STORAGE_KEY = 'course-duplication-job-ids'
const COURSE_DUPLICATION_POLL_INTERVAL = 5000

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
  if (code === COURSE_DUPLICATION_PARTIAL_FAILURE_CODE) {
    return 'partial'
  }

  const message = getErrorMessage(error)
  const normalizedMessage = message.toLowerCase()

  if (normalizedMessage.includes('not all')) {
    return 'partial'
  }

  if (
    normalizedMessage.includes('access') ||
    normalizedMessage.includes('permission')
  ) {
    return 'access'
  }

  return 'generic'
}

function getStatusErrorType(
  errorType?: string | null
): CourseDuplicationErrorType {
  if (
    errorType === 'access' ||
    errorType === 'inProgress' ||
    errorType === 'partial'
  ) {
    return errorType
  }

  return 'generic'
}

function isActiveCourseDuplicationStatus(
  status: CourseDuplicationJob['status']
) {
  return (
    status === CourseDuplicationJobStatus.Pending ||
    status === CourseDuplicationJobStatus.Running
  )
}

function isTerminalCourseDuplicationStatus(
  status: CourseDuplicationJob['status']
) {
  return (
    status === CourseDuplicationJobStatus.Completed ||
    status === CourseDuplicationJobStatus.Failed
  )
}

function readStoredCourseDuplicationJobIds() {
  if (typeof window === 'undefined') return []

  try {
    const storedValue = window.localStorage.getItem(
      COURSE_DUPLICATION_STORAGE_KEY
    )
    const parsedValue = storedValue ? JSON.parse(storedValue) : []

    return Array.isArray(parsedValue)
      ? parsedValue.filter(
          (value): value is string => typeof value === 'string'
        )
      : []
  } catch (error) {
    console.error('Failed to read course duplication jobs from storage', error)
    return []
  }
}

function writeStoredCourseDuplicationJobIds(jobIds: string[]) {
  if (typeof window === 'undefined') return

  try {
    if (jobIds.length === 0) {
      window.localStorage.removeItem(COURSE_DUPLICATION_STORAGE_KEY)
    } else {
      window.localStorage.setItem(
        COURSE_DUPLICATION_STORAGE_KEY,
        JSON.stringify(jobIds)
      )
    }
  } catch (error) {
    console.error('Failed to persist course duplication jobs', error)
  }
}

function CourseDuplicationStatusDropdown({
  jobs,
}: Readonly<{ jobs: CourseDuplicationJob[] }>) {
  const t = useTranslations()

  if (jobs.length === 0) return null

  return (
    <div
      aria-live="polite"
      className="fixed right-4 bottom-4 z-30 max-w-[calc(100vw-2rem)]"
      data-cy="course-duplication-loading"
      role="status"
    >
      <Popover>
        <PopoverTrigger
          className="flex h-12 items-center gap-3 rounded-md border border-gray-200 bg-white px-4 text-left text-sm shadow-lg transition hover:border-primary-80 focus:outline-none focus:ring-2 focus:ring-primary-80"
          data-cy="course-duplication-status-trigger"
        >
          <Loader basic data={{ cy: 'course-duplication-spinner' }} />
          <span className="max-w-[14rem] truncate font-bold text-gray-900">
            {t('manage.courseList.courseDuplicationStatusTab')}
          </span>
          <span className="sr-only">
            {t('manage.courseList.courseDuplicationStatusCount', {
              count: jobs.length,
            })}
          </span>
          <span
            aria-hidden="true"
            className="rounded-full bg-primary-100 px-2 py-0.5 text-xs font-bold text-white"
          >
            {jobs.length}
          </span>
          <FontAwesomeIcon
            aria-hidden="true"
            className="h-3 w-3 text-gray-600"
            icon={faChevronUp}
          />
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className="w-[min(24rem,calc(100vw-2rem))] p-0"
          side="top"
        >
          <div className="border-b border-gray-100 p-4">
            <div className="flex items-center gap-2 font-bold text-gray-900">
              <FontAwesomeIcon icon={faCopy} className="h-4 w-4" />
              {t('manage.courseList.courseDuplicationStatusTitle')}
            </div>
            <p className="mt-1 text-sm text-gray-600">
              {t('manage.courseList.courseDuplicationStatusDescription')}
            </p>
          </div>
          <ul className="max-h-72 overflow-y-auto">
            {jobs.map((job) => (
              <li
                className="flex items-start gap-3 border-gray-100 border-t px-4 py-3 first:border-t-0"
                key={job.id}
              >
                <Loader basic data={{ cy: 'course-duplication-spinner' }} />
                <div className="min-w-0">
                  <div className="truncate font-bold text-gray-900">
                    {job.targetCourseName}
                  </div>
                  <div className="truncate text-sm text-gray-600">
                    {t('manage.courseList.courseDuplicationStatusSource', {
                      source: job.sourceCourseName,
                    })}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </PopoverContent>
      </Popover>
    </div>
  )
}

export function CourseDuplicationProvider({
  children,
}: Readonly<{ children: ReactNode }>) {
  const router = useRouter()
  const t = useTranslations()
  const client = useApolloClient()
  const [startCourseDuplicationMutation] = useMutation(
    StartCourseDuplicationDocument
  )
  const [jobIds, setJobIds] = useState<string[]>([])
  const [jobsById, setJobsById] = useState<
    Record<string, CourseDuplicationJob>
  >({})
  const [storageInitialized, setStorageInitialized] = useState(false)
  const handledTerminalJobIdsRef = useRef(new Set<string>())
  const jobIdsRef = useRef<string[]>([])

  useEffect(() => {
    setJobIds(readStoredCourseDuplicationJobIds())
    setStorageInitialized(true)
  }, [])

  useEffect(() => {
    if (!storageInitialized) return

    writeStoredCourseDuplicationJobIds(jobIds)
  }, [jobIds, storageInitialized])

  useEffect(() => {
    jobIdsRef.current = jobIds
  }, [jobIds])

  const addJobId = useCallback((jobId: string) => {
    setJobIds((currentIds) =>
      currentIds.includes(jobId) ? currentIds : [...currentIds, jobId]
    )
  }, [])

  const removeJobId = useCallback((jobId: string) => {
    setJobIds((currentIds) => currentIds.filter((id) => id !== jobId))
    setJobsById((currentJobs) => {
      const { [jobId]: _removedJob, ...nextJobs } = currentJobs
      return nextJobs
    })
  }, [])

  const upsertJob = useCallback((job: CourseDuplicationJob) => {
    setJobsById((currentJobs) => ({
      ...currentJobs,
      [job.id]: job,
    }))
  }, [])

  const [fetchStatuses] = useLazyQuery(GetCourseDuplicationStatusesDocument, {
    fetchPolicy: 'network-only',
  })

  const handleStatusResponse = useCallback(
    (statuses: CourseDuplicationStatusResponse, requestedJobIds: string[]) => {
      const requestedJobIdSet = new Set(requestedJobIds)
      const returnedJobIds = new Set(statuses.map((job) => job.id))

      for (const jobId of requestedJobIds) {
        if (!returnedJobIds.has(jobId)) {
          removeJobId(jobId)
        }
      }

      for (const job of statuses) {
        if (!requestedJobIdSet.has(job.id)) continue

        if (isActiveCourseDuplicationStatus(job.status)) {
          upsertJob(job)
          continue
        }

        if (!isTerminalCourseDuplicationStatus(job.status)) continue
        if (handledTerminalJobIdsRef.current.has(job.id)) continue

        handledTerminalJobIdsRef.current.add(job.id)
        removeJobId(job.id)

        if (
          job.status === CourseDuplicationJobStatus.Completed &&
          job.createdCourseId
        ) {
          const createdCourseId = job.createdCourseId

          toast({
            type: 'success',
            message: t('manage.courseList.courseDuplicationSucceeded', {
              name: job.targetCourseName,
            }),
            options: {
              duration: 30_000,
              action: {
                label: t('manage.courseList.courseDuplicationOpenCourse'),
                onClick: () => {
                  void router.push(`/courses/${createdCourseId}`)
                },
              },
            },
          })
          void client.refetchQueries({ include: [GetUserCoursesDocument] })
        } else {
          toast({
            type: 'error',
            message: getCourseDuplicationErrorMessage(
              t,
              getStatusErrorType(job.errorType)
            ),
            options: { duration: 6000 },
          })
        }
      }
    },
    [client, removeJobId, router, t, upsertJob]
  )

  const hasJobs = jobIds.length > 0

  useEffect(() => {
    if (!storageInitialized || !hasJobs) return

    let cancelled = false
    let timeoutId: number | undefined

    const poll = async () => {
      if (cancelled) return

      const requestedJobIds = [...jobIdsRef.current]

      try {
        if (requestedJobIds.length > 0) {
          const result = await fetchStatuses({
            variables: { ids: requestedJobIds },
          })
          const statuses = result.data?.courseDuplicationStatuses

          if (!cancelled && statuses) {
            handleStatusResponse(statuses, requestedJobIds)
          }
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to poll course duplication status', error)
        }
      } finally {
        if (!cancelled) {
          timeoutId = window.setTimeout(() => {
            void poll()
          }, COURSE_DUPLICATION_POLL_INTERVAL)
        }
      }
    }

    void poll()

    return () => {
      cancelled = true
      if (timeoutId !== undefined) window.clearTimeout(timeoutId)
    }
  }, [fetchStatuses, handleStatusResponse, hasJobs, storageInitialized])

  const activeJobs = useMemo(
    () =>
      Object.values(jobsById)
        .filter((job) => isActiveCourseDuplicationStatus(job.status))
        .sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        ),
    [jobsById]
  )

  const isSourceCourseDuplicating = useCallback(
    (sourceCourseId: string) =>
      activeJobs.some((job) => job.sourceCourseId === sourceCourseId),
    [activeJobs]
  )

  const startCourseDuplication = useCallback(
    async ({ course, values, onError }: StartCourseDuplicationArgs) => {
      if (activeJobs.some((job) => job.sourceCourseId === course.id)) {
        onError('inProgress')
        return false
      }

      try {
        const startDateUTC = dayjs(values.startDate).utc().toISOString()
        const endDateUTC = dayjs(values.endDate).utc().toISOString()
        const groupDeadlineDateUTC = dayjs(values.groupCreationDeadline)
          .utc()
          .toISOString()
        const maxGroupSize = getCourseDuplicationGroupSize(
          values.maxGroupSize,
          course.maxGroupSize
        )
        const preferredGroupSize = getCourseDuplicationGroupSize(
          values.preferredGroupSize,
          course.preferredGroupSize
        )

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
            startDate: startDateUTC,
            endDate: endDateUTC,
            notificationEmail: values.notificationEmail,
            isGamificationEnabled: course.isGamificationEnabled,
            isGroupCreationEnabled: values.isGroupCreationEnabled,
            groupDeadlineDate: groupDeadlineDateUTC,
            maxGroupSize,
            preferredGroupSize,
            sourceCourseId: course.id,
            duplicateLiveQuizzes: values.copyLiveQuizzes,
            duplicatePracticeQuizzes: values.copyPracticeQuizzes,
            duplicateMicrolearnings: values.copyMicroLearnings,
            duplicateGroupActivities: values.copyGroupActivities,
          },
        })

        const job = result.data?.startCourseDuplication

        if (job) {
          upsertJob(job)
          addJobId(job.id)
          return true
        }

        onError('access')
      } catch (error) {
        onError(getCourseDuplicationErrorType(error))
        console.error(error)
      }

      return false
    },
    [activeJobs, addJobId, startCourseDuplicationMutation, upsertJob]
  )

  const value = useMemo(
    () => ({
      isSourceCourseDuplicating,
      startCourseDuplication,
    }),
    [isSourceCourseDuplicating, startCourseDuplication]
  )

  return (
    <CourseDuplicationStatusContext.Provider value={value}>
      {children}
      <CourseDuplicationStatusDropdown jobs={activeJobs} />
    </CourseDuplicationStatusContext.Provider>
  )
}

export function useCourseDuplicationStatus() {
  const context = useContext(CourseDuplicationStatusContext)

  if (!context) {
    throw new Error(
      'useCourseDuplicationStatus must be used within CourseDuplicationProvider'
    )
  }

  return context
}
