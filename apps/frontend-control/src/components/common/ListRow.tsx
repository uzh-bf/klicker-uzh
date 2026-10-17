import { faChevronRight } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import Link from 'next/link'
import { twMerge } from 'tailwind-merge'

interface BaseRowProps {
  title: string
  meta?: React.ReactNode
  dimmed?: boolean
  dataCy?: string
}

type ListRowProps = BaseRowProps &
  (
    | {
        // navigation row: the whole row is a link and shows a chevron
        href: string
        onClick?: never
        actions?: never
      }
    | {
        // static row with optional action buttons
        href?: never
        onClick?: never
        actions?: React.ReactNode
      }
    | {
        // clickable row: the click is a convenience, so the actions are
        // required as the keyboard-accessible path
        href?: never
        onClick: () => void
        actions: React.ReactNode
      }
  )

const rowClass =
  'flex min-h-[64px] items-center gap-3 border-b border-ctrl-hair bg-white px-4 py-3.5 last:border-b-0'

function RowText({ title, meta }: Pick<BaseRowProps, 'title' | 'meta'>) {
  return (
    <div className="min-w-0 flex-1">
      <div className="text-ctrl-ink truncate text-base font-semibold">
        {title}
      </div>
      {meta && (
        <div className="text-ctrl-muted flex flex-wrap items-center gap-1.5 text-sm">
          {meta}
        </div>
      )}
    </div>
  )
}

function ListRow({
  title,
  meta,
  dimmed,
  href,
  onClick,
  actions,
  dataCy,
}: ListRowProps) {
  if (href) {
    return (
      <Link
        href={href}
        data-cy={dataCy}
        className={twMerge(
          rowClass,
          'hover:bg-ctrl-bg',
          dimmed && 'opacity-55'
        )}
      >
        <RowText title={title} meta={meta} />
        <FontAwesomeIcon
          icon={faChevronRight}
          className="text-ctrl-faint h-3.5 w-3.5"
        />
      </Link>
    )
  }

  return (
    // the row click is a convenience; the action buttons are the accessible path
    // biome-ignore lint/a11y/useKeyWithClickEvents: actions provide keyboard access
    // biome-ignore lint/a11y/noStaticElementInteractions: actions provide keyboard access
    <div
      data-cy={dataCy}
      onClick={(e) => {
        // ignore clicks that originate from the row's own action buttons
        if ((e.target as HTMLElement).closest('[data-row-actions]')) return
        onClick?.()
      }}
      className={twMerge(
        rowClass,
        onClick && 'hover:bg-ctrl-bg cursor-pointer',
        dimmed && 'opacity-55'
      )}
    >
      <RowText title={title} meta={meta} />
      {actions && (
        <div data-row-actions className="flex shrink-0 items-center gap-2">
          {actions}
        </div>
      )}
    </div>
  )
}

export default ListRow
