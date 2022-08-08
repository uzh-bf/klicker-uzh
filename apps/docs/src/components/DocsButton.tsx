import React from 'react'
import { Button } from '@uzh-bf/design-system'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowRight } from '@fortawesome/free-solid-svg-icons'
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
      className={twMerge(
        'flex h-12 flex-row justify-center px-4 text-base border-none shadow cursor-pointer items-center',
        className
      )}
    >
      <Button.Icon className="mr-2">
        {icon || <FontAwesomeIcon icon={faArrowRight} />}
      </Button.Icon>
      <Button.Label>{text}</Button.Label>
    </Button>
  )
}

export default DocsButton
