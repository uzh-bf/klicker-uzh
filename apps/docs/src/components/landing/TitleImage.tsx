import { Button } from "@uzh-bf/design-system";

function TitleImage({version, relaselink}) {
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
                  <div className="hidden sm:mb-10 sm:flex">
                    <div className="text-md relative rounded-full px-3 py-1 leading-6 text-gray-500 ring-1 ring-gray-900/10 hover:ring-gray-900/20">
                      KlickerUZH {version} has been released with brand new features{' '}
                      <a
                        href={relaselink}
                        className="whitespace-nowrap font-semibold"
                        target="_blank"
                        style={{ marginLeft: '0.75rem' }}
                      >
                        <span className="absolute inset-0" aria-hidden="true" />
                        What's new? <span aria-hidden="true">&rarr;</span>
                      </a>
                    </div>
                  </div>
  
                  <img className="-ml-2 w-80" src="/img/KlickerLogo.png" />
                  <p className="mt-6 text-2xl leading-8 text-gray-600">
                    Enhance your classroom experience.
                  </p>
                  <div className="mt-10 flex items-center gap-x-6">
                    <a href="https://manage.klicker.uzh.ch" target="_blank">
                      <Button
                        className={{
                          root: 'border-uzh-blue-40 w-full cursor-pointer text-xl md:w-max',
                        }}
                      >
                        Sign Up / Login
                      </Button>
                    </a>
                    <a
                      href="/getting_started/welcome"
                      className="font-semibold leading-6 text-gray-900"
                    >
                      Get started <span aria-hidden="true">→</span>
                    </a>
                  </div>
                  <div className="mt-4 rounded-md border border-solid border-slate-200 bg-slate-100 px-3 py-2 shadow">
                    We are now regularly offering introductory courses through UZH
                    Central IT. For more details see{' '}
                    <a
                      target="_blank"
                      href="https://community.klicker.uzh.ch/t/2024-01-10-2024-02-08-klickeruzh-v3-0-introduction-and-didactic-use-cases/257"
                    >
                      the following page
                    </a>
                    .
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="hidden bg-gray-50 md:block lg:absolute lg:inset-y-0 lg:right-0 lg:w-1/2">
            <img
              className="aspect-[3/2] object-cover lg:aspect-auto lg:h-full lg:w-full"
              src="/img_v3/hero.jpg"
              alt=""
            />
          </div>
        </div>
      </div>
    )
  }