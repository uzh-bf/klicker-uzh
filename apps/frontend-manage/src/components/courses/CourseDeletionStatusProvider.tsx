import { useApolloClient, useLazyQuery, useMutation } from '@apollo/client'
import {
  CourseDeletionJobStatus,
  type CourseDeletionStatus as CourseDeletionStatusData,
  GetCourseDeletionStatusesDocument,
  type GetCourseDeletionStatusesQuery,
  GetUserActivitiesCoursesDocument,
  GetUserActivitiesDocument,
  GetUserCoursesDocument,
  StartCourseDeletionDocument,
} from '@klicker-uzh/graphql/dist/ops'
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
  'courseId' | 'createdAt' | 'id' | 'isQueued' | 'status'
>

type CourseDeletionStatusResponse =
  GetCourseDeletionStatusesQuery['courseDeletionStatuses']

interface StartCourseDeletionArgs {
  courseId: string
  deleteDraftActivities: boolean
}

type CourseDeletionTarget = StartCourseDeletionArgs

interface CourseDeletionStatusContextValue {
  isCourseDeletionStateInitialized: boolean
  isCourseDeletionActive: (courseId: string) => boolean
  isDraftActivityDeletionActive: (courseId: string) => boolean
  startCourseDeletion: (args: StartCourseDeletionArgs) => Promise<boolean>
}

const CourseDeletionStatusContext =
  createContext<CourseDeletionStatusContextValue | null>(null)

const COURSE_DELETION_LEGACY_STORAGE_KEY = 'course-deletion-job-ids'
const COURSE_DELETION_STORAGE_KEY_PREFIX = 'course-deletion-job:'
const COURSE_DELETION_POLL_INTERVAL = 5000
const COURSE_DELETION_STATUS_BATCH_SIZE = 50
const COURSE_DELETION_REFETCH_QUERIES = [
  GetUserCoursesDocument,
  GetUserActivitiesCoursesDocument,
  GetUserActivitiesDocument,
]

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
    const jobIds = new Set<string>()
    for (let index = 0; index < window.localStorage.length; index++) {
      const key = window.localStorage.key(index)
      if (key?.startsWith(COURSE_DELETION_STORAGE_KEY_PREFIX)) {
        jobIds.add(key.slice(COURSE_DELETION_STORAGE_KEY_PREFIX.length))
      }
    }

    const storedValue = window.localStorage.getItem(
      COURSE_DELETION_LEGACY_STORAGE_KEY
    )
    let legacyJobIds: string[] = []
    if (storedValue) {
      try {
        const parsedValue = JSON.parse(storedValue)
        legacyJobIds = Array.isArray(parsedValue)
          ? parsedValue.filter(
              (value): value is string => typeof value === 'string'
            )
          : []
      } catch (error) {
        console.error(
          'Failed to migrate legacy course deletion jobs from storage',
          error
        )
      }
    }

    for (const jobId of legacyJobIds) {
      jobIds.add(jobId)
      window.localStorage.setItem(
        `${COURSE_DELETION_STORAGE_KEY_PREFIX}${jobId}`,
        '1'
      )
    }
    if (storedValue) {
      window.localStorage.removeItem(COURSE_DELETION_LEGACY_STORAGE_KEY)
    }

    return [...jobIds]
  } catch (error) {
    console.error('Failed to read course deletion jobs from storage', error)
    return []
  }
}

function readStoredCourseDeletionTargets() {
  if (typeof window === 'undefined') {
    return {} as Record<string, CourseDeletionTarget>
  }

  const targetsByJobId: Record<string, CourseDeletionTarget> = {}
  try {
    for (let index = 0; index < window.localStorage.length; index++) {
      const key = window.localStorage.key(index)
      if (!key?.startsWith(COURSE_DELETION_STORAGE_KEY_PREFIX)) continue

      const storedTarget = window.localStorage.getItem(key)
      if (!storedTarget || storedTarget === '1') continue

      let target: CourseDeletionTarget | null = null
      try {
        const parsedTarget = JSON.parse(storedTarget) as unknown
        if (
          typeof parsedTarget === 'object' &&
          parsedTarget !== null &&
          'courseId' in parsedTarget &&
          typeof parsedTarget.courseId === 'string' &&
          'deleteDraftActivities' in parsedTarget &&
          typeof parsedTarget.deleteDraftActivities === 'boolean'
        ) {
          target = {
            courseId: parsedTarget.courseId,
            deleteDraftActivities: parsedTarget.deleteDraftActivities,
          }
        }
      } catch {
        // Values from the previous storage format contain only the course ID.
        target = { courseId: storedTarget, deleteDraftActivities: false }
      }

      if (target) {
        targetsByJobId[key.slice(COURSE_DELETION_STORAGE_KEY_PREFIX.length)] =
          target
      }
    }
  } catch (error) {
    console.error('Failed to read persisted course deletion targets', error)
  }
  return targetsByJobId
}

function writeStoredCourseDeletionTarget(
  jobId: string,
  target: CourseDeletionTarget
) {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(
      `${COURSE_DELETION_STORAGE_KEY_PREFIX}${jobId}`,
      JSON.stringify(target)
    )
  } catch (error) {
    console.error('Failed to persist course deletion jobs', error)
  }
}

function removeStoredCourseDeletionJobId(jobId: string) {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.removeItem(
      `${COURSE_DELETION_STORAGE_KEY_PREFIX}${jobId}`
    )
  } catch (error) {
    console.error('Failed to remove persisted course deletion job', error)
  }
}

export function CourseDeletionProvider({
  children,
}: Readonly<{ children: ReactNode }>) {
  const client = useApolloClient()
  const [startCourseDeletionMutation] = useMutation(StartCourseDeletionDocument)
  const [jobIds, setJobIds] = useState<string[]>([])
  const [jobsById, setJobsById] = useState<Record<string, CourseDeletionJob>>(
    {}
  )
  const [targetsByJobId, setTargetsByJobId] = useState<
    Record<string, CourseDeletionTarget>
  >({})
  const [storageInitialized, setStorageInitialized] = useState(false)
  const inFlightCourseIdsRef = useRef(new Set<string>())
  const jobIdsRef = useRef<string[]>([])
  const targetsByJobIdRef = useRef<Record<string, CourseDeletionTarget>>({})

  useEffect(() => {
    const storedJobIds = readStoredCourseDeletionJobIds()
    const storedTargets = readStoredCourseDeletionTargets()
    jobIdsRef.current = storedJobIds
    targetsByJobIdRef.current = storedTargets
    setJobIds(storedJobIds)
    setTargetsByJobId(storedTargets)
    setStorageInitialized(true)
  }, [])

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (
        event.key !== COURSE_DELETION_LEGACY_STORAGE_KEY &&
        !event.key?.startsWith(COURSE_DELETION_STORAGE_KEY_PREFIX)
      ) {
        return
      }
      const storedJobIds = readStoredCourseDeletionJobIds()
      const storedTargets = readStoredCourseDeletionTargets()
      const storedJobIdSet = new Set(storedJobIds)
      jobIdsRef.current = storedJobIds
      targetsByJobIdRef.current = storedTargets
      setJobIds(storedJobIds)
      setTargetsByJobId(storedTargets)
      setJobsById((currentJobs) =>
        Object.fromEntries(
          Object.entries(currentJobs).filter(([jobId]) =>
            storedJobIdSet.has(jobId)
          )
        )
      )
    }

    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  const addJobId = useCallback(
    (jobId: string, target: CourseDeletionTarget) => {
      writeStoredCourseDeletionTarget(jobId, target)
      const storedJobIds = readStoredCourseDeletionJobIds()
      const nextJobIds = [
        ...new Set([...jobIdsRef.current, ...storedJobIds, jobId]),
      ]

      jobIdsRef.current = nextJobIds
      setJobIds(nextJobIds)
      targetsByJobIdRef.current = {
        ...targetsByJobIdRef.current,
        [jobId]: target,
      }
      setTargetsByJobId(targetsByJobIdRef.current)
    },
    []
  )

  const removeJobId = useCallback((jobId: string) => {
    removeStoredCourseDeletionJobId(jobId)
    const storedJobIds = readStoredCourseDeletionJobIds()
    const nextJobIds = storedJobIds.filter((id) => id !== jobId)
    jobIdsRef.current = nextJobIds
    setJobIds(nextJobIds)
    const { [jobId]: _removedTarget, ...nextTargets } =
      targetsByJobIdRef.current
    targetsByJobIdRef.current = nextTargets
    setTargetsByJobId(nextTargets)
    setJobsById((currentJobs) => {
      const { [jobId]: _removedJob, ...nextJobs } = currentJobs
      return nextJobs
    })
  }, [])

  const upsertJob = useCallback(
    (job: CourseDeletionJob, target?: CourseDeletionTarget) => {
      const nextTarget = target ??
        targetsByJobIdRef.current[job.id] ?? {
          courseId: job.courseId,
          deleteDraftActivities: false,
        }
      writeStoredCourseDeletionTarget(job.id, nextTarget)
      targetsByJobIdRef.current = {
        ...targetsByJobIdRef.current,
        [job.id]: nextTarget,
      }
      setTargetsByJobId(targetsByJobIdRef.current)
      setJobsById((currentJobs) => ({
        ...currentJobs,
        [job.id]: job,
      }))
    },
    []
  )

  const [fetchStatuses] = useLazyQuery(GetCourseDeletionStatusesDocument, {
    fetchPolicy: 'network-only',
  })

  const handleStatusResponse = useCallback(
    (statuses: CourseDeletionStatusResponse, requestedJobIds: string[]) => {
      const requestedJobIdSet = new Set(requestedJobIds)
      const returnedJobIds = new Set(statuses.map((job) => job.id))
      const currentJobIdSet = new Set(jobIdsRef.current)
      let shouldRefetchDeletionTargets = false

      for (const jobId of requestedJobIds) {
        if (currentJobIdSet.has(jobId) && !returnedJobIds.has(jobId)) {
          removeJobId(jobId)
          shouldRefetchDeletionTargets = true
        }
      }

      for (const job of statuses) {
        if (!requestedJobIdSet.has(job.id) || !currentJobIdSet.has(job.id)) {
          continue
        }

        if (isActiveCourseDeletionStatus(job.status)) {
          upsertJob(job)
          continue
        }

        if (!isTerminalCourseDeletionStatus(job.status)) continue
        removeJobId(job.id)
        shouldRefetchDeletionTargets = true
      }

      if (shouldRefetchDeletionTargets) {
        void client
          .refetchQueries({ include: COURSE_DELETION_REFETCH_QUERIES })
          .catch((error) =>
            console.error(
              'Failed to refetch courses and activities after deletion',
              error
            )
          )
      }
    },
    [client, removeJobId, upsertJob]
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
          if (result.errors) {
            if (!cancelled) {
              console.error(
                'Failed to poll course deletion status',
                result.errors
              )
            }
            continue
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
      Object.values(targetsByJobId).some(
        (target) => target.courseId === courseId
      ) ||
      activeJobs.some((job) => job.courseId === courseId),
    [activeJobs, targetsByJobId]
  )
  const isDraftActivityDeletionActive = useCallback(
    (courseId: string) =>
      Object.values(targetsByJobId).some(
        (target) => target.courseId === courseId && target.deleteDraftActivities
      ),
    [targetsByJobId]
  )

  const startCourseDeletion = useCallback(
    async ({ courseId, deleteDraftActivities }: StartCourseDeletionArgs) => {
      const existingJob = activeJobs.find((job) => job.courseId === courseId)
      if (inFlightCourseIdsRef.current.has(courseId) || existingJob?.isQueued) {
        return false
      }

      inFlightCourseIdsRef.current.add(courseId)

      try {
        const result = await startCourseDeletionMutation({
          variables: { id: courseId, deleteDraftActivities },
        })
        const job = result.data?.startCourseDeletion

        if (job?.isQueued) {
          const target = { courseId: job.courseId, deleteDraftActivities }
          upsertJob(job, target)
          addJobId(job.id, target)
          void client
            .refetchQueries({ include: COURSE_DELETION_REFETCH_QUERIES })
            .catch((error) =>
              console.error(
                'Failed to refetch courses and activities after starting deletion',
                error
              )
            )
          return true
        }
      } catch (error) {
        console.error('Failed to start course deletion', error)
      } finally {
        inFlightCourseIdsRef.current.delete(courseId)
      }

      return false
    },
    [activeJobs, addJobId, client, startCourseDeletionMutation, upsertJob]
  )

  const value = useMemo(
    () => ({
      isCourseDeletionStateInitialized: storageInitialized,
      isCourseDeletionActive,
      isDraftActivityDeletionActive,
      startCourseDeletion,
    }),
    [
      isCourseDeletionActive,
      isDraftActivityDeletionActive,
      startCourseDeletion,
      storageInitialized,
    ]
  )

  return (
    <CourseDeletionStatusContext.Provider value={value}>
      {children}
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
