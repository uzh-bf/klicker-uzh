import Prisma from '@klicker-uzh/prisma'
const { AttachmentType, QuestionType, SessionStatus } = Prisma

export const PARTICIPANT_IDS = []

export const ATTACHMENTS = []

export const QUESTIONS = [
  {
    id: 0,
    name: 'Modul 1 Finanz- und Realanlagen',
    content: 'Welche der folgenden Aussagen zu den *Finanz- und Realanlagen* ist *richtig*?',
    contentPlain: 'Welche der folgenden Aussagen zu den Finanz- und Realanlagen ist richtig?',
    type: QuestionType.SC,
    choices: [
      {
        feedback:
          'Falsch! Finanzanlagen tragen nur indirekt zur Produktionsleistung bei, beispielsweise bei einem Kauf von Sachwerten.',
        value:
          'Finanzanlagen tragen sowohl direkt als auch indirekt zur Produktionsleistung eines Landes bei.',
      },
      {
        feedback:
          'Falsch! Das Patent ist ein Beispiel für eine Realanlage.',
        value: 'Patente, Aktien und Obligationen sind Beispiele für Finanzanlagen.',
      },
      {
        feedback:
          'Korrekt!',
        correct: true,
        value:
          'Wissen, Maschinen und Gebäude sind Beispiele für Realanlagen.',
      },
      {
        feedback:
          'Falsch! Nur Realanlagen generieren das Nettoeinkommen einer Volkswirtschaft. Der finanzielle Wohlstand einer Gesellschaft ist abhängig von Sach- und nicht von den finanziellen Werten.',
        value:
          'Real- und Finanzanlagen generieren das Nettoeinkommen einer Volkswirtschaft.',
      },
      {
        feedback:
          'Falsch! Bei der Berechnung von Indizes wird zwischen Preisgewichteter und Marktwertgewichteter Index unterschieden. Kurs- und Performanceindex stellen lediglich Arten von Indizes dar.',
        value:
          'Die Berechnung der Aktienindizes wird anhand von Kurs- und Performanceindex getätigt.',
      },
    ],
  },
  {
    id: 1,
    name: 'Modul 1 Investitionsprozess',
    content: 'Welche der folgenden Aussagen zum *Investment-Prozess* ist *falsch*?',
    contentPlain: 'Welche der folgenden Aussagen zum Investment-Prozess ist falsch?',
    type: QuestionType.SC,
    choices: [
      {
        feedback:
          'Falsch! Diese Aussage ist korrekt.',
        value:
          'Mit der Strategischen Asset Allocation wird entschieden, in welche Anlageklassen (Aktien, Bonds, Rohstoffe, etc.) welcher Anteil des Vermögens investiert wird.',
      },
      {
        feedback:
          'Falsch! Diese Aussage ist korrekt.',
        value: 'Im Security Selection Prozess werden innerhalb der Anlageklassen die einzelnen Anlageinstrumente ausgewählt und das Portfolio erstellt.',
      },
      {
        feedback:
          'Korrekt! Die "Top-down" Portfoliokonstruktion beginnt mit der Asset Allocation und die "Bottom-up" mit der Titelselektion.',
        correct: true,
        value:
          'Die "Bottom-up" Portfoliobildung startet mit der Strategischen Asset Allocation.',
      },
      {
        feedback:
          'Falsch! Diese Aussage ist korrekt.',
        value:
          'Die "Top-down" Portfoliobildung beinhaltet die Strategische und Taktische Asset Allocation gefolgt vom Security Selection Prozess.',
      },
      {
        feedback:
          'Falsch! Diese Aussage ist korrekt.',
        value:
          'Ein Nachteil der "Bottom-up" Strategie kann die fehlende Diversifikation eines Portfolios und das daraus erwachsende unsystematische Risiko sein.',
      },
    ],
  },
  {
    id: 2,
    name: 'Modul 1 Index',
    content: 'Gehe von folgender Ausgangssituation aus: (Bild Modul 1 Index) Welche der folgenden Aussagen zu *Aktienindizes* ist *richtig*?',
    contentPlain: 'Gehe von folgender Ausgangssituation aus: (Bild Modul 1 Index) Welche der folgenden Aussagen zu Aktienindizes ist richtig?',
    type: QuestionType.SC,
    choices: [
      {
        feedback:
          'Korrekt! ($40+$70+$10)/3=$40.',
        correct: true,
        value:
          'Der Preis-gewichtete Index der drei Aktien beträgt $40.',
      },
      {
        feedback:
          'Falsch! Dies entspricht dem nach Marktwert gewichtetem Index.',
        value: 'Der Preis-gewichtete Index der drei Aktien beträgt $49`000.',
      },
      {
        feedback:
          'Falsch! Der nach Marktwert gewichtete Index beträgt: $40*200+$70*500+$10*600=$49`000.',
        value:
          'Der nach Marktwert gewichtete Index der drei Aktien beträgt $1`200.',
      },
      {
        feedback:
          'Falsch! Der nach Marktwert gewichtete Index beträgt: $40*200+$70*500+$10*600=$49`000.',
        value:
          'Der nach Marktwert gewichtete Index der drei Aktien beträgt $1`300.',
      },
      {
        feedback:
          'Falsch!',
        value:
          'Keine der genannten Aussagen ist richtig.',
      },
    ],
  },
  {
    id: 3,
    name: 'Modul 1 Aktienkauf mit Fremdkapital',
    content: 'Beurteile folgende Aussagen auf ihre *Richtigkeit*.',
    contentPlain: 'Beurteile folgende Aussagen auf ihre Richtigkeit.',
    type: QuestionType.KPRIM,
    choices: [
      {
        feedback: 'Diese Aussage ist nicht korrekt! Bei einem Aktienkauf mit Fremdkapital sind Renditechancen höher, jedoch steigt das Risiko mit.',
        value: 'Finanziert ein Investor seinen Wertschriftenkauf teilweise mit Fremdkapital, kann er nur bei einem Kurszerfall der Anlage profitieren.',
      },
      {
        feedback:'Diese Aussage ist korrekt!',
        correct: true,
        value: 'Bei Leerverkäufen verkauft ein Investor ein Wertpapier, welches nicht in seinem Besitz ist.',
      },
      {
        feedback: 'Diese Aussage ist nicht korrekt!',
        value: 'Die Initial Margin ist bei allen Aktientiteln immer gleich hoch und somit unabhängig von der Volatilität des Titels.',
      },
      {
        feedback: 'Diese Aussage ist nicht korrekt! Fällt der Betrag auf dem Margen-Konto unterhalb der Maintenance-Margin, so erhält der Anleger einen Margin-Call in dem er aufgefordert wird, einen Betrag auf das Margen-Konto zu überweisen, welcher den Saldo wieder auf die Initial-Margin anhebt.',
        value: 'Kommt es bei einem Investor zu einem Margin-Call, bedeutet dies, dass er den Betrag auf seinem Margenkonto wieder bis auf die Maintenance-Margin aufstocken muss. Ansonsten wird das Geschäft glattgestellt.',
      },
    ],
  },
  {
    id: 4,
    name: 'Modul 1 Aktienkauf mit Fremdkapital',
    content: 'Beurteile folgende Aussagen zum *Leerverkauf* auf ihre *Richtigkeit*.',
    contentPlain: 'Beurteile folgende Aussagen zum Leerverkauf auf ihre Richtigkeit.',
    type: QuestionType.KPRIM,
    choices: [
      {
        feedback: 'Diese Aussage ist korrekt!',
        correct: true,
        value: 'Ein Leerverkauf kann durch den Erwerb und Rückgabe der entsprechenden Aktie glattgestellt werden.',
      },
      {
        feedback:'Diese Aussage ist nicht korrekt! Bei einem Leerverkauf profitiert der Anleger von sinkenden Kursen.',
        value: 'Bei einem Leerverkauf profitiert der Anleger von steigenden Kursen.',
      },
      {
        feedback: 'Diese Aussage ist korrekt!',
        correct: true,
        value: 'Verkäufe von Wertpapieren, die sich gar nicht im Besitz des Verkäufers befinden, werden als Leerverkäufe bezeichnet.',
      },
      {
        feedback: 'Diese Aussage ist korrekt!',
        correct: true,
        value: 'Mit Leerverkäufen können vorhandene Investitionen abgesichert werden.',
      },
    ],
  },
  {
    id: 5,
    name: 'Modul 1 Anlageprozess',
    content: 'Überprüfe die folgenden Aussagen zum *Anlageprozess* auf ihre *Richtigkeit*.',
    contentPlain: 'Überprüfe die folgenden Aussagen zum Anlageprozess auf ihre Richtigkeit.',
    type: QuestionType.KPRIM,
    choices: [
      {
        feedback: 'Diese Aussage ist korrekt!',
        correct: true,
        value: 'Die Analyse der Bedürfnisse, die Ausarbeitung einer Strategie, die Umsetzung der Strategie und die Überwachung des Portfolios sind Bestandteile des Anlageprozesses.',
      },
      {
        feedback:'Diese Aussage ist korrekt!',
        correct: true,
        value: 'Das Ziel der Bedürfnisanalyse ist, ein Risiko-Renditeprofil des Kunden zu erstellen.',
      },
      {
        feedback: 'Diese Aussage ist nicht korrekt! Die Risikobereitschaft ist subjektiv, wobei die Risikofähigkeit objektiv ist.',
        value: 'Die Risikobereitschaft eines Kunden ist objektiv und daher messbar.',
      },
      {
        feedback: 'Diese Aussage ist korrekt!',
        correct: true,
        value: 'Bei der Ausarbeitung der Strategie wird die strategische und taktische Allokation erstellt.',
      },
    ],
  },
  
]

export const LEARNING_ELEMENTS = []

export const SESSIONS = []

export const MICRO_SESSIONS = []
