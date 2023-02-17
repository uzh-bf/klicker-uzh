import { IconDefinition } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button } from '@uzh-bf/design-system'
import Link from 'next/link'
import { twMerge } from 'tailwind-merge'

interface LinkButtonProps {
  href: string
  icon?: IconDefinition
  children: string | React.ReactNode
  [key: string]: any
}

function LinkButton({ href, children, icon, ...props }: LinkButtonProps) {
  return (
    <Link href={href} className='w-full'>
      <Button
        {...props}
        fluid
        className={{
          root: twMerge(
            'gap-6 px-4 py-2 text-lg shadow bg-slate-200 hover:bg-slate-300 border-slate-300',
            props.className?.root
          ),
        }}
      >
        {icon && (
          <Button.Icon>
            <FontAwesomeIcon icon={icon} />
          </Button.Icon>
        )}
        <Button.Label className={{ root: 'flex-1 text-left' }}>
          {children}
        </Button.Label>
      </Button>
    </Link>
  )
}

export default LinkButton
