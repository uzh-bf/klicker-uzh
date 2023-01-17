import { Button } from '@uzh-bf/design-system'
import { twMerge } from 'tailwind-merge'

interface MenuButtonProps {
  icon: React.ReactNode
  children: React.ReactNode
  onClick: () => void
  className?: {
    root?: string
    icon?: string
    label?: string
  }
}

function MenuButton({ icon, children, onClick, className }: MenuButtonProps) {
  return (
    <Button
      className={{
        root: twMerge(
          'flex justify-center flex-1 my-0.5 flex-col gap-0 bg-grey-60 border-0 shadow-none text-white',
          className?.root
        ),
      }}
      onClick={onClick}
    >
      <Button.Icon className={{ root: className?.icon }}>{icon}</Button.Icon>
      <Button.Label className={{ root: twMerge('text-xs', className?.label) }}>
        {children}
      </Button.Label>
    </Button>
  )
}

export default MenuButton
