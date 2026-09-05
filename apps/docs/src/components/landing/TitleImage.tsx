export function TitleImage() {
  return (
    <div className="bg-white">
      <div className="relative">
        <div className="mx-auto max-w-7xl">
          <div className="relative z-10 pt-14 lg:w-full lg:max-w-2xl">
            <svg
              className="absolute inset-y-0 right-8 hidden h-full w-80 translate-x-1/2 transform fill-white lg:block"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <polygon points="0,0 90,0 50,100 0,100" />
            </svg>

            <div className="relative px-6 py-12 sm:py-40 md:py-32 lg:px-8 lg:py-56 lg:pr-0">
              <div className="mx-auto max-w-2xl lg:mx-0 lg:max-w-xl">
                <div className="mb-6 flex sm:mb-10">
                  <div className="relative flex max-w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-full px-3 py-1 text-xs leading-6 text-gray-500 ring-1 ring-gray-900/10 hover:ring-gray-900/20 sm:text-sm">
                    <span>Preparing for KlickerUZH v3.4</span>
                    <a
                      href="/development/"
                      className="whitespace-nowrap font-semibold text-gray-900 hover:underline"
                    >
                      See what's coming <span aria-hidden="true">&rarr;</span>
                    </a>
                  </div>
                </div>

                <h1 className="m-0">
                  <img
                    className="-ml-2 w-80"
                    src="/img/logos/KlickerLogo.png"
                    alt="KlickerUZH"
                  />
                </h1>
                <p className="mt-1 text-2xl leading-8 text-gray-600">
                  Bring students into the conversation.
                </p>
                <div className="mt-10 flex items-center gap-x-6">
                  <a
                    href="https://manage.klicker.uzh.ch"
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center justify-center rounded-md bg-primary-100 px-3.25 py-1.75 text-lg font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-100"
                  >
                    Sign up or log in
                  </a>
                  <a
                    href="/getting_started/welcome/"
                    className="text-lg font-semibold leading-6 text-gray-900"
                  >
                    Get started <span aria-hidden="true">→</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="hidden bg-gray-50 md:block lg:absolute lg:inset-y-0 lg:right-0 lg:w-1/2">
          <img
            className="aspect-3/2 object-cover lg:aspect-auto lg:h-full lg:w-full"
            src="/img/landing/hero.jpg"
            alt="A participant answering a KlickerUZH question on a phone"
          />
        </div>
      </div>
    </div>
  )
}
export default TitleImage
