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
        className="flex flex-row items-center w-full gap-4 px-3 py-1 text-black border border-solid rounded-lg hover:bg-gray-200 hover:cursor-pointer"
      >
        {icon && (
          <div className="flex items-center justify-center w-6">
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
