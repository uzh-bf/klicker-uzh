import { Markdown } from '@klicker-uzh/markdown'
import { GetStaticPropsContext } from 'next'
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

Weitere Details zur Installation und Nutzung der KlickerUZH-App finden Sie in folgendem Dokument (Deutsch):

[KlickerUZH_Anleitung_OLAT.pdf](https://sos-ch-dk-2.exo.io/klicker-prod/klicker_anleitung_app.pdf)


        `}
        />
      )}
    </DocsLayout>
  )
}

export async function getStaticProps({ locale }: GetStaticPropsContext) {
  return {
    props: {
      messages: (
        await import(
          `@klicker-uzh/shared-components/src/intl-messages/${locale}.json`
        )
      ).default,
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
