import { H3 } from '@uzh-bf/design-system'
import DocsLayout from '../../../../components/docs/DocsLayout'

function AppSetup() {
  return (
    <DocsLayout>
      <H3>Klicker App</H3>
      Damit du von überall auf den Klicker zugreifen kannst, gibt’s die Klicker
      App. Die Klicker App hat den Vorteil gegenüber der Klicker Website, dass
      man Benachrichtigungen einstellen kann, wenn z.B. eine Session aktiv ist
      oder aber die neuen Microlearning Fragen verfügbar sind (manuell wählbar).
      Du kannst die App wie folgt einrichten:
      <br />
      <br />
      <ol style={{ listStyleType: 'decimal' }} className="pl-5">
        <li>
          Öffne{' '}
          <a
            className="font-bold text-uzh-turqoise-100"
            href="https://pwa.klicker.uzh.ch/login"
            target="_blank"
            rel="noreferrer"
          >
            https://pwa.klicker.uzh.ch/login
          </a>{' '}
          auf dem Handy.
        </li>
        <li>Logge dich ein.</li>
        <li>
          Es sollte nun eine Meldung erscheinen “Add to Homescreen” / “Zum
          Startbildschirm zufügen” – klicke darauf.
        </li>
        <li>Akzeptiere, dass die App installiert wird.</li>
        <li>Die Klicker App wird installiert.</li>
        <li>
          Die Benachrichtigungen (aktive Session oder neue Microlearning-Fragen)
          kannst du jetzt einzeln anwählen resp. aktivieren / deaktivieren.
        </li>
      </ol>
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
    </DocsLayout>
  )
}

export function getServerSideProps({ locale }: any) {
  return {
    props: {
      messages: {
        ...require(`shared-components/src/intl-messages/${locale}.json`),
      },
    },
  }
}

export default AppSetup
