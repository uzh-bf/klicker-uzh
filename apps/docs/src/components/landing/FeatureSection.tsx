import { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useState, useEffect } from 'react'
import { twMerge } from 'tailwind-merge'

interface Feature {
  title: string
  icon: IconDefinition
  text: string
  hoverImage: string
  shadow?: boolean
  isComingSoon?: boolean
}

interface FeatureSectionProps {
  title: string
  description: string
  features: Feature[]
}

function FeatureSection({ title, description, features }: FeatureSectionProps) {
  const [hoveredFeatureIx, setHoveredFeatureIx] = useState<number>(0)
  const [imageLoaded, setImageLoaded] = useState<boolean>(false)

  useEffect(() => {
    setImageLoaded(false)
    const img = new Image()
    img.src = features[hoveredFeatureIx].hoverImage
    img.onload = () => setImageLoaded(true)
  }, [hoveredFeatureIx, features])

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setHoveredFeatureIx(index)
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
      <div className="text-center lg:pr-8 lg:pt-4">
        <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
          {title}
        </h2>
        <p className="mt-6 text-lg text-gray-600">{description}</p>
      </div>

      <div className="mt-12 flex flex-col lg:flex-row justify-between gap-8">
        <dl 
          className="max-w-xl flex-1 space-y-4 text-base text-gray-600 lg:max-w-none"
          role="list"
          aria-label={`Features of ${title}`}
        >
          {features.map((feature, ix) => (
            <div
              key={feature.title}
              role="listitem"
              tabIndex={0}
              className={twMerge(
                'flex cursor-pointer flex-row items-start gap-4 p-4 sm:p-6 rounded-lg transition-all duration-200',
                'hover:bg-gray-50 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2',
                hoveredFeatureIx === ix && 'bg-gray-100 shadow-md'
              )}
              onMouseEnter={() => setHoveredFeatureIx(ix)}
              onFocus={() => setHoveredFeatureIx(ix)}
              onKeyDown={(e) => handleKeyDown(e, ix)}
              aria-selected={hoveredFeatureIx === ix}
            >
              <div className="flex-shrink-0 mt-1">
                <FontAwesomeIcon
                  aria-hidden="true"
                  icon={feature.icon}
                  className="text-red-600 h-5 w-5"
                />
              </div>
              <div className="flex-1">
                <dt className="font-semibold text-gray-900 mb-1">
                  {feature.title}
                  {feature.text.startsWith('NEW:') && (
                    <span className="ml-2 inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                      NEW
                    </span>
                  )}
                </dt>
                <dd className="text-gray-600 leading-relaxed">
                  {feature.text.replace('NEW: ', '')}
                </dd>
              </div>
            </div>
          ))}
        </dl>

        <div className="flex-1 pt-4 lg:pl-8">
          <div className="relative rounded-lg overflow-hidden bg-gray-50 aspect-[4/3] lg:aspect-auto lg:h-[400px]">
            {!imageLoaded && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="animate-pulse bg-gray-200 rounded-lg w-full h-full"></div>
              </div>
            )}
            <img
              src={features[hoveredFeatureIx].hoverImage ?? ''}
              alt={`Screenshot showing ${features[hoveredFeatureIx].title} feature in action`}
              className={twMerge(
                "h-full w-full object-contain transition-opacity duration-300",
                imageLoaded ? "opacity-100" : "opacity-0"
              )}
              loading="lazy"
            />
          </div>
          <div className="mt-4 sm:hidden text-center">
            <p className="text-sm text-gray-500">
              Tap any feature above to see preview
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default FeatureSection
