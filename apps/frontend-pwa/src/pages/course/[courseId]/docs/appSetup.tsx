import { Markdown } from '@klicker-uzh/markdown'
import DocsLayout from '../../../../components/docs/DocsLayout'

function AppSetup() {
  return (
    <DocsLayout>
      {(courseInformation) => (
        <Markdown
          className={{ root: 'prose-headings:mt-0' }}
          content={`
### Installation der KlickerUZH-App

Damit Sie von überall auf den Klicker zugreifen können, gibt es die KlickerUZH-App. Die App ermöglicht Ihnen eine einfache und kursübergreifende Verwaltung und Zugriff auf die Lerninhalte Ihrer Kurse (die KlickerUZH verwenden), sowie das Hinzufügen von für Sie wichtigen Elementen in Ihre private Repetitionsbibliothek und die Teilnahme an den gamifizierten Elementen (Challenge). Ausserdem können Sie (auf Android) die Push-Benachrichtigungen für Micro-Sessions in Ihren Kursen aktivieren.

Sie können die KlickerUZHApp wie folgt einrichten:

1. Öffnen Sie [${process.env.NEXT_PUBLIC_PWA_URL}/login](${process.env.NEXT_PUBLIC_PWA_URL}/login) auf dem Smartphone.
2. Es sollte eine Meldung erscheinen “Add to Homescreen” / “Zum Startbildschirm zufügen” – klicken Sie darauf.
3. Akzeptieren Sie, dass die App installiert wird. Sobald die App installiert ist, sollten Sie darin zum Log-in weitergeleitet werden. Ausserdem finden Sie neu ein KlickerUZH-Icon auf Ihrem Homescreen oder im App-Drawer.
4. Die Benachrichtigungen für neue Microlearning-Fragen können Sie jetzt für einzelne Kurse anwählen resp. aktivieren / deaktivieren.

Weitere Details zur Installation und Nutzung der KlickerUZH-App finden Sie in folgendem Dokument:
KlickerUZH - Anleitung zur App-Installation.pdf

        `}
        />
        // <H3>Klicker App</H3>
        // Damit du von überall auf den Klicker zugreifen kannst, gibt’s die Klicker
        // App. Die Klicker App hat den Vorteil gegenüber der Klicker Website, dass
        // man Benachrichtigungen einstellen kann, wenn z.B. eine Session aktiv ist
        // oder aber die neuen Microlearning Fragen verfügbar sind (manuell wählbar).
        // Du kannst die App wie folgt einrichten:
        // <br />
        // <br />
        // <ol style={{ listStyleType: 'decimal' }} className="pl-5">
        //   <li>
        //     Öffne{' '}
        //     <a
        //       className="font-bold text-uzh-turqoise-100"
        //       href="https://pwa.klicker.uzh.ch/login"
        //       target="_blank"
        //       rel="noreferrer"
        //     >
        //       https://pwa.klicker.uzh.ch/login
        //     </a>{' '}
        //     auf dem Handy.
        //   </li>
        //   <li>Logge dich ein.</li>
        //   <li>
        //     Es sollte nun eine Meldung erscheinen “Add to Homescreen” / “Zum
        //     Startbildschirm zufügen” – klicke darauf.
        //   </li>
        //   <li>Akzeptiere, dass die App installiert wird.</li>
        //   <li>Die Klicker App wird installiert.</li>
        //   <li>
        //     Die Benachrichtigungen (aktive Session oder neue Microlearning-Fragen)
        //     kannst du jetzt einzeln anwählen resp. aktivieren / deaktivieren.
        //   </li>
        // </ol>
        // <br />
        // Details zur Installation und Nutzung der KlickerUZH-App findest du in
        // folgendem Dokument:
        // <br />
        // <a
        //   className="font-bold text-uzh-turqoise-100"
        //   href="https://course-cms.sos-ch-dk-2.exo.io/Klicker_UZH_Anleitung_zur_App_Installation_1cad003132.pdf"
        //   target="_blank"
        //   rel="noreferrer"
        // >
        //   KlickerUZH - Anleitung zur App-Installation.pdf
        // </a>
      )}
    </DocsLayout>
  )
}

export function getStaticProps({ locale }: any) {
  return {
    props: {
      messages: {
        ...require(`shared-components/src/intl-messages/${locale}.json`),
      },
    },
    revalidate: 600,
  }
}

export function getStaticPaths() {
  return {
    paths: [],
    fallback: 'blocking',
  }
}

export default AppSetup
