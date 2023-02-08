import { Button } from '@uzh-bf/design-system'
import { twMerge } from 'tailwind-merge'

interface MenuButtonProps {
  icon: React.ReactNode
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  className?: {
    root?: string
    icon?: string
    label?: string
  }
}

function MenuButton({
  icon,
  disabled,
  children,
  onClick,
  className,
}: MenuButtonProps) {
  return (
    <Button
      className={{
        root: twMerge(
          'flex justify-center flex-1 my-0.5 flex-col gap-0 bg-grey-60 border-0 shadow-none text-white',
          disabled && 'cursor-not-allowed text-uzh-grey-100',
          className?.root
        ),
      }}
      onClick={onClick}
      disabled={disabled}
    >
      <Button.Icon className={{ root: twMerge('w-max', className?.icon) }}>
        {icon}
      </Button.Icon>
      <Button.Label className={{ root: twMerge('text-xs', className?.label) }}>
        {children}
      </Button.Label>
    </Button>
  )
}

export default MenuButton
