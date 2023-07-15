import { useColorMode } from '@docusaurus/theme-common'
import { faExternalLink } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React from 'react'
import { twMerge } from 'tailwind-merge'

interface RoadmapTileProps {
  title: string
  content: string
  useCases?: any
  tags: any
  className?: string
}

const RoadmapTile = ({
  title,
  content,
  useCases,
  tags,
  className,
}: RoadmapTileProps) => {
  const { isDarkTheme } = useColorMode()

  return (
    <div
      className={twMerge(
        'flex h-full flex-col rounded-md border border-solid border-gray-300 p-4 shadow-md',
        className
      )}
    >
      <div className="text-lg font-bold">{title}</div>

      <div className="my-2 h-0.5 bg-gray-200" />

      <div className="text-md flex-1">{content}</div>

      {useCases && <div className="my-2 h-0.5 bg-gray-200" />}

      <div className="flex flex-col gap-2">
        {useCases &&
          useCases.map((useCase: any) => {
            if (useCase.href) {
              return (
                <a
                  target="_blank"
                  className={twMerge(
                    'flex flex-1 flex-row items-center gap-4 rounded-md border border-solid bg-gray-100 px-3 py-2 text-sm sm:hover:shadow',
                    isDarkTheme && 'border-gray-500 bg-gray-500'
                  )}
                  href={useCase.href || '#'}
                >
                  <FontAwesomeIcon icon={faExternalLink} />
                  <div>
                    <div className="font-bold">{useCase.content}</div>
                    <div className="text-gray-600 ">{useCase.status}</div>
                  </div>
                </a>
              )
            }

            return (
              <div
                className={twMerge(
                  'flex-1 rounded-md border border-solid bg-gray-100 px-3 py-2 text-sm',
                  isDarkTheme && 'border-gray-500 bg-gray-500'
                )}
              >
                <div className="font-bold">{useCase.content}</div>
                <div className="text-gray-600">{useCase.status}</div>
              </div>
            )
          })}
      </div>

      <div className="my-2 h-0.5 bg-gray-200" />

      <div className="flex flex-row flex-wrap gap-2">
        {tags.map((tag: any) => (
          <div
            className={twMerge(
              'rounded-md px-3 py-2 text-sm font-bold',
              tag.color == 'gray' && 'bg-gray-500 text-white',
              tag.color == 'lightgray' && 'bg-gray-200 text-gray-600',
              tag.color == 'green' && 'bg-[#bbd023] text-white',
              tag.color == 'orange' && 'bg-uzh-red-100 text-white'
            )}
          >
            {tag.text}
          </div>
        ))}
      </div>
    </div>
  )
}

export default RoadmapTile
