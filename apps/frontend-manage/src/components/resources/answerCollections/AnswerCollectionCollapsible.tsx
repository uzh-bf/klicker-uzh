import { faChevronDown, faChevronUp } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button, H3 } from '@uzh-bf/design-system'
import { useState } from 'react'

function AnswerCollectionCollapsible({
  title,
  className,
  children,
}: {
  title: string | React.ReactNode
  className?: { root?: string }
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(true)

  return (
    <div className={className?.root}>
      <Button
        basic
        onClick={() => setOpen((prev) => !prev)}
        className={{
          root: 'mb-0 flex w-full flex-row items-center justify-between border-b border-b-gray-400',
        }}
      >
        <H3>{title}</H3>
        <FontAwesomeIcon
          icon={open ? faChevronUp : faChevronDown}
          className="mb-1 mr-1"
        />
      </Button>
      {open ? children : null}
    </div>
  )
}

export default AnswerCollectionCollapsible
