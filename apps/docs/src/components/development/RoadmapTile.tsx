import { useColorMode } from '@docusaurus/theme-common'
import { faExternalLink } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { twMerge } from 'tailwind-merge'

export interface RoadmapUseCase {
  content: string
  href?: string
  status: string
}

export type RoadmapTagColor = 'gray' | 'lightgray' | 'green' | 'orange'

export interface RoadmapTag {
  text: string
  color: RoadmapTagColor
}

export interface RoadmapTileProps {
  title: string
  content: string
  useCases?: RoadmapUseCase[]
  tags: RoadmapTag[]
  className?: string
}

const RoadmapTile = ({
  title,
  content,
  useCases = [],
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
      <h3 className="text-lg font-bold">{title}</h3>

      <div className="my-2 h-0.5 bg-gray-200" />

      <div className="text-md flex-1">{content}</div>

      {useCases.length > 0 && <div className="my-2 h-0.5 bg-gray-200" />}

      <div className="flex flex-col gap-2">
        {useCases.map((useCase) => {
          if (useCase.href) {
            return (
              <a
                key={useCase.content}
                target="_blank"
                rel="noreferrer noopener"
                className={twMerge(
                  'border-border flex flex-1 flex-row items-center gap-4 rounded-md border bg-gray-100 px-3 py-2 text-sm hover:shadow',
                  isDarkTheme && 'border-gray-500 bg-gray-500'
                )}
                href={useCase.href}
              >
                <FontAwesomeIcon icon={faExternalLink} />
                <div>
                  <div className="font-bold">{useCase.content}</div>
                  <div className="text-gray-600">{useCase.status}</div>
                </div>
              </a>
            )
          }

          return (
            <div
              key={useCase.content}
              className={twMerge(
                'border-border flex-1 rounded-md border border-solid bg-gray-100 px-3 py-2 text-sm',
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
        {tags.map((tag) => (
          <div
            key={tag.text}
            className={twMerge(
              'rounded-md px-3 py-2 text-sm font-bold',
              tag.color === 'gray' && 'bg-gray-500 text-white',
              tag.color === 'lightgray' && 'bg-gray-200 text-gray-600',
              tag.color === 'green' && 'bg-[#bbd023] text-gray-900',
              tag.color === 'orange' && 'bg-uzh-red-100 text-white'
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
