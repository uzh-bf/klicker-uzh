import { CalendarDays, Link2 } from 'lucide-react'
import { twMerge } from 'tailwind-merge'
import type {
  IngestionRunSummary,
  LinkedConsumer,
  ReindexSchedule,
} from '../types.js'
import { getStatusDotClassName } from '../utils.js'

interface ActivityPanelsProps {
  linkedConsumers?: LinkedConsumer[]
  reindexSchedule?: ReindexSchedule
  ingestionRuns?: IngestionRunSummary[]
  className?: string
}

export function ActivityPanels({
  linkedConsumers,
  reindexSchedule,
  ingestionRuns,
  className,
}: ActivityPanelsProps) {
  return (
    <div className={twMerge('space-y-5', className)}>
      {linkedConsumers && linkedConsumers.length > 0 && (
        <section>
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Linked chatbots
          </h3>
          <div className="mt-2 space-y-2">
            {linkedConsumers.map((consumer) => (
              <a
                key={consumer.id}
                href={consumer.href}
                className="flex items-center gap-3 rounded-md border border-slate-200 bg-white p-3 text-sm no-underline hover:bg-slate-50"
              >
                <span className="bg-primary-100 flex size-8 shrink-0 items-center justify-center rounded-md text-xs font-bold text-white">
                  {consumer.avatarLabel ?? consumer.name.slice(0, 2)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold text-slate-950">
                    {consumer.name}
                  </span>
                  {consumer.description && (
                    <span className="block truncate text-xs text-slate-500">
                      {consumer.description}
                    </span>
                  )}
                </span>
                <Link2 className="size-4 text-slate-400" />
              </a>
            ))}
          </div>
        </section>
      )}

      {reindexSchedule && (
        <section>
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Reindex schedule
          </h3>
          <div className="mt-2 rounded-md border border-slate-200 bg-white p-3 text-sm">
            <div className="flex items-center gap-2 font-bold text-slate-950">
              <CalendarDays className="text-primary-100 size-4" />
              {reindexSchedule.label}
            </div>
            {reindexSchedule.nextRunLabel && (
              <p className="mt-2 text-xs text-slate-600">
                {reindexSchedule.nextRunLabel}
              </p>
            )}
            {reindexSchedule.note && (
              <p className="mt-1 text-xs text-slate-500">
                {reindexSchedule.note}
              </p>
            )}
          </div>
        </section>
      )}

      {ingestionRuns && ingestionRuns.length > 0 && (
        <section>
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Recent crawls
          </h3>
          <div className="mt-2 rounded-md border border-slate-200 bg-white p-3">
            <div className="flex h-12 items-end gap-2">
              {ingestionRuns.map((run) => (
                <div
                  key={run.id}
                  className="flex min-w-0 flex-1 flex-col items-center gap-1"
                >
                  <div
                    title={run.label}
                    className={twMerge(
                      'w-full rounded-t-sm',
                      getStatusDotClassName(run.status)
                    )}
                    style={{ height: `${Math.max(run.value ?? 8, 8)}%` }}
                  />
                  <span className="truncate text-[10px] text-slate-500">
                    {run.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
