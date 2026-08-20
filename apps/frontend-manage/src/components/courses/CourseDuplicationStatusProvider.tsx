import { useMutation } from '@apollo/client'
import { faCopy } from '@fortawesome/free-regular-svg-icons'
import { faChevronUp } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  type Course,
  CreateCourseDocument,
  GetUserCoursesDocument,
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
  useMemo,
  useRef,
  useState,
} from 'react'
import type {
  CourseDuplicationErrorType,
  CourseDuplicationFormData,
} from './modals/CourseDuplicationModal'

type CourseDuplicationSourceCourse = Pick<
  Course,
  | 'id'
  | 'isGamificationEnabled'
  | 'maxGroupSize'
  | 'name'
  | 'preferredGroupSize'
>

interface CourseDuplicationJob {
  id: string
  sourceCourseId: string
  sourceCourseName: string
  targetCourseName: string
}

interface StartCourseDuplicationArgs {
  course: CourseDuplicationSourceCourse
  values: CourseDuplicationFormData
  onError: (errorType?: CourseDuplicationErrorType) => void
}

interface CourseDuplicationStatusContextValue {
  isSourceCourseDuplicating: (sourceCourseId: string) => boolean
  startCourseDuplication: (
    args: StartCourseDuplicationArgs
  ) => Promise<Course | null>
}

const CourseDuplicationStatusContext =
  createContext<CourseDuplicationStatusContextValue | null>(null)

const COURSE_DUPLICATION_PARTIAL_FAILURE_CODE =
  'COURSE_DUPLICATION_PARTIAL_FAILURE'

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

function getCourseDuplicationJobId(courseId: string) {
  return globalThis.crypto?.randomUUID?.() ?? `${courseId}-${Date.now()}`
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
  const [createCourse] = useMutation(CreateCourseDocument)
  const [activeJobs, setActiveJobs] = useState<CourseDuplicationJob[]>([])
  const activeJobsRef = useRef<CourseDuplicationJob[]>([])

  const addJob = useCallback((job: CourseDuplicationJob) => {
    const nextJobs = [...activeJobsRef.current, job]
    activeJobsRef.current = nextJobs
    setActiveJobs(nextJobs)
  }, [])

  const removeJob = useCallback((jobId: string) => {
    const nextJobs = activeJobsRef.current.filter((job) => job.id !== jobId)
    activeJobsRef.current = nextJobs
    setActiveJobs(nextJobs)
  }, [])

  const isSourceCourseDuplicating = useCallback(
    (sourceCourseId: string) =>
      activeJobs.some((job) => job.sourceCourseId === sourceCourseId),
    [activeJobs]
  )

  const startCourseDuplication = useCallback(
    async ({ course, values, onError }: StartCourseDuplicationArgs) => {
      if (
        activeJobsRef.current.some((job) => job.sourceCourseId === course.id)
      ) {
        onError('inProgress')
        return null
      }

      const job: CourseDuplicationJob = {
        id: getCourseDuplicationJobId(course.id),
        sourceCourseId: course.id,
        sourceCourseName: course.name,
        targetCourseName: values.name,
      }

      addJob(job)

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

        const result = await createCourse({
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
          update: (cache, { data }) => {
            if (!data?.createCourse) return

            cache.updateQuery({ query: GetUserCoursesDocument }, (qData) => {
              if (!qData?.userCourses) return qData

              return {
                userCourses: [...qData.userCourses, data.createCourse!],
              }
            })
          },
        })

        const duplicatedCourse = result.data?.createCourse
        const mutationError = result.errors?.[0]

        if (duplicatedCourse) {
          toast({
            type: 'success',
            message: t('manage.courseList.courseDuplicationSucceeded', {
              name: duplicatedCourse.name,
            }),
          })
          await router.push(`/courses/${duplicatedCourse.id}`)

          return duplicatedCourse
        }

        onError(
          mutationError
            ? getCourseDuplicationErrorType(mutationError)
            : 'access'
        )
      } catch (error) {
        onError(getCourseDuplicationErrorType(error))
        console.error(error)
      } finally {
        removeJob(job.id)
      }

      return null
    },
    [addJob, createCourse, removeJob, router, t]
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
