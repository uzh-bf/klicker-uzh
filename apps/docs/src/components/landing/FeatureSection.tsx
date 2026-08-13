import { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useState } from 'react'
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

  return (
    <div className="mx-auto max-w-7xl px-6 pt-16 lg:px-8">
      <div className="text-center lg:pr-8 lg:pt-4">
        <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
          {title}
        </h2>
        <p className="mt-6 text-lg text-gray-600">{description}</p>
      </div>

      <div className="flex flex-row justify-between gap-8">
        <dl className="max-w-xl flex-1 space-y-6 text-base text-gray-600 lg:max-w-none">
          {features.map((feature, ix) => (
            /* biome-ignore lint/a11y/noStaticElementInteractions: Hover-only preview selector without activation behavior. */
            <div
              key={feature.title}
              className={twMerge(
                'flex cursor-pointer flex-row items-center gap-6 p-6 pl-9',
                hoveredFeatureIx === ix && 'rounded-xl bg-gray-100'
              )}
              onMouseEnter={() => setHoveredFeatureIx(ix)}
            >
              <FontAwesomeIcon
                aria-hidden="true"
                icon={feature.icon}
                className="text-uzh-red-100 h-5 w-5"
              />
              <div>
                <dt className="font-semibold text-gray-900">{feature.title}</dt>
                <dd className="ml-0 block">{feature.text}</dd>
              </div>
            </div>
          ))}
        </dl>

        <div className="hidden flex-1 pt-4 sm:block">
          <img
            src={features[hoveredFeatureIx].hoverImage ?? ''}
            alt="Feature specific screenshot"
            className="h-auto max-h-[400px] w-full object-contain"
          />
        </div>
      </div>
    </div>
  )
}

export default FeatureSection
