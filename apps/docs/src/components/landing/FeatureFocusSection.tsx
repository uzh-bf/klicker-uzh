import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

export function FeatureFocusSection({ title, description, features, imgSrc }) {
  return (
    <div className="bg-white py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl sm:text-center">
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            {title}
          </h2>
          <p className="mt-6 text-lg leading-8 text-gray-600">{description}</p>
        </div>
      </div>
      <div className="relative overflow-hidden pt-16">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <img
            src={imgSrc}
            alt="App screenshot"
            className="mb-[-12%] rounded-xl shadow-2xl ring-1 ring-gray-900/10"
          />
          <div className="relative" aria-hidden="true">
            <div className="absolute -inset-x-20 bottom-0 bg-gradient-to-t from-white pt-[7%]" />
          </div>
        </div>
      </div>
      <div className="mx-auto mt-16 max-w-7xl px-6 sm:mt-20 md:mt-24 lg:px-8">
        <dl className="mx-auto grid max-w-2xl grid-cols-1 gap-x-6 gap-y-10 text-base leading-7 text-gray-600 sm:grid-cols-2 lg:mx-0 lg:max-w-none lg:grid-cols-3 lg:gap-x-8 lg:gap-y-16">
          {features.map((feature) => (
            <div key={feature.title} className="relative pl-9">
              <dt className="inline font-semibold text-gray-900">
                <FontAwesomeIcon
                  aria-hidden="true"
                  icon={feature.icon}
                  className="text-uzh-red-100 absolute left-1 top-1 h-5 w-5"
                />
                {feature.title}
              </dt>{' '}
              <dd className="inline">{feature.text}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}
export default FeatureFocusSection;
