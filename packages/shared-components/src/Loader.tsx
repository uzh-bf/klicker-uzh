import { faSpinner } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React from 'react'

function Loader() {
  return (
    <div className="mx-auto my-auto text-center">
      <FontAwesomeIcon icon={faSpinner} size="lg" className="animate-spin" />
    </div>
  )
}

export default Loader
