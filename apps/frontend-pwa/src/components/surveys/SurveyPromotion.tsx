function SurveyPromotion({ courseId }: { courseId: string }) {
  if (courseId === '2b302436-4fc3-4d5d-bbfb-1e13b4ee11b2') {
    return (
      <div className="px-4 py-3 mt-4 text-sm bg-orange-100 border border-orange-200 rounded shadow md:mt-6">
        Wir machen aktuell eine kurze Umfrage zu unserem neuen KlickerUZH. Falls
        ihr 5min Zeit habt, sind wir euch sehr dankbar für ein kurzes (anonymes)
        Feedback unter diesem{' '}
        <a
          className="font-bold text-orange-700 sm:hover:text-orange-900"
          target="_blank"
          href="https://uzhwwf.qualtrics.com/jfe/form/SV_8pHFUATTc1LhOvA"
          rel="noreferrer"
        >
          Link
        </a>
        .
      </div>
    )
  }

  if (courseId === '2f208c63-cb02-4b46-9462-7ce735a42235') {
    return (
      <div className="px-4 py-3 mt-4 text-sm bg-orange-100 border border-orange-200 rounded shadow md:mt-6">
        Wir machen aktuell eine kurze Umfrage zu unserem neuen KlickerUZH. Falls
        ihr 5min Zeit habt, sind wir euch sehr dankbar für ein kurzes (anonymes)
        Feedback unter diesem{' '}
        <a
          className="font-bold text-orange-700 sm:hover:text-orange-900"
          target="_blank"
          href="https://uzhwwf.qualtrics.com/jfe/form/SV_0TySKaHM9p7r3qC"
          rel="noreferrer"
        >
          Link
        </a>
        .
      </div>
    )
  }

  return null
}

export default SurveyPromotion
