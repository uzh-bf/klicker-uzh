import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { faBell, faCircleCheck } from '@fortawesome/free-regular-svg-icons'
import {
  faClock,
  faCopy,
  faDiagramProject,
  faQuestion,
  faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { AsyncTaskKind, AsyncTaskStatus } from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { COURSE_DUPLICATION_ERROR_CODES } from '@klicker-uzh/types'
import { Popover, PopoverContent, PopoverTrigger } from '@uzh-bf/design-system'
import Link from 'next/link'
import { useFormatter, useTranslations } from 'next-intl'
import { useAsyncTasks } from './AsyncTaskProvider'
import {
  type AsyncTaskData,
  getManageCoursePath,
  isActiveTask,
} from './asyncTaskHelpers'

function getTaskIcon(kind: AsyncTaskKind): IconDefinition {
  switch (kind) {
    case AsyncTaskKind.CourseDuplication:
      return faCopy
    case AsyncTaskKind.KnowledgeGraphGeneration:
      return faDiagramProject
    case AsyncTaskKind.QuestionGeneration:
      return faQuestion
  }
}

function AsyncTaskStatusIcon({ task }: Readonly<{ task: AsyncTaskData }>) {
  let icon: IconDefinition
  let className: string

  switch (task.status) {
    case AsyncTaskStatus.Running:
      return <Loader basic data={{ cy: `async-task-spinner-${task.id}` }} />
    case AsyncTaskStatus.Queued:
      icon = faClock
      className = 'text-slate-500'
      break
    case AsyncTaskStatus.Succeeded:
      icon = faCircleCheck
      className = 'text-green-700'
      break
    case AsyncTaskStatus.Failed:
      icon = faTriangleExclamation
      className = 'text-red-700'
      break
  }

  return (
    <FontAwesomeIcon
      aria-hidden="true"
      className={`mt-0.5 h-4 w-4 shrink-0 ${className}`}
      icon={icon}
    />
  )
}

function AsyncTaskRow({ task }: Readonly<{ task: AsyncTaskData }>) {
  const t = useTranslations()
  const format = useFormatter()
  const taskName =
    task.kind === AsyncTaskKind.CourseDuplication
      ? (task.targetName ?? task.subjectName)
      : task.subjectName
  const taskKindLabels: Record<AsyncTaskKind, string> = {
    [AsyncTaskKind.CourseDuplication]: t(
      'manage.asyncTasks.kind.courseDuplication'
    ),
    [AsyncTaskKind.KnowledgeGraphGeneration]: t(
      'manage.asyncTasks.kind.knowledgeGraphGeneration'
    ),
    [AsyncTaskKind.QuestionGeneration]: t(
      'manage.asyncTasks.kind.questionGeneration'
    ),
  }
  const statusLabels: Record<AsyncTaskStatus, string> = {
    [AsyncTaskStatus.Queued]: t('manage.asyncTasks.status.queued'),
    [AsyncTaskStatus.Running]: t('manage.asyncTasks.status.running'),
    [AsyncTaskStatus.Succeeded]: t('manage.asyncTasks.status.succeeded'),
    [AsyncTaskStatus.Failed]: t('manage.asyncTasks.status.failed'),
  }
  const taskKindLabel = taskKindLabels[task.kind]
  const statusLabel = statusLabels[task.status]
  let failureLabel = t('manage.asyncTasks.failure.generic')
  if (task.errorCode === COURSE_DUPLICATION_ERROR_CODES.accessDenied) {
    failureLabel = t('manage.asyncTasks.failure.courseDuplicationAccess')
  } else if (task.errorCode === COURSE_DUPLICATION_ERROR_CODES.partialFailure) {
    failureLabel = t('manage.asyncTasks.failure.courseDuplicationPartial')
  }
  const statusTimestamp = isActiveTask(task)
    ? task.updatedAt
    : (task.finishedAt ?? task.updatedAt)

  return (
    <li
      className={`relative flex items-start gap-3 border-slate-100 border-t px-4 py-3 first:border-t-0 ${!task.readAt && !isActiveTask(task) ? 'bg-primary-20/30' : 'bg-white'}`}
      data-cy={`async-task-${task.id}`}
    >
      <AsyncTaskStatusIcon task={task} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
          <FontAwesomeIcon
            aria-hidden="true"
            className="h-3 w-3 shrink-0 text-slate-500"
            icon={getTaskIcon(task.kind)}
          />
          <span className="truncate">{taskKindLabel}</span>
        </div>
        <div className="truncate text-sm text-slate-700">{taskName}</div>
        {task.kind === AsyncTaskKind.CourseDuplication && task.targetName ? (
          <div className="truncate text-xs text-slate-500">
            {t('manage.asyncTasks.courseDuplicationSource', {
              source: task.subjectName,
            })}
          </div>
        ) : null}
        <div
          className={`mt-0.5 text-xs ${task.status === AsyncTaskStatus.Failed ? 'text-red-700' : 'text-slate-500'}`}
        >
          {task.status === AsyncTaskStatus.Failed
            ? failureLabel
            : t('manage.asyncTasks.statusAt', {
                status: statusLabel,
                time: format.dateTime(new Date(statusTimestamp), {
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                }),
              })}
        </div>
      </div>
      {task.status === AsyncTaskStatus.Succeeded &&
      task.kind === AsyncTaskKind.CourseDuplication &&
      task.resultId ? (
        <Link
          aria-label={t('manage.asyncTasks.openResultLabel', {
            name: taskName,
          })}
          className="my-auto shrink-0 text-primary-100 text-xs font-semibold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-80"
          data-cy={`async-task-open-${task.id}`}
          href={getManageCoursePath(task.resultId)}
        >
          {t('manage.asyncTasks.openResult')}
        </Link>
      ) : null}
      {!task.readAt && !isActiveTask(task) ? (
        <>
          <span
            aria-hidden="true"
            className="absolute top-2.5 right-2 h-1.5 w-1.5 rounded-full bg-primary-100"
          />
          <span className="sr-only">{t('manage.asyncTasks.unread')}</span>
        </>
      ) : null}
    </li>
  )
}

export default function AsyncTaskCenter() {
  const t = useTranslations()
  const {
    tasks,
    activeTasks,
    attentionCount,
    acknowledgeTerminalTasks,
    refetchTasks,
  } = useAsyncTasks()
  const recentTasks = tasks.filter((task) => !isActiveTask(task))
  const hasUnreadTerminalTasks = recentTasks.some((task) => !task.readAt)
  const displayCount = attentionCount > 99 ? '99+' : String(attentionCount)

  return (
    <Popover>
      <PopoverTrigger
        aria-label={t('manage.asyncTasks.triggerLabel', {
          count: attentionCount,
        })}
        className="relative flex h-10 w-10 items-center justify-center rounded-sm text-slate-700 transition hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-80"
        data-cy="async-task-center-trigger"
        onClick={() => void refetchTasks()}
      >
        <FontAwesomeIcon aria-hidden="true" className="h-4 w-4" icon={faBell} />
        {attentionCount > 0 ? (
          <span
            aria-hidden="true"
            className="absolute top-0.5 right-0 flex min-h-4 min-w-4 items-center justify-center rounded-full border-2 border-slate-100 bg-primary-100 px-0.5 text-[0.625rem] text-white leading-none"
          >
            {displayCount}
          </span>
        ) : null}
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="z-40 w-[min(24rem,calc(100vw-2rem))] overflow-hidden border-t-2 border-t-primary-100 p-0"
        side="bottom"
      >
        <div className="flex items-start justify-between gap-4 border-slate-100 border-b p-4">
          <div>
            <div className="font-semibold text-slate-900">
              {t('manage.asyncTasks.title')}
            </div>
            <div className="mt-0.5 text-slate-500 text-xs">
              {t('manage.asyncTasks.description')}
            </div>
          </div>
          {hasUnreadTerminalTasks ? (
            <button
              className="shrink-0 text-primary-100 text-xs font-semibold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-80"
              data-cy="async-task-mark-read"
              onClick={() => void acknowledgeTerminalTasks()}
              type="button"
            >
              {t('manage.asyncTasks.markCompletedRead')}
            </button>
          ) : null}
        </div>

        <div aria-live="polite" aria-relevant="additions text">
          {tasks.length === 0 ? (
            <div
              className="px-4 py-8 text-center text-slate-500 text-sm"
              data-cy="async-task-empty"
            >
              {t('manage.asyncTasks.empty')}
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              {activeTasks.length > 0 ? (
                <section aria-labelledby="async-task-active-heading">
                  <div
                    className="bg-slate-50 px-4 py-2 text-[0.6875rem] font-semibold text-slate-600 uppercase tracking-wide"
                    id="async-task-active-heading"
                  >
                    {t('manage.asyncTasks.inProgress', {
                      count: activeTasks.length,
                    })}
                  </div>
                  <ul>
                    {activeTasks.map((task) => (
                      <AsyncTaskRow key={task.id} task={task} />
                    ))}
                  </ul>
                </section>
              ) : null}
              {recentTasks.length > 0 ? (
                <section aria-labelledby="async-task-recent-heading">
                  <div
                    className="border-slate-100 border-t bg-slate-50 px-4 py-2 text-[0.6875rem] font-semibold text-slate-600 uppercase tracking-wide"
                    id="async-task-recent-heading"
                  >
                    {t('manage.asyncTasks.recent')}
                  </div>
                  <ul>
                    {recentTasks.map((task) => (
                      <AsyncTaskRow key={task.id} task={task} />
                    ))}
                  </ul>
                </section>
              ) : null}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
