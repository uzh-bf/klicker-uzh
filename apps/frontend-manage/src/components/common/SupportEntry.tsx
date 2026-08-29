import type { IconDefinition } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import Link from 'next/link'

interface Props {
  title: string
  subtitle?: string
  // An entry either leads somewhere or does something here; the in-app actions
  // render as a button so that keyboard and screen-reader users are not offered
  // a link that goes nowhere.
  href?: string
  onClick?: () => void
  icon?: IconDefinition
  data: {
    cy?: string
    test?: string
  }
}

const ENTRY_STYLE =
  'flex w-full flex-row items-center gap-4 rounded-lg border border-solid px-3 py-1 text-black hover:cursor-pointer hover:bg-gray-200'

function SupportEntry({ title, subtitle, href, onClick, icon, data }: Props) {
  const content = (
    <>
      {icon && (
        <div className="flex w-6 items-center justify-center">
          <FontAwesomeIcon icon={icon} size="lg" />
        </div>
      )}
      <div>
        <div className="-mb-0.5 text-lg font-bold">{title}</div>
        {subtitle && <div className="font-normal">{subtitle}</div>}
      </div>
    </>
  )

  if (!href) {
    return (
      <button
        type="button"
        onClick={onClick}
        data-cy={data?.cy}
        data-test={data?.test}
        className={`${ENTRY_STYLE} text-left`}
      >
        {content}
      </button>
    )
  }

  return (
    <Link passHref legacyBehavior href={href}>
      <a
        rel="noopener noreferrer"
        target="_blank"
        data-cy={data?.cy}
        data-test={data?.test}
        className={ENTRY_STYLE}
      >
        {content}
      </a>
    </Link>
  )
}

export default SupportEntry
