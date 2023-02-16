import { useQuery } from '@apollo/client'
import CommonDocs from '@components/CommonDocs'
import Layout from '@components/Layout'
import { GetCourseOverviewDataDocument } from '@klicker-uzh/graphql/dist/ops'
import Image from 'next/image'
import { useRouter } from 'next/router'

function Landing() {
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
      <div className="grid grid-cols-1 text-sm leading-relaxed md:w-full md:max-w-xxl md:p-8 md:mx-auto md:border md:rounded">
        <div className="m-5">
          Der KlickerUZH wird dich während des gesamten Semesters durch die
          Vorlesung «{data.getCourseOverviewData.course.name}» begleiten: Von
          der Teilnahme an Umfragen während der Vorlesung, dem Stellen von
          fachlichen Fragen im Rahmen des Q&A, dem Real-Time Feedback zur
          Vorlesung, über Repetitionsfragen in Rahmen des Microlearnings bis hin
          zu den Selbsttests in OLAT und dem Prüfungspool.
        </div>
        <div className="mx-5 md:w-full md:max-w-xl md:p-8 md:mx-auto md:rounded">
          <Image
            src="https://course-cms.sos-ch-dk-2.exo.io/Klicker_cfdb47ee12.PNG"
            alt="image of Klicker on different devices with functionality of features explained"
            width={1108}
            height={622}
          />
        </div>
        <div className="m-5">
          Bei Fragen, Anmerkungen oder Kritik kannst du dich jederzeit im extra
          dafür erstellten{' '}
          <a
            className="font-bold text-uzh-turqoise-100"
            href="https://lms.uzh.ch/url/RepositoryEntry/17250386251/CourseNode/106401872066650"
            target="_blank"
            rel="noreferrer"
          >
            Support & Feedback Forum
          </a>{' '}
          melden. Denn das Konzept ist brandneu und wir freuen uns über deinen
          Input.
          <br />
          <br />
          Details zur Installation und Nutzung der KlickerUZH-App findest du in
          folgendem Dokument:
          <br />
          <a
            className="font-bold text-uzh-turqoise-100"
            href="https://course-cms.sos-ch-dk-2.exo.io/Klicker_UZH_Anleitung_zur_App_Installation_1cad003132.pdf"
            target="_blank"
            rel="noreferrer"
          >
            KlickerUZH - Anleitung zur App-Installation.pdf
          </a>
        </div>
      </div>
    </Layout>
  )
}

export default Landing
