import { IconDefinition } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import Link from 'next/link'

interface Props {
  title: string
  subtitle?: string
  href: string
  icon?: IconDefinition
  data: {
    cy?: string
    test?: string
  }
}

function SupportEntry({ title, subtitle, href, icon, data }: Props) {
  return (
    <Link passHref legacyBehavior href={href}>
      <a
        rel="noopener noreferrer"
        target="_blank"
        data-cy={data?.cy}
        data-test={data?.test}
        className="flex w-full flex-row items-center gap-4 rounded-lg border border-solid px-3 py-1 text-black hover:cursor-pointer hover:bg-gray-200"
      >
        {icon && (
          <div className="flex w-6 items-center justify-center">
            <FontAwesomeIcon icon={icon} size="lg" />
          </div>
        )}
        <div>
          <div className="-mb-0.5 text-lg font-bold">{title}</div>
          {subtitle && <div className="font-normal">{subtitle}</div>}
        </div>
      </a>
    </Link>
  )
}

export default SupportEntry
