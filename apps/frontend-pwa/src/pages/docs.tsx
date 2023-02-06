import { Dropdown } from '@uzh-bf/design-system'

function Docs() {
  return (
    <div>
      <div className="flex flex-row justify-between gap-5 m-8 mx-16 border-4 border-red-300">
        <div className="border-2 border-blue-300">
          <Dropdown
            trigger="Themenblock 1"
            items={[
              {
                label: 'Thema 1',
                onClick: () => alert('Element 1 clicked'),
              },
              {
                label: 'Thema 2',
                onClick: () => alert('Element 2 clicked'),
              },
              {
                label: 'Thema 3',
                onClick: () => alert('Element 3 clicked'),
              },
            ]}
          />
        </div>
        <div className="border-2 border-blue-300">
          <Dropdown trigger="Themenblock 2" />
        </div>
        <div className="border-2 border-blue-300">
          <Dropdown trigger="Themenblock 3" />
        </div>
      </div>
      <div className="z-10 mx-16 mt-0 border-4 border-red-300">
        Der KlickerUZH wird dich während des gesamten Semesters durch die
        Vorlesung «Banking und Finance I» begleiten: Von der Teilnahme an
        Umfragen während der Vorlesung, dem Stellen von fachlichen Fragen im
        Rahmen des Q&A, dem Real-Time Feedback zur Vorlesung, über
        Repetitionsfragen in Rahmen des Microlearnings bis hin zu den
        Selbsttests in OLAT und dem Prüfungspool.
      </div>
      {/* <Image
        alt="KlickerUZH App on different devices"
        src="https://course-cms.sos-ch-dk-2.exo.io/Klicker_cfdb47ee12.PNG"
        width={200}
        height={90}
      /> */}
      <div className="z-10 mx-16 mt-0 border-4 border-red-300">
        Bei Fragen, Anmerkungen oder Kritik kannst du dich jederzeit im extra
        dafür erstellten Support & Feedback Forum melden. Denn das Konzept ist
        brandneu und wir freuen uns über deinen Input. Details zur Installation
        und Nutzung der KlickerUZH-App findest du in folgendem Dokument:
        <br />
        <a
          className="font-bold"
          href="https://course-cms.sos-ch-dk-2.exo.io/Klicker_UZH_Anleitung_zur_App_Installation_1cad003132.pdf"
        >
          KlickerUZH - Anleitung zur App-Installation.pdf
        </a>
      </div>
    </div>
  )
}
export default Docs
