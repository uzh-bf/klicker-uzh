import { faArrowRight } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button } from '@uzh-bf/design-system'
import React from 'react'
import { twMerge } from 'tailwind-merge'

interface DocsButtonProps {
  url: string
  text: string
  icon?: React.ReactNode
  className?: string
}

function DocsButton({ url, text, icon, className }: DocsButtonProps) {
  return (
    <Button
      onClick={() => window.open(url, '_blank')}
      className={{
        root: twMerge(
          'flex h-12 flex-row justify-center px-4 text-base border-none shadow cursor-pointer items-center',
          className
        ),
      }}
    >
      <Button.Icon className={{ root: 'mr-2' }}>
        {icon || <FontAwesomeIcon icon={faArrowRight} />}
      </Button.Icon>
      <Button.Label>{text}</Button.Label>
    </Button>
  )
}

export default DocsButton
