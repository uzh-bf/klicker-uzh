import { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { Button } from '@uzh-bf/design-system'
import { useRouter } from 'next/router'
import { twMerge } from 'tailwind-merge'

interface ListButtonProps {
  link?: string
  onClick?: () => void
  icon: IconDefinition
  label: string
  data?: {
    cy?: string
    test?: string
  }
  className?: {
    root?: string
    icon?: string
    label?: string
  }
}

interface ListButtonLinkProps extends ListButtonProps {
  link: string
  onClick?: never
}
interface ListButtonOnClickProps extends ListButtonProps {
  link?: never
  onClick: () => void
}

function ListButton({
  link,
  onClick,
  icon,
  label,
  data,
  className,
}: ListButtonLinkProps | ListButtonOnClickProps) {
  const router = useRouter()

  return (
    <Button
      fluid
      onClick={onClick ? onClick : () => router.push(link)}
      className={{
        root: className?.root,
      }}
      data={data}
    >
      <Button.Icon
        className={{ root: twMerge('ml-1 mr-3', className?.icon) }}
        icon={icon}
      />
      <Button.Label
        className={{ root: twMerge('line-clamp-1', className?.root) }}
      >
        {label}
      </Button.Label>
    </Button>
  )
}

export default ListButton
