export function ReleaseUpdates() {
  return (
    <section
      id="release-updates"
      aria-labelledby="release-updates-title"
      className="scroll-mt-24 bg-uzh-grey-20"
    >
      <div className="mx-auto max-w-7xl px-6 py-20 sm:py-24 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-uzh-blue-100">
            Release updates
          </p>
          <h2
            id="release-updates-title"
            className="mt-3 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl"
          >
            What has changed in KlickerUZH?
          </h2>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-x-12 gap-y-10 md:grid-cols-2">
          <article className="border-l-4 border-uzh-blue-100 pl-5 sm:pl-6">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-uzh-blue-100">
              Introduced in v3.3
            </p>
            <h3 className="mt-3 text-2xl font-bold tracking-tight text-gray-900">
              More ways to participate and work with teaching content
            </h3>
            <p className="mt-4 max-w-xl text-lg leading-8 text-gray-600">
              Temporary profiles support gamified Live Quizzes. Selection and
              Case Study questions, together with reusable Answer Collections,
              give teaching teams more ways to work with course content.
            </p>
            <p className="mt-4 max-w-xl text-base leading-7 text-gray-600">
              Sharing and activity templates were introduced in private beta;
              availability depends on access.
            </p>
            <a
              href="https://github.com/uzh-bf/klicker-uzh/releases/tag/v3.3.0"
              target="_blank"
              rel="noreferrer noopener"
              className="mt-6 inline-flex items-center gap-2 font-semibold text-uzh-blue-100 underline decoration-uzh-blue-40 underline-offset-4 hover:text-uzh-blue-80 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-uzh-blue-100"
            >
              Read the v3.3 release notes <span aria-hidden="true">→</span>
            </a>
          </article>

          <article className="border-l-4 border-uzh-red-100 pl-5 sm:pl-6">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-uzh-red-100">
              Preparing for v3.4
            </p>
            <h3 className="mt-3 text-2xl font-bold tracking-tight text-gray-900">
              Lecturer tools for chatbots, activity preparation and course
              practice
            </h3>
            <p className="mt-4 max-w-xl text-lg leading-8 text-gray-600">
              We are preparing lecturer tools for course chatbots, alongside
              improvements to activity preparation and course practice. Chatbot
              authoring depends on account access, and publication for students
              remains subject to approval.
            </p>
            <p className="mt-4 text-base leading-7 text-gray-600">
              Preview plans may change.
            </p>
            <a
              href="/development/"
              className="mt-6 inline-flex items-center gap-2 font-semibold text-uzh-blue-100 underline decoration-uzh-blue-40 underline-offset-4 hover:text-uzh-blue-80 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-uzh-blue-100"
            >
              Explore the v3.4 preview <span aria-hidden="true">→</span>
            </a>
          </article>
        </div>
      </div>
    </section>
  )
}

export default ReleaseUpdates
