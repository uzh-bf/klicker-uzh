import { IconProp } from '@fortawesome/fontawesome-svg-core'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button } from '@uzh-bf/design-system'
import { useRouter } from 'next/router'
import { twMerge } from 'tailwind-merge'

interface ListButtonProps {
  link?: string
  onClick?: () => void
  icon: IconProp
  label: string
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
  className,
}: ListButtonLinkProps | ListButtonOnClickProps) {
  const router = useRouter()

  return (
    <Button
      className={{
        root: twMerge(
          'p-2 border border-solid rounded-md bg-uzh-grey-40 border-uzh-grey-100 w-full',
          className?.root
        ),
      }}
      onClick={onClick ? onClick : () => router.push(link)}
    >
      <Button.Icon className={{ root: twMerge('ml-1 mr-3', className?.icon) }}>
        <FontAwesomeIcon icon={icon} />
      </Button.Icon>
      <Button.Label
        className={{ root: twMerge('line-clamp-1', className?.root) }}
      >
        {label}
      </Button.Label>
    </Button>
  )
}

export default ListButton
