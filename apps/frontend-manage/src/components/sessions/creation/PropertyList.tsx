import { IconDefinition } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React from 'react'
import { twMerge } from 'tailwind-merge'

interface PropertyListProps {
  elements: {
    icon: IconDefinition
    iconColor: string
    richText: string | React.ReactNode
  }[]
}

function PropertyList({ elements }: PropertyListProps) {
  return (
    <>
      {elements.map((element, ix) => (
        <div
          className="flex flex-row items-center text-[0.95rem]"
          key={`property-list-element-${ix}`}
        >
          <div className="w-fit">
            <FontAwesomeIcon
              icon={element.icon}
              className={twMerge('w-10 -ml-1.5', element.iconColor)}
              size="lg"
            />
          </div>
          <div className="leading-5">{element.richText}</div>
        </div>
      ))}
    </>
  )
}

export default PropertyList
