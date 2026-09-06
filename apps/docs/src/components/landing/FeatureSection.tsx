export function FeatureSection() {
  return (
    <section
      id="teaching-examples"
      className="scroll-mt-24 bg-gray-50 py-16 sm:py-20"
      aria-labelledby="teaching-examples-heading"
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="max-w-3xl">
          <h2
            id="teaching-examples-heading"
            className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl"
          >
            Teaching examples for your next course session
          </h2>
          <p className="mt-5 text-lg leading-8 text-gray-600">
            Choose a teaching task, then explore the activity that supports it.
          </p>
        </div>

        <div className="mt-12 space-y-8">
          <article className="grid gap-8 rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-900/10 sm:p-8 md:grid-cols-2 md:items-center">
            <figure>
              <a
                href="/img/live_quiz/lq_evaluation.png"
                aria-label="Open the full Live Quiz results image"
              >
                <img
                  src="/img/live_quiz/lq_evaluation.png"
                  width="1180"
                  height="835"
                  alt="Live Quiz bar results for a question comparing a safe prize with an uncertain prize, with 98 aggregate responses"
                  className="h-auto w-full rounded-lg"
                  loading="lazy"
                />
              </a>
              <figcaption className="mt-3 text-sm leading-6 text-gray-600">
                Discuss the choices behind the class responses.
              </figcaption>
            </figure>
            <div>
              <h3 className="text-2xl font-semibold tracking-tight text-gray-900">
                Hear from your whole class
              </h3>
              <p className="mt-4 text-base leading-7 text-gray-600">
                Ask a question, collect responses and use the results to guide
                discussion. Students can also ask and upvote questions through
                Live Q&amp;A.
              </p>
              <p className="mt-4 text-base leading-7 text-gray-600">
                For gamified Live Quizzes, temporary profiles let participants
                join the leaderboard without creating an account.
              </p>
              <a
                href="/use_cases/live_quiz/"
                className="mt-6 inline-flex items-center self-start font-semibold text-uzh-blue-100 underline decoration-uzh-blue-40 underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-100"
              >
                See a Live Quiz example <span aria-hidden="true">→</span>
              </a>
            </div>
          </article>

          <article className="grid gap-8 rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-900/10 sm:p-8 md:grid-cols-2 md:items-center">
            <figure className="md:order-2">
              <a
                href="/img/practice_quiz/pq_olat_view.png"
                aria-label="Open the full Practice Quiz image"
              >
                <img
                  src="/img/practice_quiz/pq_olat_view.png"
                  width="2464"
                  height="1584"
                  alt="Practice Quiz view in an OLAT course showing a finance question and question progress"
                  className="h-auto w-full rounded-lg"
                  loading="lazy"
                />
              </a>
              <figcaption className="mt-3 text-sm leading-6 text-gray-600">
                A Practice Quiz shown within an OLAT course.
              </figcaption>
            </figure>
            <div className="md:order-1">
              <h3 className="text-2xl font-semibold tracking-tight text-gray-900">
                Keep practice going between classes
              </h3>
              <p className="mt-4 text-base leading-7 text-gray-600">
                Give students questions to revisit throughout the course. Use
                Practice Quizzes for repeat practice and Microlearning for short
                activities with a completion window.
              </p>
              <p className="mt-4 text-base leading-7 text-gray-600">
                After a lecture, students can revisit finance questions before
                the next class.
              </p>
              <a
                href="/use_cases/practice_quiz/"
                className="mt-6 inline-flex items-center self-start font-semibold text-uzh-blue-100 underline decoration-uzh-blue-40 underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-100"
              >
                See a Practice Quiz example <span aria-hidden="true">→</span>
              </a>
            </div>
          </article>

          <article className="grid gap-8 rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-900/10 sm:p-8 md:grid-cols-2 md:items-center">
            <figure>
              <a
                href="/img/answer_collections/answer_collection_usage_cs.png"
                aria-label="Open the full Answer Collection image"
              >
                <img
                  src="/img/answer_collections/answer_collection_usage_cs.png"
                  width="1864"
                  height="358"
                  alt="Case Study setup selecting the Medical Diagnoses Answer Collection with myocardial infarction and pneumonia items"
                  className="h-auto w-full rounded-lg"
                  loading="lazy"
                />
              </a>
              <figcaption className="mt-3 text-sm leading-6 text-gray-600">
                Choose reusable answer options for a Case Study.
              </figcaption>
            </figure>
            <div>
              <h3 className="text-2xl font-semibold tracking-tight text-gray-900">
                Build on the content you already teach
              </h3>
              <p className="mt-4 text-base leading-7 text-gray-600">
                Reuse questions across activities. Create Answer Collections for
                Selection and Case Study questions, and find or update your
                content from the question pool.
              </p>
              <p className="mt-4 text-base leading-7 text-gray-600">
                Select medical diagnosis answers from the collection when
                preparing a Case Study.
              </p>
              <a
                href="/tutorials/answer_collections/"
                className="mt-6 inline-flex items-center self-start font-semibold text-uzh-blue-100 underline decoration-uzh-blue-40 underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-100"
              >
                Learn about Answer Collections <span aria-hidden="true">→</span>
              </a>
            </div>
          </article>
        </div>

        <p className="mt-10 text-center text-base leading-7 text-gray-600">
          <a
            href="/use_cases/"
            className="font-semibold text-uzh-blue-100 underline decoration-uzh-blue-40 underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-100"
          >
            Browse all teaching examples <span aria-hidden="true">→</span>
          </a>
        </p>

        <p className="mx-auto mt-10 max-w-3xl text-center text-base leading-7 text-gray-600">
          Use Group Activities for collaboration, with points and leaderboards
          where they fit your teaching. Read the{' '}
          <a
            href="/tutorials/group_activity/"
            className="font-semibold text-uzh-blue-100 underline decoration-uzh-blue-40 underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-100"
          >
            Group Activity guide
          </a>{' '}
          and the{' '}
          <a
            href="/use_cases/gamification/"
            className="font-semibold text-uzh-blue-100 underline decoration-uzh-blue-40 underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-100"
          >
            gamification overview
          </a>
          .
        </p>
      </div>
    </section>
  )
}

export default FeatureSection
