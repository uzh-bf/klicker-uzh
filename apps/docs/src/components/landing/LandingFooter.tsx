export function LandingFooter() {
  return (
    <section
      aria-labelledby="landing-footer-title"
      className="border-t border-uzh-grey-40 bg-white"
    >
      <div className="mx-auto max-w-7xl px-6 py-20 sm:py-24 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:gap-20">
          <section aria-labelledby="landing-footer-title">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-uzh-red-100">
              A simple place to begin
            </p>
            <h2
              id="landing-footer-title"
              className="mt-3 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl"
            >
              Start with one activity.
            </h2>
            <p className="mt-5 max-w-xl text-lg leading-8 text-gray-600">
              Follow the Live Quiz guide, or explore an example that fits your
              course.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
              <a
                href="/tutorials/live_quiz/"
                className="inline-flex items-center justify-center rounded-md bg-primary-100 px-3.25 py-1.75 text-lg font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-100"
              >
                Start with a Live Quiz
              </a>
              <a
                href="#teaching-examples"
                className="font-semibold text-gray-900 underline decoration-gray-400 underline-offset-4 hover:text-uzh-blue-80 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-uzh-blue-100"
              >
                Explore teaching examples <span aria-hidden="true">→</span>
              </a>
            </div>
          </section>

          <section aria-labelledby="landing-trust-title">
            <h2
              id="landing-trust-title"
              className="text-2xl font-bold tracking-tight text-gray-900"
            >
              Developed at the University of Zurich. Open source.
            </h2>
            <p className="mt-4 text-base leading-7 text-gray-600">
              Core features are free to use on the public instance. Some
              features require Catalyst access or beta participation.
            </p>
            <nav aria-label="KlickerUZH information" className="mt-6">
              <ul className="flex flex-wrap gap-x-5 gap-y-3 text-base font-semibold">
                <li>
                  <a
                    href="/catalyst/"
                    className="text-uzh-blue-100 underline decoration-uzh-blue-40 underline-offset-4 hover:text-uzh-blue-80 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-uzh-blue-100"
                  >
                    Catalyst
                  </a>
                </li>
                <li>
                  <a
                    href="https://github.com/uzh-bf/klicker-uzh"
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-uzh-blue-100 underline decoration-uzh-blue-40 underline-offset-4 hover:text-uzh-blue-80 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-uzh-blue-100"
                  >
                    Source code
                  </a>
                </li>
                <li>
                  <a
                    href="/privacy_policy/"
                    className="text-uzh-blue-100 underline decoration-uzh-blue-40 underline-offset-4 hover:text-uzh-blue-80 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-uzh-blue-100"
                  >
                    Privacy policy
                  </a>
                </li>
              </ul>
            </nav>
          </section>
        </div>

        <div className="mt-16 border-t border-uzh-grey-40 pt-8">
          <p className="text-base font-semibold text-gray-900">
            <a
              href="https://klicker-uzh.feedback.df-app.ch/"
              target="_blank"
              rel="noreferrer noopener"
              className="text-uzh-blue-100 underline decoration-uzh-blue-40 underline-offset-4 hover:text-uzh-blue-80 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-uzh-blue-100"
            >
              Suggest an improvement or report a problem
            </a>
          </p>
          <p className="mt-2 text-sm leading-6 text-gray-600">
            Please do not include personal or course data.
          </p>
          <p className="mt-5 text-sm leading-6 text-gray-600">
            <a
              href="https://community.klicker.uzh.ch"
              target="_blank"
              rel="noreferrer noopener"
              className="font-semibold text-gray-900 underline decoration-gray-400 underline-offset-4 hover:text-uzh-blue-80 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-uzh-blue-100"
            >
              Join the KlickerUZH community
            </a>{' '}
            to discuss teaching ideas and share experiences.
          </p>
        </div>
      </div>
    </section>
  )
}

export default LandingFooter
