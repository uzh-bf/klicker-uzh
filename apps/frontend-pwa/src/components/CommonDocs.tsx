import { Navigation } from '@uzh-bf/design-system'
import Image from 'next/image'
import { useRouter } from 'next/router'

function CommonDocs() {
  const router = useRouter()
  return (
    <div>
      <div className="grid grid-cols-1 text-sm leading-relaxed md:w-full md:max-w-xl md:p-8 md:mx-auto md:border md:rounded">
        <div className="m-5">
          Der KlickerUZH wird dich während des gesamten Semesters durch die
          Vorlesung «Banking und Finance I» begleiten: Von der Teilnahme an
          Umfragen während der Vorlesung, dem Stellen von fachlichen Fragen im
          Rahmen des Q&A, dem Real-Time Feedback zur Vorlesung, über
          Repetitionsfragen in Rahmen des Microlearnings bis hin zu den
          Selbsttests in OLAT und dem Prüfungspool.
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
      <div className="m-5 md:m-0 md:w-full md:max-w-xl md:py-8 md:mx-auto">
        <Navigation className={{ root: 'w-full' }}>
          <Navigation.TriggerItem
            label="Getting Started"
            dropdownWidth="w-[11rem]"
          >
            <Navigation.DropdownItem
              title="Klicker App"
              onClick={() => router.push('/docs/klickerApp')}
            />
            <Navigation.DropdownItem
              title="Erstmaliges Login"
              onClick={() => router.push('/docs/login')}
            />
          </Navigation.TriggerItem>
          <Navigation.TriggerItem label="Features" dropdownWidth="w-[11rem]">
            <Navigation.DropdownItem
              title="Umfragen"
              onClick={() => router.push('/docs/umfragen')}
              className={{ root: 'text-center' }}
            />
            <Navigation.DropdownItem
              title="Live Q&A"
              onClick={() => router.push('/docs/liveQA')}
            />
            <Navigation.DropdownItem
              title="Gruppenaktivitäten"
              onClick={() => router.push('/docs/groupActivities')}
            />
            <Navigation.DropdownItem
              title="Microlearning"
              onClick={() => router.push('/docs/microlearning')}
            />
            <Navigation.DropdownItem
              title="Selbsttests"
              onClick={() => router.push('/docs/selbsttests')}
            />
          </Navigation.TriggerItem>
        </Navigation>
      </div>
    </div>
  )
}
export default CommonDocs
