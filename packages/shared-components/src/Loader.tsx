import { faSpinner } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React from 'react'
import { twMerge } from 'tailwind-merge'

function Loader({ basic }: { basic?: boolean }) {
  return (
    <div className={twMerge(!basic && 'mx-auto my-auto text-center')}>
      <FontAwesomeIcon icon={faSpinner} size="lg" className="animate-spin" />
    </div>
  )
}

export default Loader
