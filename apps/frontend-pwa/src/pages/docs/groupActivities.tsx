import CommonDocs from '@components/CommonDocs'
import Layout from '@components/Layout'
import { H3 } from '@uzh-bf/design-system'

function GroupActivities() {
  return (
    <Layout courseName="KlickerUZH" displayName="Mein Profil">
      <CommonDocs />
      <div className="m-5 text-sm leading-relaxed md:m-0 md:w-full md:max-w-xl md:p-8 md:mx-auto md:border md:rounded">
        <H3>Gruppenaktivitäten</H3>
        Während des Semesters werden euch praxisnahe Gruppenaktivitäten
        bereitgestellt, die ihr nur als Gruppe gemeinsam lösen könnt. Diese
        Aktivitäten sollen Spass machen, euch als Gruppe zusammen- resp.
        weiterbringen sowie die Anwendung von gewissen Theorien fördern.
        <br />
        <br />
        Die erste Gruppenaktivität wird unter dem Leaderboard deiner Gruppe nach
        der Vorlesung vom 7. November verfügbar sein. Die Gruppenaktivität wird
        vom 07.11.22 17:00 bis am 13.11.22 23:00 zur Abgabe zur Verfügung stehen
        und anschliessend durch uns bewertet. Anschliessend erhaltet ihr eure
        Bewertung und die entsprechende Anzahl Punkte auf euer Gruppenkonto
        gutgeschrieben (100 Punkte pro richtiger Antwort).
        <br />
        <br />
        Die gesammelten Punkte aus Gruppenaktivitäten ergeben zusammen mit den
        Punkten aller Gruppenmitglieder (aggregiert) die Punktzahl der
        Gesamtgruppe. Diese Punktzahl wird auf dem Gruppenleaderboard mit
        anderen Gruppen verglichen.
        <br />
        <br />
        Weitere Informationen findest du in folgendem Dokument:{' '}
        <a
          className="font-bold text-uzh-turqoise-100"
          href="https://course-cms.sos-ch-dk-2.exo.io/BFI_Woche_08_Gruppenquest_65e526acbd.pdf"
          target="_blank"
          rel="noreferrer"
        >
          BFI_Woche_08_Gruppenquest.pdf
        </a>
      </div>
    </Layout>
  )
}

export default GroupActivities
