import { useQuery } from '@apollo/client'
import {
  faChevronUp,
  faWandMagicSparkles,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  ElementGenerationBuildDocument,
  ElementGenerationBuildStatus,
  GetKbKnowledgeGraphConfigDocument,
  KbGraphBuildStatus,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  toast,
} from '@uzh-bf/design-system'
import { useRouter } from 'next/router'
import { useTranslations } from 'next-intl'
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

export const GENERATION_STARTED_EVENT = 'klicker:generation-started'

type GraphGenerationJob = {
  kind: 'graph'
  id: string
  kbId: string
  label: string
  startedAt: number
}

type ElementGenerationJob = {
  kind: 'element'
  id: string
  label: string
  startedAt: number
}

export type GenerationJob = GraphGenerationJob | ElementGenerationJob

type GenerationJobProgress = {
  label: string
  status: string
}

const STORAGE_KEY = 'klicker-background-generation-jobs-v1'
const POLL_INTERVAL_MS = 5000
const UNMATCHED_GRAPH_JOB_TIMEOUT_MS = 120_000
const MAX_PERSISTED_JOB_AGE_MS = 24 * 60 * 60 * 1000
const TERMINAL_QUERY_ERROR_CODES = new Set([
  'AI_BETA_ACCESS_REQUIRED',
  'FORBIDDEN',
  'UNAUTHENTICATED',
])

function isGenerationJob(value: unknown): value is GenerationJob {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<GenerationJob>
  if (
    (candidate.kind !== 'graph' && candidate.kind !== 'element') ||
    typeof candidate.id !== 'string' ||
    typeof candidate.label !== 'string' ||
    typeof candidate.startedAt !== 'number' ||
    !Number.isFinite(candidate.startedAt)
  ) {
    return false
  }
  return candidate.kind !== 'graph' || typeof candidate.kbId === 'string'
}

function readJobs(): GenerationJob[] {
  try {
    const now = Date.now()
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    return Array.isArray(value)
      ? value.filter(
          (job): job is GenerationJob =>
            isGenerationJob(job) &&
            job.startedAt <= now &&
            now - job.startedAt <= MAX_PERSISTED_JOB_AGE_MS
        )
      : []
  } catch {
    return []
  }
}

function isTerminalGenerationQueryError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false

  const graphQLErrors = Reflect.get(error, 'graphQLErrors')
  const errors = Array.isArray(graphQLErrors) ? graphQLErrors : [error]

  return errors.some((graphQLError) => {
    if (typeof graphQLError !== 'object' || graphQLError === null) return false

    const extensions = Reflect.get(graphQLError, 'extensions')
    const code =
      typeof extensions === 'object' && extensions !== null
        ? Reflect.get(extensions, 'code')
        : undefined
    if (
      typeof code === 'string' &&
      (TERMINAL_QUERY_ERROR_CODES.has(code) || code.endsWith('_NOT_FOUND'))
    ) {
      return true
    }

    const message = Reflect.get(graphQLError, 'message')
    return (
      typeof message === 'string' &&
      (message === 'Unauthorized' || /not found/i.test(message))
    )
  })
}

function jobKey(job: GenerationJob): string {
  return `${job.kind}:${job.id}`
}

function GraphJobTracker({
  job,
  onProgress,
  onTerminal,
}: Readonly<{
  job: GraphGenerationJob
  onProgress: (job: GenerationJob, progress: GenerationJobProgress) => void
  onTerminal: (job: GenerationJob, succeeded: boolean) => void
}>) {
  const t = useTranslations('manage.generationStatus')
  const { data, error, loading } = useQuery(GetKbKnowledgeGraphConfigDocument, {
    variables: { kbId: job.kbId },
    fetchPolicy: 'network-only',
    pollInterval: POLL_INTERVAL_MS,
  })
  const config = data?.getKbKnowledgeGraphConfig
  const [checkedAt, setCheckedAt] = useState(0)

  useEffect(() => {
    setCheckedAt(Date.now())
    const interval = window.setInterval(
      () => setCheckedAt(Date.now()),
      POLL_INTERVAL_MS
    )
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    if (isTerminalGenerationQueryError(error)) {
      onTerminal(job, false)
      return
    }
    if (config?.publishedBuildId === job.id) {
      onTerminal(job, true)
      return
    }
    const matchesBuild =
      config?.buildId === job.id || config?.activeBuildId === job.id
    if (!config || !matchesBuild) {
      if (loading || error) return
      if (checkedAt - job.startedAt >= UNMATCHED_GRAPH_JOB_TIMEOUT_MS) {
        onTerminal(job, false)
      }
      return
    }
    if (config.status === KbGraphBuildStatus.Succeeded) {
      onTerminal(job, true)
      return
    }
    if (
      config.status === KbGraphBuildStatus.Failed ||
      config.status === KbGraphBuildStatus.Superseded
    ) {
      onTerminal(job, false)
      return
    }
    onProgress(job, {
      label: job.label,
      status:
        config.status === KbGraphBuildStatus.Processing
          ? t('graphProcessing')
          : t('graphQueued'),
    })
  }, [checkedAt, config, error, job, loading, onProgress, onTerminal, t])

  return null
}

function ElementJobTracker({
  job,
  onProgress,
  onTerminal,
}: Readonly<{
  job: ElementGenerationJob
  onProgress: (job: GenerationJob, progress: GenerationJobProgress) => void
  onTerminal: (job: GenerationJob, succeeded: boolean) => void
}>) {
  const t = useTranslations('manage.generationStatus')
  const query = useQuery(ElementGenerationBuildDocument, {
    variables: { id: job.id },
    fetchPolicy: 'network-only',
    pollInterval: POLL_INTERVAL_MS,
  })
  const build = query.data?.elementGenerationBuild

  useEffect(() => {
    if (isTerminalGenerationQueryError(query.error)) {
      onTerminal(job, false)
      return
    }
    if (!build) return
    if (
      build.status === ElementGenerationBuildStatus.Completed ||
      build.status === ElementGenerationBuildStatus.Incomplete ||
      build.status === ElementGenerationBuildStatus.WaitingForDesignReview ||
      build.status === ElementGenerationBuildStatus.WaitingForPlanReview ||
      build.status ===
        ElementGenerationBuildStatus.AwaitingIncompletePublication
    ) {
      onTerminal(job, true)
      return
    }
    if (
      build.status === ElementGenerationBuildStatus.Failed ||
      build.status === ElementGenerationBuildStatus.Rejected
    ) {
      onTerminal(job, false)
      return
    }
    onProgress(job, {
      label: job.label,
      status: t('elementProgress', {
        generated: build.generatedElementCount,
        requested: build.requestedElementCount,
      }),
    })
  }, [build, job, onProgress, onTerminal, query.error, t])

  return null
}

export function GenerationStatusProvider({
  children,
}: Readonly<{ children: ReactNode }>) {
  const t = useTranslations('manage.generationStatus')
  const router = useRouter()
  const [jobs, setJobs] = useState<GenerationJob[]>([])
  const [progressByKey, setProgressByKey] = useState<
    Record<string, GenerationJobProgress>
  >({})
  const [storageReady, setStorageReady] = useState(false)
  const handledRef = useRef(new Set<string>())

  useEffect(() => {
    setJobs(readJobs())
    setStorageReady(true)
  }, [])

  useEffect(() => {
    if (!storageReady) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs))
    } catch {
      // Keep in-memory generation tracking available when browser storage fails.
    }
  }, [jobs, storageReady])

  useEffect(() => {
    const onStarted = (event: Event) => {
      const job = (event as CustomEvent<unknown>).detail
      if (!isGenerationJob(job)) return
      handledRef.current.delete(jobKey(job))
      setJobs((current) =>
        current.some((candidate) => jobKey(candidate) === jobKey(job))
          ? current
          : [...current, job]
      )
    }
    window.addEventListener(GENERATION_STARTED_EVENT, onStarted)
    return () => window.removeEventListener(GENERATION_STARTED_EVENT, onStarted)
  }, [])

  const onProgress = useCallback(
    (job: GenerationJob, progress: GenerationJobProgress) => {
      const key = jobKey(job)
      setProgressByKey((current) => {
        const previous = current[key]
        return previous?.label === progress.label &&
          previous.status === progress.status
          ? current
          : { ...current, [key]: progress }
      })
    },
    []
  )

  const onTerminal = useCallback(
    (job: GenerationJob, succeeded: boolean) => {
      const key = jobKey(job)
      if (handledRef.current.has(key)) return
      handledRef.current.add(key)
      setJobs((current) =>
        current.filter((candidate) => jobKey(candidate) !== key)
      )
      setProgressByKey((current) => {
        const { [key]: _removed, ...remaining } = current
        return remaining
      })

      const href =
        job.kind === 'graph'
          ? `/resources/knowledgeBases/${job.kbId}#knowledge-graph`
          : `/elements/generate?buildId=${job.id}`
      toast({
        type: succeeded ? 'success' : 'error',
        message: succeeded ? t('succeeded', { label: job.label }) : t('failed'),
        options: {
          duration: succeeded ? 30_000 : 8000,
          ...(succeeded
            ? {
                action: {
                  label: t('open'),
                  onClick: () => void router.push(href),
                },
              }
            : {}),
        },
      })
    },
    [router, t]
  )

  const rows = useMemo(
    () =>
      jobs.map((job) => ({
        job,
        progress: progressByKey[jobKey(job)] ?? {
          label: job.label,
          status: t('starting'),
        },
      })),
    [jobs, progressByKey, t]
  )

  return (
    <>
      {children}
      {jobs.map((job) =>
        job.kind === 'graph' ? (
          <GraphJobTracker
            key={jobKey(job)}
            job={job}
            onProgress={onProgress}
            onTerminal={onTerminal}
          />
        ) : (
          <ElementJobTracker
            key={jobKey(job)}
            job={job}
            onProgress={onProgress}
            onTerminal={onTerminal}
          />
        )
      )}
      {rows.length > 0 ? (
        <div
          className="fixed right-4 bottom-20 z-30 max-w-[calc(100vw-2rem)]"
          data-cy="generation-status"
          role="status"
        >
          <Popover>
            <PopoverTrigger className="focus:ring-primary-80 flex h-12 items-center gap-3 rounded-md border border-gray-200 bg-white px-4 text-left text-sm shadow-lg transition hover:border-primary-80 focus:outline-none focus:ring-2">
              <Loader basic />
              <span className="max-w-[14rem] truncate font-bold text-gray-900">
                {t('title')}
              </span>
              <span className="rounded-full bg-primary-100 px-2 py-0.5 text-xs font-bold text-white">
                {rows.length}
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
                  <FontAwesomeIcon
                    icon={faWandMagicSparkles}
                    className="h-4 w-4"
                  />
                  {t('title')}
                </div>
                <p className="mt-1 text-sm text-gray-600">{t('description')}</p>
              </div>
              <ul className="max-h-72 overflow-y-auto">
                {rows.map(({ job, progress }) => (
                  <li
                    className="flex items-start gap-3 border-t border-gray-100 px-4 py-3 first:border-t-0"
                    key={jobKey(job)}
                  >
                    <Loader basic />
                    <div className="min-w-0">
                      <div className="truncate font-bold text-gray-900">
                        {progress.label}
                      </div>
                      <div className="truncate text-sm text-gray-600">
                        {progress.status}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </PopoverContent>
          </Popover>
        </div>
      ) : null}
    </>
  )
}
