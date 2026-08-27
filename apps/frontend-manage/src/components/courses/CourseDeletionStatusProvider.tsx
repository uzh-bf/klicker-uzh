import { useApolloClient, useLazyQuery, useMutation } from '@apollo/client'
import { faTrashCan } from '@fortawesome/free-regular-svg-icons'
import { faChevronUp } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  CourseDeletionJobStatus,
  type CourseDeletionStatus as CourseDeletionStatusData,
  GetCourseDeletionStatusesDocument,
  type GetCourseDeletionStatusesQuery,
  GetUserCoursesDocument,
  StartCourseDeletionDocument,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  toast,
} from '@uzh-bf/design-system'
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

type CourseDeletionJob = Pick<
  CourseDeletionStatusData,
  | 'courseId'
  | 'courseName'
  | 'createdAt'
  | 'errorType'
  | 'id'
  | 'status'
  | 'updatedAt'
>

type CourseDeletionStatusResponse =
  GetCourseDeletionStatusesQuery['courseDeletionStatuses']

interface StartCourseDeletionArgs {
  courseId: string
  deleteDraftActivities: boolean
}

interface CourseDeletionStatusContextValue {
  isCourseDeletionActive: (courseId: string) => boolean
  startCourseDeletion: (args: StartCourseDeletionArgs) => Promise<boolean>
}

const CourseDeletionStatusContext =
  createContext<CourseDeletionStatusContextValue | null>(null)

const COURSE_DELETION_STORAGE_KEY = 'course-deletion-job-ids'
const COURSE_DELETION_POLL_INTERVAL = 5000
const COURSE_DELETION_STATUS_BATCH_SIZE = 50
const COURSE_DELETION_HANDLED_TERMINAL_JOB_LIMIT = 100

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

function isActiveCourseDeletionStatus(status: CourseDeletionJob['status']) {
  return (
    status === CourseDeletionJobStatus.Pending ||
    status === CourseDeletionJobStatus.Running
  )
}

function isTerminalCourseDeletionStatus(status: CourseDeletionJob['status']) {
  return (
    status === CourseDeletionJobStatus.Completed ||
    status === CourseDeletionJobStatus.Failed
  )
}

function readStoredCourseDeletionJobIds() {
  if (typeof window === 'undefined') return []

  try {
    const storedValue = window.localStorage.getItem(COURSE_DELETION_STORAGE_KEY)
    const parsedValue = storedValue ? JSON.parse(storedValue) : []

    return Array.isArray(parsedValue)
      ? parsedValue.filter(
          (value): value is string => typeof value === 'string'
        )
      : []
  } catch (error) {
    console.error('Failed to read course deletion jobs from storage', error)
    return []
  }
}

function writeStoredCourseDeletionJobIds(jobIds: string[]) {
  if (typeof window === 'undefined') return

  try {
    if (jobIds.length === 0) {
      window.localStorage.removeItem(COURSE_DELETION_STORAGE_KEY)
    } else {
      window.localStorage.setItem(
        COURSE_DELETION_STORAGE_KEY,
        JSON.stringify(jobIds)
      )
    }
  } catch (error) {
    console.error('Failed to persist course deletion jobs', error)
  }
}

function CourseDeletionStatusDropdown({
  jobs,
}: Readonly<{ jobs: CourseDeletionJob[] }>) {
  const t = useTranslations()

  if (jobs.length === 0) return null

  return (
    <div
      className="fixed right-4 bottom-20 z-30 max-w-[calc(100vw-2rem)]"
      data-cy="course-deletion-loading"
      role="status"
    >
      <Popover>
        <PopoverTrigger
          className="flex h-12 items-center gap-3 rounded-md border border-gray-200 bg-white px-4 text-left text-sm shadow-lg transition hover:border-primary-80 focus:outline-none focus:ring-2 focus:ring-primary-80"
          data-cy="course-deletion-status-trigger"
        >
          <Loader basic data={{ cy: 'course-deletion-spinner' }} />
          <span className="max-w-[14rem] truncate font-bold text-gray-900">
            {t('manage.courseList.courseDeletionStatusTab')}
          </span>
          <span className="sr-only">
            {t('manage.courseList.courseDeletionStatusCount', {
              count: jobs.length,
            })}
          </span>
          <span
            aria-hidden="true"
            className="rounded-full bg-red-700 px-2 py-0.5 text-xs font-bold text-white"
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
              <FontAwesomeIcon icon={faTrashCan} className="h-4 w-4" />
              {t('manage.courseList.courseDeletionStatusTitle')}
            </div>
            <p className="mt-1 text-sm text-gray-600">
              {t('manage.courseList.courseDeletionStatusDescription')}
            </p>
          </div>
          <ul className="max-h-72 overflow-y-auto">
            {jobs.map((job) => (
              <li
                className="flex items-start gap-3 border-gray-100 border-t px-4 py-3 first:border-t-0"
                key={job.id}
              >
                <Loader basic data={{ cy: 'course-deletion-spinner' }} />
                <div className="min-w-0 truncate font-bold text-gray-900">
                  {job.courseName}
                </div>
              </li>
            ))}
          </ul>
        </PopoverContent>
      </Popover>
    </div>
  )
}

export function CourseDeletionProvider({
  children,
}: Readonly<{ children: ReactNode }>) {
  const t = useTranslations()
  const client = useApolloClient()
  const [startCourseDeletionMutation] = useMutation(StartCourseDeletionDocument)
  const [jobIds, setJobIds] = useState<string[]>([])
  const [jobsById, setJobsById] = useState<Record<string, CourseDeletionJob>>(
    {}
  )
  const [storageInitialized, setStorageInitialized] = useState(false)
  const handledTerminalJobIdsRef = useRef(new Set<string>())
  const inFlightCourseIdsRef = useRef(new Set<string>())
  const jobIdsRef = useRef<string[]>([])

  useEffect(() => {
    setJobIds(readStoredCourseDeletionJobIds())
    setStorageInitialized(true)
  }, [])

  useEffect(() => {
    if (!storageInitialized) return
    writeStoredCourseDeletionJobIds(jobIds)
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

  const upsertJob = useCallback((job: CourseDeletionJob) => {
    setJobsById((currentJobs) => ({
      ...currentJobs,
      [job.id]: job,
    }))
  }, [])

  const [fetchStatuses] = useLazyQuery(GetCourseDeletionStatusesDocument, {
    fetchPolicy: 'network-only',
  })

  const handleStatusResponse = useCallback(
    (statuses: CourseDeletionStatusResponse, requestedJobIds: string[]) => {
      const requestedJobIdSet = new Set(requestedJobIds)
      const returnedJobIds = new Set(statuses.map((job) => job.id))

      for (const jobId of requestedJobIds) {
        if (!returnedJobIds.has(jobId)) removeJobId(jobId)
      }

      for (const job of statuses) {
        if (!requestedJobIdSet.has(job.id)) continue

        if (isActiveCourseDeletionStatus(job.status)) {
          upsertJob(job)
          continue
        }

        if (!isTerminalCourseDeletionStatus(job.status)) continue
        if (handledTerminalJobIdsRef.current.has(job.id)) continue

        handledTerminalJobIdsRef.current.add(job.id)
        if (
          handledTerminalJobIdsRef.current.size >
          COURSE_DELETION_HANDLED_TERMINAL_JOB_LIMIT
        ) {
          const oldestJobId = handledTerminalJobIdsRef.current
            .values()
            .next().value
          if (oldestJobId) {
            handledTerminalJobIdsRef.current.delete(oldestJobId)
          }
        }
        removeJobId(job.id)

        void client
          .refetchQueries({ include: [GetUserCoursesDocument] })
          .catch((error) =>
            console.error('Failed to refetch courses after deletion', error)
          )

        if (job.status === CourseDeletionJobStatus.Completed) {
          toast({
            type: 'success',
            message: t('manage.courseList.courseDeletionSucceeded', {
              name: job.courseName,
            }),
            options: { duration: 6000 },
          })
        } else {
          toast({
            type: 'error',
            message:
              job.errorType === 'access'
                ? t('manage.courseList.courseDeletionAccessFailed')
                : t('manage.courseList.courseDeletionFailed'),
            options: { duration: 6000 },
          })
        }
      }
    },
    [client, removeJobId, t, upsertJob]
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
        for (
          let batchStart = 0;
          batchStart < requestedJobIds.length;
          batchStart += COURSE_DELETION_STATUS_BATCH_SIZE
        ) {
          if (cancelled) return

          const batchJobIds = requestedJobIds.slice(
            batchStart,
            batchStart + COURSE_DELETION_STATUS_BATCH_SIZE
          )
          const result = await fetchStatuses({
            variables: { ids: batchJobIds },
          })
          if (result.errors && !cancelled) {
            console.error(
              'Failed to poll course deletion status',
              result.errors
            )
          }

          const statuses = result.data?.courseDeletionStatuses
          if (!cancelled && statuses) {
            handleStatusResponse(statuses, batchJobIds)
          }
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to poll course deletion status', error)
        }
      } finally {
        if (!cancelled) {
          timeoutId = window.setTimeout(() => {
            void poll()
          }, COURSE_DELETION_POLL_INTERVAL)
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
        .filter((job) => isActiveCourseDeletionStatus(job.status))
        .sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        ),
    [jobsById]
  )

  const isCourseDeletionActive = useCallback(
    (courseId: string) =>
      inFlightCourseIdsRef.current.has(courseId) ||
      activeJobs.some((job) => job.courseId === courseId),
    [activeJobs]
  )

  const startCourseDeletion = useCallback(
    async ({ courseId, deleteDraftActivities }: StartCourseDeletionArgs) => {
      if (
        inFlightCourseIdsRef.current.has(courseId) ||
        activeJobs.some((job) => job.courseId === courseId)
      ) {
        toast({
          type: 'error',
          message: t('manage.courseList.courseDeletionInProgress'),
          options: { duration: 6000 },
        })
        return false
      }

      inFlightCourseIdsRef.current.add(courseId)

      try {
        const result = await startCourseDeletionMutation({
          variables: { id: courseId, deleteDraftActivities },
        })
        const job = result.data?.startCourseDeletion

        if (job) {
          upsertJob(job)
          addJobId(job.id)
          toast({
            type: 'success',
            message: t('manage.courseList.courseDeletionStarted', {
              name: job.courseName,
            }),
            options: { duration: 6000 },
          })
          return true
        }

        toast({
          type: 'error',
          message: t('manage.courseList.courseDeletionFailed'),
          options: { duration: 6000 },
        })
      } catch (error) {
        const code = getGraphQLErrorCode(error)
        toast({
          type: 'error',
          message:
            code === 'COURSE_DELETION_IN_PROGRESS'
              ? t('manage.courseList.courseDeletionInProgress')
              : t('manage.courseList.courseDeletionFailed'),
          options: { duration: 6000 },
        })
        console.error(error)
      } finally {
        inFlightCourseIdsRef.current.delete(courseId)
      }

      return false
    },
    [activeJobs, addJobId, startCourseDeletionMutation, t, upsertJob]
  )

  const value = useMemo(
    () => ({ isCourseDeletionActive, startCourseDeletion }),
    [isCourseDeletionActive, startCourseDeletion]
  )

  return (
    <CourseDeletionStatusContext.Provider value={value}>
      {children}
      <CourseDeletionStatusDropdown jobs={activeJobs} />
    </CourseDeletionStatusContext.Provider>
  )
}

export function useCourseDeletionStatus() {
  const context = useContext(CourseDeletionStatusContext)

  if (!context) {
    throw new Error(
      'useCourseDeletionStatus must be used within CourseDeletionProvider'
    )
  }

  return context
}
