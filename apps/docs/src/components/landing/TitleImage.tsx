export function TitleImage() {
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-7xl px-6 py-16 sm:py-20 lg:px-8 lg:py-24">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-uzh-blue-100">
            KlickerUZH · Developed at the University of Zurich
          </p>
          <h1 className="mt-4 max-w-3xl text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
            Live participation and independent practice for your course.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-gray-600">
            Ask questions, discuss responses and give students opportunities to
            practise. Build Live Quizzes, Practice Quizzes and Microlearning
            from one question pool.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
            <a
              href="/tutorials/live_quiz/"
              className="inline-flex items-center justify-center rounded-md bg-primary-100 px-4 py-2.5 text-base font-semibold text-primary-foreground shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-100"
            >
              Start with a Live Quiz <span aria-hidden="true">→</span>
            </a>
            <a
              href="#teaching-examples"
              className="text-base font-semibold leading-6 text-gray-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-100"
            >
              Explore teaching examples <span aria-hidden="true">→</span>
            </a>
          </div>
          <p className="mt-7 max-w-xl text-sm leading-6 text-gray-600">
            <a
              href="/student_tutorials/student_accounts/"
              className="font-medium text-uzh-blue-100 underline decoration-uzh-blue-40 underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-100"
            >
              Joining a class? Use the link or QR code shared by your lecturer.
            </a>
          </p>
        </div>
      </div>
    </section>
  )
}

export default TitleImage
