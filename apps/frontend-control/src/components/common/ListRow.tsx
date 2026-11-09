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
        // actionable row: the primary button and trailing actions are siblings
        href?: never
        onClick: () => void
        actions: React.ReactNode
      }
  )

const rowClass =
  'flex min-h-[64px] items-center gap-3 border-b border-ctrl-hair bg-white px-4 py-3.5 last:border-b-0'

function RowText({ title, meta }: Pick<BaseRowProps, 'title' | 'meta'>) {
  return (
    <span className="block min-w-0 flex-1">
      <span className="text-ctrl-ink block truncate text-base font-semibold">
        {title}
      </span>
      {meta && (
        <span className="text-ctrl-muted flex flex-wrap items-center gap-1.5 text-sm">
          {meta}
        </span>
      )}
    </span>
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
    <div
      data-cy={dataCy}
      className={twMerge(
        rowClass,
        onClick && 'hover:bg-ctrl-bg',
        dimmed && 'opacity-55'
      )}
    >
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          className="focus-visible:ring-uzh-blue -my-3.5 -ml-4 min-h-[64px] min-w-0 flex-1 cursor-pointer py-3.5 pl-4 text-left focus-visible:ring-2 focus-visible:ring-inset focus-visible:outline-none"
        >
          <RowText title={title} meta={meta} />
        </button>
      ) : (
        <RowText title={title} meta={meta} />
      )}
      {actions && (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      )}
    </div>
  )
}

export default ListRow
