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
        'h-full border border-solid border-gray-300 rounded-md shadow-md flex flex-col p-4',
        className
      )}
    >
      <div className="text-lg font-bold">{title}</div>

      <div className="h-0.5 my-2 bg-gray-200" />

      <div className="flex-1 text-md">{content}</div>

      {useCases && <div className="h-0.5 my-2 bg-gray-200" />}

      <div className="flex flex-col gap-2">
        {useCases &&
          useCases.map((useCase: any) => {
            if (useCase.href) {
              return (
                <a
                  target="_blank"
                  className={twMerge(
                    'flex-1 px-3 py-2 text-sm bg-gray-100 border border-solid rounded-md hover:shadow flex flex-row gap-4 items-center',
                    isDarkTheme && 'bg-gray-500 border-gray-500'
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
                  'flex-1 px-3 py-2 text-sm bg-gray-100 border border-solid rounded-md',
                  isDarkTheme && 'bg-gray-500 border-gray-500'
                )}
              >
                <div className="font-bold">{useCase.content}</div>
                <div className="text-gray-600">{useCase.status}</div>
              </div>
            )
          })}
      </div>

      <div className="h-0.5 my-2 bg-gray-200" />

      <div className="flex flex-row flex-wrap gap-2">
        {tags.map((tag: any) => (
          <div
            className={twMerge(
              'py-2 px-3 text-sm font-bold rounded-md',
              tag.color == 'gray' && 'bg-gray-500 text-white',
              tag.color == 'lightgray' && 'bg-gray-200 text-gray-600',
              tag.color == 'green' && 'bg-[#bbd023] text-white',
              tag.color == 'orange' && 'bg-uzh-red-100 text-white',
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
