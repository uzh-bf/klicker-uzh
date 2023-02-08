import { useQuery } from '@apollo/client'
import CommonDocs from '@components/CommonDocs'
import Layout from '@components/Layout'
import { GetCourseOverviewDataDocument } from '@klicker-uzh/graphql/dist/ops'
import { H3 } from '@uzh-bf/design-system'
import { useRouter } from 'next/router'

function Microlearning() {
  const router = useRouter()

  const { data } = useQuery(GetCourseOverviewDataDocument, {
    variables: { courseId: router.query.courseId as string },
    skip: !router.query?.courseId,
  })

  if (!data?.getCourseOverviewData) {
    return <div>Loading...</div>
  }

  return (
    <Layout
      courseName={data.getCourseOverviewData.course.name}
      displayName="Hilfe"
      courseColor={data.getCourseOverviewData.course.color}
    >
      <CommonDocs />
      <div className="m-5 text-sm leading-relaxed md:m-0 md:w-full md:max-w-xxl md:p-8 md:mx-auto md:border md:rounded">
        <H3>Microlearning</H3>
        Microlearning bezeichnet Lernen in kleinen Einheiten. Am{' '}
        <strong>Mittwoch nach jeder Vorlesung ab 07.00 Uhr</strong> werden in
        der KlickerUZH App für 24 Stunden einige MC-Fragen zum Inhalt der
        letzten Vorlesung veröffentlicht. Das Microlearning, welches mobiles
        Lernen ermöglicht, fördert die Inhalte von Vorlesungen zeit- und
        ortsunabhängig zu wiederholen. Ausserdem wirken sich kürzere
        Lerneinheiten positiv auf die Konzentration aus und fördern somit deine
        langfristige Wissensaufnahme. <br />
        <br />
        Die Microlearning Fragen können einmalig beantwortet werden. Das
        Beantworten der Fragen ist freiwillig, du benötigst jedoch{' '}
        <strong>ein Login</strong>. Alle Microlearning Fragen werden übers
        Semester hindurch auch unter{' '}
        <a
          className="font-bold text-uzh-turqoise-100"
          href="https://lms.uzh.ch/auth/RepositoryEntry/17250386251/CourseNode/106401834150161"
          target="_blank"
          rel="noreferrer"
        >
          Repetition Microlearning
        </a>{' '}
        verfügbar sein, wo man sie auch ohne Login wiederholt repetieren kann.
        <br />
        <br />
        Teilnahme:{' '}
        <a
          className="font-bold text-uzh-turqoise-100"
          href="https://pwa.klicker.uzh.ch/login"
          target="_blank"
          rel="noreferrer"
        >
          https://pwa.klicker.uzh.ch/login
        </a>{' '}
        oder via Klicker App
        <br />
        <br />
        Punkte für die BF-Champions Challenge (nur für eingeloggte User):
        <br />
        <br />
        <div className="pl-5">
          <li>
            Single-Choice Fragen: 10 BF-Champions Punkte für das korrekte
            Beantworten einer Frage während einer Microlearning-Session
          </li>
          <li>
            KPRIM Fragen: 10 BF-Champions Punkte für das korrekte Beantworten
            aller vier Aussagen während einer Microlearning-Session; 5
            BF-Champions Punkte für das korrekte Beantworten von drei Aussagen,
            ansonsten gibt es 0 Punkte für die Aufgabe
          </li>
          <li>
            Jeweils die Hälfte der BF-Champions Punkte für das wiederholte
            korrekte Beantworten einer Frage im OLAT (Punkte werden maximal jede
            Woche einmal vergeben)
          </li>
        </div>
      </div>
    </Layout>
  )
}

export default Microlearning
