import { IconDefinition } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button } from '@uzh-bf/design-system'
import Link from 'next/link'

interface LinkButtonProps {
  href: string
  icon: IconDefinition
  children: string | React.ReactNode
}

function LinkButton({ href, children, icon }: LinkButtonProps) {
  return (
    <Link href={href} legacyBehavior>
      <Button
        className={{
          root: 'gap-6 px-4 py-2 text-lg shadow bg-uzh-grey-20 hover:bg-uzh-grey-40',
        }}
      >
        <Button.Icon>
          <FontAwesomeIcon icon={icon} />
        </Button.Icon>
        <Button.Label className={{ root: 'flex-1 text-left' }}>
          {children}
        </Button.Label>
      </Button>
    </Link>
  )
}

export default LinkButton
