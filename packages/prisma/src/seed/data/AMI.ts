import Prisma from '@klicker-uzh/prisma'
const { AttachmentType, QuestionType, SessionStatus } = Prisma

export const PARTICIPANT_IDS = []

export const ATTACHMENTS = []

export const QUESTIONS = [
  {
    name: 'Modul 1 Finanz- und Realanlagen',
    content: 'Welche der folgenden Aussagen zu den *Finanz- und Realanlagen* ist *richtig*?',
    contentPlain: 'Welche der folgenden Aussagen zu den Finanz- und Realanlagen ist richtig?',
    type: QuestionType.SC,sss
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
        value:
          'Patente, Aktien und Obligationen sind Beispiele für Finanzanlagen.',
      },
      {
        feedback:
          'Korrekt!',
          correct: true,
        value: 'Wissen, Maschinen und Gebäude sind Beispiele für Realanlagen.',
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
    name: 'Modul 1 Investitionsprozess',
    content: 'Welche der folgenden Aussagen zum *Investment-Prozess* ist *falsch*?',
    contentPlain: 'Welche der folgenden Aussagen zum Investment-Prozess ist falsch?',
    type: QuestionType.SC,sss
    choices: [
      {
        feedback:
          'Falsch! Diese Aussage ist korrekt!',
        value:
          'Mit der Strategischen Asset Allocation wird entschieden, in welche Anlageklassen (Aktien, Bonds, Rohstoffe, etc.) welcher Anteil des Vermögens investiert wird.',
      },
      {
        feedback:
          'Falsch! Diese Aussage ist korrekt!',
        value:
          'Im Security Selection Prozess werden innerhalb der Anlageklassen die einzelnen Anlageinstrumente ausgewählt und das Portfolio erstellt.',
      },
      {
        feedback:
          'Korrekt! Diese Aussage ist nicht korrekt!  Die "Top-down" Portfoliokonstruktion beginnt mit der Asset Allocation und die "Bottom-up" mit der Titelselektion.',
          correct: true,
        value: 'Die "Bottom-up" Portfoliobildung startet mit der Strategischen Asset Allocation.',
      },
      {
        feedback:
          'Falsch! Diese Aussage ist korrekt!',
        value:
          'Die "Top-down" Portfoliobildung beinhaltet die Strategische und Taktische Asset Allocation gefolgt vom Security Selection Prozess.',
      },
      {
        feedback:
        'Falsch! Diese Aussage ist korrekt!',
        value:
          'Ein Nachteil der "Bottom-up" Strategie kann die fehlende Diversifikation eines Portfolios und das daraus erwachsende unsystematische Risiko sein.',
      },
    ],
  },
  {
    name: 'Modul 1 Bilanz',
    content:
      'Beurteile die folgenden Aussagen zur Bilanz auf ihre Richtigkeit:',
    contentPlain:
      'Beurteile die folgenden Aussagen zur Bilanz auf ihre Richtigkeit:',
    type: QuestionType.KPRIM,
    choices: [
      {
        feedback:
          'Diese Aussage ist nicht korrekt! Die Aktivseite zeigt die Mittelverwendung auf.',
        value: 'Die Aktivseite zeigt die Mittelherkunft auf.',
      },
      {
        feedback:
          'Diese Aussage ist nicht korrekt! Die Passivseite zeigt die Mittelherkunft auf.',
        value: 'Die Passivseite der Bilanz zeigt die Mittelverwendung auf.',
      },
      {
        feedback:
          'Diese Aussage ist nicht korrekt! Das EK zeigt zwar die Mittelherkunft auf, diese wird aber auf der Passivseite der Bilanz abgebildet.',
        value:
          'Das EK zeigt die Mittelherkunft auf und steht somit auf der Aktivseite der Bilanz.',
      },
      {
        feedback: 'Diese Aussage ist korrekt!',
        correct: true,
        value:
          'Das Konto Flüssige Mittel zeigt die Mittelverwendung auf und steht somit auf der Aktivseite der Bilanz.',
      },
    ],
  },
  {},
]

export const LEARNING_ELEMENTS = []

export const SESSIONS = []

export const MICRO_SESSIONS = []
