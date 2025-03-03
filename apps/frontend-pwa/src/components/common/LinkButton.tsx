import { IconDefinition } from '@fortawesome/free-regular-svg-icons'
import { Button } from '@uzh-bf/design-system'
import Link from 'next/link'
import { twMerge } from 'tailwind-merge'

interface LinkButtonProps {
  href: string
  icon?: IconDefinition
  children: string | React.ReactNode
  onClick?: () => void
  data?: { cy?: string; test?: string }
  disabled?: boolean
  className?: {
    root?: string
  }
  [key: string]: any
}

function LinkButton({
  href,
  children,
  icon,
  onClick,
  disabled,
  data,
  className,
  ...props
}: LinkButtonProps) {
  return (
    <Link href={href} className="w-full">
      <Button
        {...props}
        fluid
        className={{
          root: twMerge('text-lg', className?.root),
        }}
        onClick={onClick}
        data={data}
        disabled={disabled}
      >
        {icon && <Button.Icon icon={icon} />}
        <Button.Label className={{ root: 'flex-1 text-left' }}>
          {children}
        </Button.Label>
      </Button>
    </Link>
  )
}

export default LinkButton
