interface Props {
  title: string
  description: string
  features: { title: string; icon: any; text: string }[]
  imgSrc?: string
}

export function FeatureFocusSection({
  title,
  description,
  features,
  imgSrc,
}: Props) {
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
          {typeof imgSrc !== 'undefined' && (
            <img
              src={imgSrc}
              alt="App screenshot"
              className="mb-[-12%] rounded-xl shadow-2xl ring-1 ring-gray-900/10"
            />
          )}
          <div className="relative" aria-hidden="true">
            <div className="absolute -inset-x-20 bottom-0 bg-gradient-to-t from-white pt-[7%]" />
          </div>
        </div>
      </div>
      <div className="mx-auto mt-16 max-w-7xl px-6 sm:mt-20 md:mt-24 lg:px-8">
        <dl className="mx-auto grid max-w-2xl grid-cols-1 gap-x-6 gap-y-10 text-base leading-7 text-gray-600 sm:grid-cols-2 lg:mx-0 lg:max-w-none lg:grid-cols-3 lg:gap-x-8 lg:gap-y-16">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="relative rounded-xl bg-gray-100 p-6 pl-9"
            >
              <dt className="inline font-semibold text-gray-900">
                {feature.title}
              </dt>{' '}
              <p>{feature.text}</p>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}
export default FeatureFocusSection
