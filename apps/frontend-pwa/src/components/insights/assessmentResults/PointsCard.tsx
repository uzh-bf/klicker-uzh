import { twMerge } from 'tailwind-merge'

function PointsCard({
  label,
  value,
  meta,
  variant = 'default',
  extraContent,
}: {
  label: string
  value: string
  meta: string
  variant?: 'default' | 'summary'
  extraContent?: string[]
}) {
  return (
    <div
      className={twMerge(
        variant === 'summary'
          ? 'rounded border border-emerald-200 bg-white/70 p-3 shadow-sm'
          : 'rounded border border-slate-100 bg-slate-50 p-3'
      )}
    >
      <div
        className={twMerge(
          variant === 'summary'
            ? 'text-xs font-semibold uppercase tracking-wide text-emerald-700'
            : 'text-xs font-semibold uppercase tracking-wide text-slate-500'
        )}
      >
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold text-slate-900">{value}</div>
      <div
        className={twMerge(
          variant === 'summary'
            ? 'mt-1 text-xs text-emerald-700'
            : 'mt-1 text-xs text-slate-500'
        )}
      >
        {meta}
      </div>
      {extraContent?.map((content) => (
        <div
          key={`${label}-${content}`}
          className={twMerge(
            variant === 'summary'
              ? 'mt-0.5 text-xs text-emerald-700'
              : 'mt-0.5 text-xs text-slate-500'
          )}
        >
          {content}
        </div>
      ))}
    </div>
  )
}

export default PointsCard
