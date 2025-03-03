import { IconDefinition } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import Link from 'next/link'

function PrimaryActionLink({
  href,
  label,
  icon,
  data,
  ...props
}: {
  href: string
  label: string
  icon: IconDefinition
  data?: {
    cy?: string
    test?: string
  }
  [key: string]: any
}) {
  return (
    <Link href={href} passHref legacyBehavior>
      <a
        data-cy={data?.cy}
        data-test={data?.test}
        className="text-primary-100 hover:bg-accent flex h-7 flex-row items-center gap-2 rounded-md px-3"
        {...props}
      >
        <FontAwesomeIcon icon={icon} />
        <span>{label}</span>
      </a>
    </Link>
  )
}

export default PrimaryActionLink
