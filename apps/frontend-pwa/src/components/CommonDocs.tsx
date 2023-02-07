import { Dropdown } from '@uzh-bf/design-system'
import { useRouter } from 'next/router'

function CommonDocs() {
  const router = useRouter()
  return (
    <div>
      <div className="grid grid-cols-1 gap-4 m-8 mx-16 border-4 border-red-300">
        <div className="z-10 mt-0 border-4 border-blue-300">
          Der KlickerUZH wird dich während des gesamten Semesters durch die
          Vorlesung «Banking und Finance I» begleiten: Von der Teilnahme an
          Umfragen während der Vorlesung, dem Stellen von fachlichen Fragen im
          Rahmen des Q&A, dem Real-Time Feedback zur Vorlesung, über
          Repetitionsfragen in Rahmen des Microlearnings bis hin zu den
          Selbsttests in OLAT und dem Prüfungspool.
        </div>
        <div className="z-10 mt-0 border-4 border-blue-300">
          Bei Fragen, Anmerkungen oder Kritik kannst du dich jederzeit im extra
          dafür erstellten Support & Feedback Forum melden. Denn das Konzept ist
          brandneu und wir freuen uns über deinen Input. Details zur
          Installation und Nutzung der KlickerUZH-App findest du in folgendem
          Dokument:
          <br />
          <a
            className="font-bold"
            href="https://course-cms.sos-ch-dk-2.exo.io/Klicker_UZH_Anleitung_zur_App_Installation_1cad003132.pdf"
          >
            KlickerUZH - Anleitung zur App-Installation.pdf
          </a>
        </div>
      </div>
      <div className="flex flex-row justify-between gap-5 m-8 mx-16 border-4 border-red-300">
        <div className="border-2 border-blue-300">
          <Dropdown
            className={{ trigger: 'w-min-48 w-48 bg-white' }}
            trigger="Themenblock 1"
            items={[
              {
                label: 'Thema 1',
                onClick: () => router.replace('/docs/docs', '/docs/thema1'),
              },
              {
                label: 'Thema 2',
                onClick: () => router.replace('/docs/docs', '/docs/thema2'),
              },
              {
                label: 'Thema 3',
                onClick: () => router.replace('/docs/docs', '/docs/thema3'),
              },
            ]}
          />
        </div>
        <div className="border-2 border-blue-300">
          <Dropdown
            className={{ trigger: 'w-min-48' }}
            trigger="BF-Champions Challenge"
            items={[
              {
                label: 'BF-Champions Challenge',
                onClick: () => router.push('/docs/bf-champions-challenge'),
              },
              {
                label: 'Erstmaliges Login',
                onClick: () => router.push('/docs/login'),
              },
            ]}
          />
        </div>
        <div className="border-2 border-blue-300">
          <Dropdown
            className={{ trigger: 'w-48 w-min-48' }}
            trigger="Themenblock 3"
          />
        </div>
      </div>
    </div>
  )
}
export default CommonDocs
