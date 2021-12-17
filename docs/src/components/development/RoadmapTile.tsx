import React from 'react'
import useThemeContext from '@theme/hooks/useThemeContext'
import clsx from 'clsx'

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
  const { isDarkTheme } = useThemeContext()

  return (
    <div
      className={clsx(
        'h-full border-2 border-solid rounded-md px-4 shadow-md flex flex-col',
        className
      )}
    >
      <div className="mt-3 text-lg font-bold">{title}</div>
      <div className="h-0.5 my-2 bg-gray-200" />
      <div className="flex-1">{content}</div>
      {useCases && <div className="h-0.5 my-2 bg-gray-200" />}
      <div className="mb-4">
        {useCases &&
          useCases.map((useCase: any) => (
            <div
              className={clsx(
                'flex-1 p-1 mb-2 text-sm bg-gray-200 border border-solid rounded-md',
                isDarkTheme && 'bg-gray-500 border-gray-500'
              )}
            >
              {useCase}
            </div>
          ))}
      </div>
      <div className="h-0.5 my-2 bg-gray-200" />
      <div className="flex flex-row flex-wrap mb-2">
        {tags.map((tag: any) => (
          <div
            className={clsx(
              'mx-0.5 p-1.5 mr-2 mb-2 text-sm font-bold rounded-md',
              tag.color == 'gray' && 'bg-gray-500 text-white',
              tag.color == 'lightgray' && 'bg-gray-200 text-gray-600',
              tag.color == 'green' && 'bg-[#bbd023] text-white'
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
