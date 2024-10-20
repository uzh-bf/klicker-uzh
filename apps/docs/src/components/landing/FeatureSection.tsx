import { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useState } from 'react'

interface Feature {
  title: string
  icon: IconDefinition
  text: string
  hoverImage: string
  shadow?: boolean
}

interface FeatureSectionProps {
  title: string
  description: string
  features: Feature[]
}

function FeatureSection({ title, description, features }: FeatureSectionProps) {
  const [hoveredImage, setHoveredImage] = useState(
    features[0]?.hoverImage || ''
  )
  const [hoveredFeature, setHoveredFeature] = useState<Feature | null>()

  const handleMouseEnter = (feature: Feature) => {
    setHoveredImage(feature.hoverImage)
    setHoveredFeature(feature)
  }

  return (
    <div className="overflow-hidden bg-white py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto grid max-w-2xl grid-cols-1 gap-x-8 gap-y-16 sm:gap-y-20 lg:mx-0 lg:max-w-none lg:grid-cols-2">
          <div className="lg:pr-8 lg:pt-4">
            <div className="lg:max-w-lg">
              <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
                {title}
              </h2>
              <p className="mt-6 text-lg text-gray-600">{description}</p>
              <dl className="mt-10 max-w-xl space-y-6 text-base text-gray-600 lg:max-w-none">
                {features.map((feature) => (
                  <div
                    key={feature.title}
                    className={`relative p-6 pl-9 ${hoveredFeature === feature ? 'hover:rounded-xl hover:bg-gray-100' : ''}`}
                    onMouseEnter={() => handleMouseEnter(feature)}
                  >
                    <dt className="inline font-semibold text-gray-900">
                      <FontAwesomeIcon
                        aria-hidden="true"
                        icon={feature.icon}
                        className="text-uzh-red-100 absolute left-1 top-7 h-5 w-5"
                      />
                      {feature.title}
                    </dt>{' '}
                    <dd className="ml-0 block">{feature.text}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
          <div className="flex items-center justify-center p-0">
            <div className="">
              <img
                src={hoveredImage}
                alt="Feature specific screenshot"
                className="h-auto max-h-[400px] w-full rounded-xl object-contain p-4 shadow-xl ring-1 ring-gray-400/10 sm:w-[57rem] md:-ml-4 lg:-ml-0"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default FeatureSection
