import { useQuery } from '@apollo/client'
import CommonDocs from '@components/CommonDocs'
import Layout from '@components/Layout'
import { GetCourseOverviewDataDocument } from '@klicker-uzh/graphql/dist/ops'
import { H3 } from '@uzh-bf/design-system'
import { useRouter } from 'next/router'

function Umfragen() {
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
      <div className="m-5 text-sm leading-relaxed md:m-0 md:w-full md:max-w-xxl md:mx-auto md:p-8 md:border md:rounded">
        <H3>Teilnahme an Umfragen während der Vorlesung</H3>
        Während der Lehrveranstaltung hast du die Möglichkeit mit Laptop,
        Smartphone oder Tablet die von den Dozierenden gestellten Fragen auf{' '}
        <a
          className="font-bold text-uzh-turqoise-100"
          href={`https://pwa.klicker.uzh.ch/join/${data.getCourseOverviewData?.course.name}`}
          target="_blank"
          rel="noreferrer"
        >
          https://pwa.klicker.uzh.ch/join/
          {data.getCourseOverviewData?.course.name}
        </a>{' '}
        oder hier im OLAT unter{' '}
        <a
          className="font-bold text-uzh-turqoise-100"
          href="https://lms.uzh.ch/url/RepositoryEntry/17250386251/CourseNode/106401873776902"
          target="_blank"
          rel="noreferrer"
        >
          live Session
        </a>{' '}
        anonym zu beantworten. Die Resultate werden ohne Zeitverzug grafisch
        aufbereitet angezeigt und können so nach Abschluss der Beantwortungszeit
        vom Dozierenden präsentiert und kommentiert werden.
        <br />
        <br />
        Zum Beantworten der Fragen ist <strong>kein Login</strong> notwendig,
        aber mit Login kannst du an der BF-Champions Challenge teilnehmen und in
        allen Aktivitäten wertvolle Punkte sammeln.
        <br />
        <br />
        Teilnahme:
        <a
          className="font-bold text-uzh-turqoise-100"
          href="https://pwa.klicker.uzh.ch/join/bf1hs22"
          target="_blank"
          rel="noreferrer"
        >
          https://pwa.klicker.uzh.ch/join/bf1hs22
        </a>{' '}
        oder via Klicker App (Anleitung folgt)
        <br />
        <br />
        Punkte für die BF-Champions Challenge (nur für eingeloggte User):
        <br />
        <br />
        <div className="pl-5">
          <li>
            10 BF-Champions Punkte für das Abstimmen bei einer KlickerUZH-Frage
            (irrelevant, ob du korrekt oder nicht korrekt antwortest sowie für
            Fragen, welche keine klare Lösung haben)
          </li>
          <li>
            Zusätzlich erhältst du - für korrekt beantwortete Fragen - abhängig
            von deiner Beantwortungszeit zusätzliche BF-Champions Punkte.
          </li>
        </div>
      </div>
    </Layout>
  )
}

export default Umfragen
