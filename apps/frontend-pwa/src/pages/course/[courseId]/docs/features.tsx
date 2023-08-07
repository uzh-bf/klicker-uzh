import { Markdown } from '@klicker-uzh/markdown'
import DocsLayout from '../../../../components/docs/DocsLayout'

function Features() {
  return (
    <DocsLayout>
      {(courseInformation) => (
        <Markdown
          className={{ root: 'prose-headings:mt-0' }}
          content={`
### Funktionen im KlickerUZH

Der KlickerUZH bietet Ihnen als Kursteilnehmenden einige Funktionen. Diese Übersicht fasst die Wichtigsten davon zusammen. Die konkret verfügbaren Funktionen hängen von den Einstellungen Ihrer Dozierenden ab (z.B., ob Gruppenaktivitäten oder eine Challenge zur Verfügung stehen) und werden Ihnen direkt von den Dozierenden kommuniziert.

#### Umfragen und Live Quizzes

Während der Lehrveranstaltung haben Sie die Möglichkeit, die von den Dozierenden gestellten Fragen auf [${process.env.NEXT_PUBLIC_PWA_URL}/join/${courseInformation.owner.shortname}](${process.env.NEXT_PUBLIC_PWA_URL}/join/${courseInformation.owner.shortname})  oder in der KlickerUZH-App (oder, falls vorhanden, im OLAT unter dem Baustein "Live Session") zu beantworten. Die Resultate werden ohne Zeitverzug grafisch aufbereitet angezeigt und können so nach Abschluss der Beantwortungszeit von den Dozierenden präsentiert und kommentiert werden.

Zum Beantworten der Fragen ist kein Login notwendig. Mit einem Login können Sie an der Challenge Ihres Kurses teilnehmen und Punkte sammeln.

#### Live Q&A und Real-time Feedback

Haben Sie eine Frage oder möchten Sie direktes Feedback zur Vorlesung geben? Mit dem Live Q&A können Sie den Dozierenden oder Assistierenden während der Vorlesung direkt eine Frage stellen - auch wenn Sie von zu Hause aus an der Vorlesung teilnehmen. Zudem haben Sie mit dem KlickerUZH die Möglichkeit, direkt während der Vorlesung den Dozierenden Rückmeldung zur Geschwindigkeit und dem Schwierigkeitsgrad der Vorlesung zu geben.

Die Teilnahme ist unter [${process.env.NEXT_PUBLIC_PWA_URL}/join/${courseInformation.owner.shortname}](${process.env.NEXT_PUBLIC_PWA_URL}/join/${courseInformation.owner.shortname}) (auch anonym) oder via KlickerUZH-App möglich.

#### Lernelemente und Micro-Sessions

Lernelemente und Micro-Sessions erlauben Ihnen, die Kursinhalte ausserhalb der Vorlesungszeit zu repetieren und direktes Feedback auf Ihre Lösung zu erhalten. Lernelemente sind immer und beliebig oft verfügbar, Micro-Sessions hingegen nur einmalig und in einem eingeschränkten Zeitrahmen (z.B., einmal pro Woche). Alle Elemente sind direkt über die KlickerUZH-App zugänglich, oder über den von Ihren Dozierenden bereitgestellten Link (auch anonym).

Während der Beantwortung der Fragen können Sie, bei vorhandenem Log-in, persönliche Lesezeichen auf wichtigen Fragen setzen, und sich so Ihren eigenen Fragepool zusammenstellen. Feedbacks zu unklaren Fragen können Sie Ihren Dozierenden mittels der Melden-Funktion zukommen lassen.

#### Gruppen und Gruppenaktivitäten

Während des Semesters werden Ihnen praxisnahe Gruppenaktivitäten bereitgestellt, die Sie nur als Gruppe gemeinsam lösen können. Diese Aktivitäten sollen unterhaltsam sein, den Austausch mit Kommilitonen fördern, sowie die Anwendung von Theorien unterstützen. Das Bilden einer Gruppe von 2-5 Personen ist während der ersten 4 Wochen eines Kurses möglich. Danach bleibt die Gruppe während dem Semester bestehen und tritt gegen die anderen Gruppen in derselben Kohorte an. Gruppenaktivitäten sind nur für Teilnehmende mit KlickerUZH-Konto verfügbar.

Innerhalb einer Gruppe können Sie Ihre Punkte mit denen Ihrer Kommilitonen vergleichen; gemeinsam können Sie die Gruppenleistung auch mit anderen Gruppen vergleichen. Die gesammelten Punkte aus Gruppenaktivitäten ergeben zusammen mit den aggregierten Punkten aller Gruppenmitglieder (Durchschnitt) die Punktzahl der Gesamtgruppe.

#### Challenge

Alle Aktivitäten im KlickerUZH werden, falls von den Dozierenden aktiviert, in einer Challenge zusammengefasst. Im Rahmen der Challenge sammeln Sie mit allen Lernaktivitäten Punkte für das Kursleaderboard (wenn Sie eingeloggt teilnehmen).

Die folgenden Aktivitäten werden in die Challenge einbezogen:

- Umfragen und Live Quizzes: 10 Punkte pro Teilnahme an einer offenen Abstimmung (ohne Lösung), bis zu 70 Bonuspunkte für eine schnelle und richtige Antwort auf inhaltliche Fragen. Die schnellste korrekte Antwort erhält am meisten Punkte.
- Lernelemente: 10 Punkte, wenn die Erstbeantwortung einer Frage korrekt ist. 5 Punkte für jede weitere korrekte Repetition einer Frage (nach Ablauf der angegebenen Sperrzeit). Bei KPRIM ergibt ein Fehler eine Halbierung der Punktzahl.
- Micro-Sessions: 10 Punkte pro korrekt beantworteter Frage in einer Micro-Session. Bei KPRIM ergibt ein Fehler eine Halbierung der Punktzahl.
- Gruppenaktivitäten: 1000 Punkte auf das individuelle Leaderboard für jedes Gruppenmitglied beim Bestehen einer Gruppenaktivität.
- Achievements: Gesammelte Achievements (z.B., Erreichen des ersten Platzes in einem Live-Quiz) ergeben Bonuspunkte, wie auf den entsprechenden Achievements vermerkt.

Falls Multiplikatoren auf den Aktivitäten aktiviert sind, werden diese Multiplikatoren auf die Punktezahl angewendet.
`}
        />
      )}
    </DocsLayout>
  )
}

export function getServerSideProps({ locale }: any) {
  return {
    props: {
      messages: {
        ...require(`@klicker-uzh/shared-components/src/intl-messages/${locale}.json`),
      },
    },
  }
}

export default Features
