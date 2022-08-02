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
        'flex h-12 flex-row justify-center px-4 text-base',
        className
      )}
    >
      <Button.Icon>
        {icon || <FontAwesomeIcon icon={faArrowRight} className="h-5 mr-1" />}
      </Button.Icon>
      <Button.Label>{text}</Button.Label>
    </Button>
  )
}

export default DocsButton
