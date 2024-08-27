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
  data?: {
    cy?: string
    test?: string
  }
}

function MenuButton({
  icon,
  disabled,
  children,
  onClick,
  className,
  data,
}: MenuButtonProps) {
  return (
    <Button
      className={{
        root: twMerge(
          'bg-grey-60 my-0.5 flex flex-1 flex-col justify-center gap-0 border-0 text-white shadow-none',
          disabled && 'text-uzh-grey-100 cursor-not-allowed',
          className?.root
        ),
      }}
      onClick={onClick}
      disabled={disabled}
      data={data}
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
