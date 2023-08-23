import { Markdown } from '@klicker-uzh/markdown'
import { GetServerSidePropsContext } from 'next'
import DocsLayout from '../../../../components/docs/DocsLayout'

function Login() {
  return (
    <DocsLayout>
      {(courseInformation) => (
        <Markdown
          withProse
          className={{ root: 'prose-headings:mt-0' }}
          content={`
### Erstmaliges Login und Profileinrichtung

Wenn Sie das erste Mal an Aktivitäten im KlickerUZH teilnehmen, können Sie Sich einmalig für die KlickerUZH-App registrieren. Ein KlickerUZH-Konto ermöglicht Ihnen eine einfache und kursübergreifende Verwaltung und Zugriff auf die Lerninhalte Ihrer Kurse (die KlickerUZH verwenden), sowie das Hinzufügen von für Sie wichtigen Elementen in Ihre private Repetitionsbibliothek und die Teilnahme an den gamifizierten Elementen (Challenge). Dabei können Sie, je nach Organisation Ihres Kurses, wie folgt vorgehen:

#### Kurse mit LMS-Integration (z.B., OLAT)

Öffnen Sie im OLAT-Kurs Ihrer Vorlesung den Baustein KlickerUZH. Sie werden, wenn noch kein KlickerUZH-Konto für Sie existiert, von einer
Willkommensseite begrüsst. Auf dieser Seite setzen Sie einen (anonymen) Nutzernamen und ein Passwort, sowie Ihren persönlichen Avatar.

![](https://sos-ch-dk-2.exo.io/klicker-prod/img/klicker_profile_setup.png)

Eine detailliertere Anleitung finden Sie in folgendem Dokument (Deutsch): [KlickerUZH_Anleitung_OLAT.pdf](https://sos-ch-dk-2.exo.io/klicker-prod/klicker_anleitung_olat.pdf)

#### Kurse ohne LMS-Integration

Falls Sie bereits ein KlickerUZH-Konto besitzen (z.B., aus anderen Kursen), öffnen Sie die KlickerUZH-App und klicken Sie unterhalb der Kursübersicht auf "Kurs beitreten". Geben Sie dort den 9-stelligen PIN ein, den Sie von Ihren Dozierenden erhalten haben. Sie sind anschliessen Teil des Kurses und können an allen Aktivitäten teilnehmen.

![](https://sos-ch-dk-2.exo.io/klicker-prod/img/klicker_join_existing.png)

Wenn Sie das erste Mal an einem Kurs mit dem KlickerUZH teilnehmen, öffnen Sie den Beitritts-Link, den Sie von den Dozierenden Ihres Kurses erhalten haben (z.B., _${process.env.NEXT_PUBLIC_PWA_URL}/course/XYZ/join?pin=111111111_). Darüber erstellen Sie ein neues KlickerUZH-Konto mit einem (anonymen) Nutzernamen und einem Passwort. Mit diesen Daten können Sie sich anschliessend einloggen und Ihren persönlichen Avatar erstellen, sowie an Aktivitäten teilnehmen.

![](https://sos-ch-dk-2.exo.io/klicker-prod/img/klicker_join_neu.png)

#### Anonyme Teilnahme

Generell ist es bei allen Elementen im KlickerUZH auch möglich, anonym teilzunehmen. Bei Live-Sessions finden Sie diese für Ihren Kurs unter [${process.env.NEXT_PUBLIC_PWA_URL}/join/${courseInformation.owner.shortname}](${process.env.NEXT_PUBLIC_PWA_URL}/join/${courseInformation.owner.shortname}). Lernelemente und Micro-Sessions sind über direkte Links verfügbar, die Sie von Ihren Dozierenden erhalten können. Beim Zugriff auf den KlickerUZH über die OLAT-Integration wird automatisch ein Konto für Sie erstellt.

`}
        />
      )}
    </DocsLayout>
  )
}

export async function getStaticProps({ locale }: GetServerSidePropsContext) {
  return {
    props: {
      messages: (await import(`@klicker-uzh/i18n/messages/${locale}`)).default,
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

export default Login
