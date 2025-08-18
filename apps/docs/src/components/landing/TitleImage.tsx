import { Button } from '@uzh-bf/design-system'

export function TitleImage() {
  return (
    <div className="bg-white">
      <div className="relative overflow-hidden">
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

            <div className="relative px-6 py-12 sm:py-32 md:py-24 lg:px-8 lg:py-48 lg:pr-0">
              <div className="mx-auto max-w-2xl lg:mx-0 lg:max-w-xl">
                <div className="mb-8 sm:mb-10 sm:flex">
                  <div className="relative rounded-full bg-gradient-to-r from-red-50 to-orange-50 px-4 py-2 text-sm leading-6 text-gray-700 ring-1 ring-red-200 hover:ring-red-300 transition-all">
                    <span className="font-semibold text-red-600">NEW:</span> Anonymous Gamification & Enhanced Activity Management
                    <a
                      href="https://community.klicker.uzh.ch/t/klickeruzh-v3-3-release-information/500"
                      className="ml-2 whitespace-nowrap font-semibold text-red-600 hover:text-red-700"
                      target="_blank"
                      aria-label="Learn more about version 3.3 features"
                    >
                      <span className="absolute inset-0" aria-hidden="true" />
                      Learn more <span aria-hidden="true">&rarr;</span>
                    </a>
                  </div>
                </div>

                <img 
                  className="-ml-2 w-80" 
                  src="/img/logos/KlickerLogo.png"
                  alt="KlickerUZH Logo" 
                />
                <h1 className="mt-6 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
                  Interactive Teaching,<br />
                  <span className="text-red-600">Engaged Learning</span>
                </h1>
                <p className="mt-6 text-lg leading-8 text-gray-600">
                  Transform your classroom with real-time quizzes, collaborative activities, and gamified learning experiences. 
                  Engage every student, whether they're in-person or remote.
                </p>
                
                <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
                  <span className="font-semibold text-gray-700">Trusted by</span>
                  <span>100+ institutions</span>
                  <span className="text-gray-400">•</span>
                  <span>50,000+ students</span>
                  <span className="text-gray-400">•</span>
                  <span>Open Source</span>
                </div>

                <div className="mt-10 flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
                  <a href="https://manage.klicker.uzh.ch" target="_blank">
                    <Button 
                      primary 
                      className={{ root: 'border-none text-lg px-8 py-3 shadow-lg hover:shadow-xl transition-shadow' }}
                      aria-label="Sign up for free account or login"
                    >
                      Start Free
                    </Button>
                  </a>
                  <a
                    href="/getting_started/welcome"
                    className="text-lg font-semibold leading-6 text-gray-900 hover:text-red-600 transition-colors"
                    aria-label="View getting started guide"
                  >
                    View Demo <span aria-hidden="true">→</span>
                  </a>
                </div>
                
                <div className="mt-8 rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 shadow-sm">
                  <div className="flex items-start">
                    <svg className="h-5 w-5 text-blue-600 mt-0.5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    <div className="text-sm">
                      <span className="font-semibold text-blue-900">Free Training Available:</span>
                      <span className="text-blue-700"> Regular introductory courses through UZH Central IT. </span>
                      <a
                        target="_blank"
                        href="https://community.klicker.uzh.ch/t/2024-01-10-2024-02-08-klickeruzh-v3-0-introduction-and-didactic-use-cases/257"
                        className="font-medium text-blue-600 hover:text-blue-700 underline"
                      >
                        Register here
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="bg-gray-50 lg:absolute lg:inset-y-0 lg:right-0 lg:w-1/2">
          <img
            className="aspect-[3/2] object-cover sm:aspect-[16/9] lg:aspect-auto lg:h-full lg:w-full"
            src="/img/landing/hero.jpg"
            alt="Students engaging with KlickerUZH on their devices in a classroom setting"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent lg:hidden"></div>
        </div>
      </div>
    </div>
  )
}
export default TitleImage
