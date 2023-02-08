import CommonDocs from '@components/CommonDocs'
import Layout from '@components/Layout'
import { H3 } from '@uzh-bf/design-system'

function Selbsttests() {
  return (
    <Layout>
      <CommonDocs />
      <div className="m-5 text-sm leading-relaxed md:m-0 md:w-full md:max-w-xl md:p-8 md:mx-auto md:border md:rounded">
        <H3>Selbsttests und Prüfungsvorbereitung OLAT</H3>
        Der KlickerUZH wird dich neu auch bei der Wissensüberprüfung in OLAT
        resp. der Prüfungsvorbereitung begleiten. Und zwar sind alle unsere
        OLAT-Selbsttests mit MC-Fragen zur Wissensüberprüfung direkt in den
        KlickerUZH integriert. Zudem werden wir dir einen gesamten MC-Fragen
        Pool zur Prüfungsvorbereitung zur Verfügung stellen (alle Fragen aus den
        Selbsttests sowie den Fragen aus dem Microlearning). Zum Beantworten der
        Fragen in OLAT ist <strong>kein Login</strong> notwendig.
        <br />
        <br />
        Teilnahme: Direkt in OLAT eingebunden
        <br />
        <br />
        Punkte für die BF-Champions Challenge (nur für eingeloggte User):
        <br />
        <br />
        <div className="pl-5">
          <li>
            Single-Choice Fragen: 10 BF-Champions Punkte für das korrekte
            Beantworten einer Frage
          </li>
          <li>
            KPRIM Fragen: 10 BF-Champions Punkte für das korrekte Beantworten
            aller vier Aussagen; 5 BF-Champions Punkte für das korrekte
            Beantworten von drei Aussagen, ansonsten gibt es 0 Punkte für die
            Aufgabe
          </li>
          <li>
            Die Hälfte der BF-Champions Punkte für das wiederholte korrekte
            Beantworten einer Frage (Punkte werden maximal jede Woche einmal
            vergeben)
          </li>
        </div>
      </div>
    </Layout>
  )
}

export default Selbsttests
