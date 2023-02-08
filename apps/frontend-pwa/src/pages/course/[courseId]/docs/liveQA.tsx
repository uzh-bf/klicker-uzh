import CommonDocs from '@components/CommonDocs'
import Layout from '@components/Layout'
import { H3 } from '@uzh-bf/design-system'

function LiveQA() {
  return (
    <Layout courseName="KlickerUZH" displayName="Mein Profil">
      <CommonDocs />
      <div className="m-5 text-sm leading-relaxed md:m-0 md:w-full md:max-w-xxl md:p-8 md:mx-auto md:border md:rounded">
        <H3>Live Q&A und Real-Time Feedback</H3>
        Hast du eine Frage oder möchtest du Real-Time Feedback zur Vorlesung
        geben? Mit dem Live Q&A kannst den Dozierenden oder Assistierenden
        während der Vorlesung direkt deine Frage stellen - auch wenn du von zu
        Hause aus an der Vorlesung teilnimmst. Zudem hast du mit dem KlickerUZH
        die Möglichkeit, direkt während der Vorlesung den Dozierenden
        Rückmeldung zur Geschwindigkeit und dem Schwierigkeitsgrad der Vorlesung
        zu geben. Auch dafür ist <strong>kein Login</strong> notwendig.
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
        Punkte für die BF-Champions Challenge (nur für eingeloggte User): Für
        die Teilnahme am Q&A werden keine BF-Champions Punkte vergeben.
      </div>
    </Layout>
  )
}

export default LiveQA
