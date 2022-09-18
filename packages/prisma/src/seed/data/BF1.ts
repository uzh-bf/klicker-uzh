import Prisma from '@klicker-uzh/prisma'
const { AttachmentType, QuestionType, SessionStatus } = Prisma

export const PARTICIPANT_IDS = []

export const ATTACHMENTS = []

export const QUESTIONS = [
  {
    id: 0,
    name: 'Zieldreieck',
    content: 'Welche der folgenden Aussagen ist **falsch**?',
    contentPlain: 'Welche der folgenden Aussagen ist falsch?',
    type: QuestionType.SC,
    choices: [
      {
        feedback:
          'Falsch! Zwischen den Zielsetzungen des klassischen finanziellen Zieldreiecks gibt es sowohl Zielkonflikte als auch Zielharmonien.',
        value:
          'Zwischen den Zielsetzungen des klassischen Zieldreiecks gibt es sowohl Zielkonflikte als auch Zielharmonien.',
      },
      {
        feedback:
          'Korrekt! Je höher die angestrebte Sicherheit, desto weniger Risiko wird eingegangen, was wiederum die Rentabilität senkt.',
        correct: true,
        value:
          'Das Ziel einer hohen Rentabilität erhöht auch die Sicherheit eines Unternehmens.',
      },
      {
        feedback:
          'Falsch! Die Unabhängigkeit ist kein Ziel des klassischen Zieldreiecks.',
        value: 'Unabhängigkeit ist *kein* Ziel des klassischen Zieldreiecks.',
      },
      {
        feedback:
          'Falsch! Eine hohe Liquidität steht im Zielkonflikt mit der Rentabilität, da Liquidität meist teuer ist.',
        value:
          'Eine hohe Liquidität steht im Zielkonflikt mit der Rentabilität, da Liquidität meist teuer ist.',
      },
      {
        feedback:
          'Falsch! Der Shareholder Value ist kein Ziel des klassischen Zieldreiecks.',
        value:
          'Der Shareholder Value ist *kein* Ziel des klassischen Zieldreiecks.',
      },
    ],
  },
  {
    id: 1,
    name: 'Organisation des Finanzwesens',
    content: 'Welche der folgenden Aussagen ist **falsch**?',
    contentPlain: 'Welche der folgenden Aussagen ist falsch?',
    type: QuestionType.SC,
    choices: [
      {
        feedback: 'Diese Aussage ist nicht korrekt!',
        value:
          'Die zentralen Tätigkeiten einer Finanzabteilung lassen sich in Finanzplanung, Finanzdisposition (d.h. die Realisierung der Finanzplanung) und Finanzcontrolling einteilen.',
      },
      {
        feedback: 'Diese Aussage ist nicht korrekt!',
        value:
          'Beim Controlling geht es grundsätzlich um die Überwachung des finanziellen Geschehens. Dies wird mit Hilfe eines Soll/Ist-Vergleichs der Finanzplanung gemacht.',
      },
      {
        feedback: 'Diese Aussage ist nicht korrekt!',
        value:
          'In grossen Firmen gibt es normalerweise neben dem CFO jeweils einen Controller und einen Treasurer.',
      },
      {
        feedback:
          'Diese Aussage ist korrekt! Die Kapitalbeschaffung ist Aufgabe des Treasurers.',
        correct: true,
        value:
          'Der Controller ist unter anderem für die Regelung der Ausgabe von Wertpapieren verantwortlich.',
      },
      {
        feedback: 'Diese Aussage ist nicht korrekt!',
        value:
          'Der Treasurer kümmert sich um das ganze Cash- und Credit-Management.',
      },
    ],
  },
  {
    id: 2,
    name: 'Stakeholder',
    content:
      'Welche der folgenden Personen/Gruppen sind **keine** Stakeholder?',
    contentPlain:
      'Welche der folgenden Personen/Gruppen sind keine Stakeholder?',
    type: QuestionType.SC,
    choices: [
      {
        feedback: 'Falsch! Beim Staat handelt es sich um einen Stakeholder.',
        value: 'Staat',
      },
      {
        feedback:
          'Falsch! Bei den Arbeitnehmern handelt es sich um Stakeholder.',
        value: 'Arbeitnehmer',
      },
      {
        feedback:
          'Falsch! Bei den Fremdkapitalgebern handelt es sich um Stakeholder.',
        value: 'Fremdkapitalgeber',
      },
      {
        feedback: 'Kunden',
        value: 'Falsch! Bei den Kunden handelt es sich um Stakeholder.',
      },
      {
        feedback: 'Korrekt! Alle genannten Personen/Gruppen sind Stakeholder.',
        correct: true,
        value:
          'Es handelt sich bei allen oben genannten Personen/Gruppen um Stakeholder.',
      },
    ],
  },
  {
    id: 3,
    name: 'Bilanz',
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
  {
    id: 4,
    name: 'Grundfunktionen des Fremdkapitals',
    content:
      'Welches sind Merkmale des Fremdkapitals? Beurteile die folgenden Aussagen auf ihre Richtigkeit:',
    contentPlain:
      'Welches sind Merkmale des Fremdkapitals? Beurteile die folgenden Aussagen auf ihre Richtigkeit:',
    type: QuestionType.KPRIM,
    choices: [
      {
        feedback:
          'Diese Aussage ist korrekt! Dritte stellen für eine bestimmte Zeitdauer Fremdkapital zur Verfügung.',
        correct: true,
        value: 'Gläubigerkapital',
      },
      {
        feedback:
          'Diese Aussage ist nicht korrekt! Dies ist eine Grundfunktion des Eigenkapitals.',
        value: 'Liquiditätssicherungsfunktion',
      },
      {
        feedback:
          'Diese Aussage ist korrekt! Fremdkapitalgeber haben in der Regel Anspruch auf Verzinsung und Rückzahlung des Kapitals zu einem vereinbarten Termin.',
        correct: true,
        value: 'Gewinnunabhängiges Kapitalentgelt',
      },
      {
        feedback:
          'Diese Aussage ist korrekt! Es gehört zur Außenfinanzierung bzw. Fremdfinazierung.',
        correct: true,
        value: 'Finanzierungsfunktion',
      },
    ],
  },
  {
    id: 5,
    name: 'Microlearning 1.1',
    content:
      'Welche der folgenden Aussagen zur **Interaktion zwischen Kapitalnehmer:innen und Kapitalgeber:innen** ist korrekt?',
    contentPlain:
      'Welche der folgenden Aussagen zur Interaktion zwischen Kapitalnehmer:innen und Kapitalgeber:innen ist korrekt?',
    type: QuestionType.SC,
    choices: [
      {
        correct: true,
        value:
          'Kapitalnehmer:innen und Kapitalgeber:innen interagieren via Finanzmärkte oder Finanzintermediäre miteinander.',
        feedback: 'Diese Aussage ist korrekt.',
      },
      {
        value: 'Haushalte gehören typischerweise zu den Kapitalnehmer:innen.',
        feedback:
          'Diese Aussage ist nicht korrekt. Haushalte gehören typischerweise zu den Kapitalgeber:innen, die sparen und ihr Erspartes bei Finanzintermediären anlegen oder via Finanzmärkte direkt in Kapitalnehmer:innen investieren.',
      },
      {
        value:
          'Kapitalgeber:innen haben typischerweise einen Finanzierungsbedarf, den sie selber nicht decken können.',
        feedback:
          'Diese Aussage ist nicht korrekt. Kapitalgeber:innen decken ihren eigenen Finanzierungsbedarf und leihen zusätzlich ihre Ersparnisse aus.',
      },
      {
        value:
          'Finanzintermediäre treten gegenüber Kapitalgeber:innen auf, nicht aber gegenüber Kapitalnehmer:innen.',
        feedback:
          'Diese Aussage ist nicht korrekt. Finanzintermediäre treten sowohl gegenüber Kapitalgeber:innen als auch Kapitalnehmer:innen auf.',
      },
      {
        value: 'Keine der Aussagen ist korrekt.',
        feedback:
          'Diese Aussage ist nicht korrekt. Eine der anderen Aussagen ist korrekt.',
      },
    ],
  },
  {
    id: 6,
    name: 'Microlearning 1.2',
    content:
      'Welcher der folgenden Entscheidungsbereiche ist **nicht** Teil in der **Corporate Finance**?',
    contentPlain:
      'Welcher der folgenden Entscheidungsbereiche ist nicht Teil in der Corporate Finance?',
    type: QuestionType.SC,
    choices: [
      {
        value: 'Investitionsfragen',
        feedback:
          'Diese Aussage ist nicht korrekt. Investitionsfragen gehören zur Corporate Finance.',
      },
      {
        value: 'Rückzahlung von Kapital',
        feedback:
          'Diese Aussage ist nicht korrekt. Die Rückzahlung von Kapital gehört zur Corporate Finance.',
      },
      {
        value: 'Finanzierungsfragen',
        feedback:
          'Diese Aussage ist nicht korrekt. Finanzierungsfragen gehören zur Corporate Finance.',
      },
      {
        value: 'Dividendenpolitik',
        feedback:
          'Diese Aussage ist nicht korrekt. Die Dividendenpolitik gehört zur Corporate Finance.',
      },
      {
        correct: true,
        value: 'Führung von Mitarbeiter:innen',
        feedback:
          'Diese Aussage ist korrekt. Die Führung von Mitarbeiter:innen ist traditionell Teil des Human Ressource Managements. Die Corporate Finance beschäftigt sich eher mit Fragestellungen im Bereich Finanzierung und Investitionen.',
      },
    ],
  },
  {
    id: 7,
    name: 'Microlearning 1.3',
    content:
      'Welche der folgenden Aussagen zum Aufbau einer **Bilanz** ist **korrekt**?',
    contentPlain:
      'Welche der folgenden Aussagen zum Aufbau einer Bilanz ist korrekt?',
    type: QuestionType.SC,
    choices: [
      {
        value:
          'Konten, welche die Kapitalbewirtschaftung zeigen, sind auf der Passivseite einer Bilanz zu finden.',
        feedback:
          'Diese Aussage ist nicht korrekt. Konten, welche die Kapitalbewirtschaftung zeigen, sind auf der Aktivseite der Bilanz abgebildet.',
      },
      {
        value: 'Eine Bilanz besteht aus einer Ertrags- und Passivseite.',
        feedback:
          'Diese Aussage ist nicht korrekt. Eine Bilanz besteht aus einer Aktiv- und Passivseite. Die Ertragskonten hingegen sind in der Erfolgsrechnung zu finden.',
      },
      {
        value:
          'Auf der Passivseite der Bilanz werden die Aktiven eines Unternehmens abgebildet.',
        feedback:
          'Diese Aussage ist nicht korrekt. Die Aktiven sind auf der Aktivseite der Bilanz zu finden.',
      },
      {
        correct: true,
        value: 'Das sogenannte Anlagevermögen zeigt den Kapitaleinsatz.',
        feedback: 'Diese Aussage ist korrekt.',
      },
      {
        value: 'Keine der Aussagen ist korrekt.',
        feedback:
          'Diese Aussage ist nicht korrekt. Eine der anderen Aussagen ist korrekt.',
      },
    ],
  },
  {
    id: 8,
    name: 'Microlearning 1.4',
    content:
      'Welche der folgenden Aussagen bezüglich des **finanzwirtschaftlichen Zieldreiecks** ist **korrekt**?',
    contentPlain:
      'Welche der folgenden Aussagen bezüglich des finanzwirtschaftlichen Zieldreiecks ist korrekt?',
    type: QuestionType.SC,
    choices: [
      {
        value:
          'Es kann nie mehr als eine Dimension des finanzwirtschaftlichen Zieldreiecks erfolgreich umgesetzt werden.',
        feedback:
          'Diese Aussage ist nicht korrekt. Den Zielen der Liquidität und Sicherheit kann beispielsweise gleichzeitig nachgegangen werden.',
      },
      {
        value:
          'Die Ziele des finanzwirtschaftlichen Zieldreiecks sind Liquidität, Sicherheit und Stabilität.',
        feedback:
          'Diese Aussage ist nicht korrekt. Die Ziele des finanzwirtschaftlichen Zieldreiecks sind Liquidität, Sicherheit und Rentabilität.',
      },
      {
        value:
          'Das Ziel der Sicherheit stellt die Priorität jedes Unternehmens dar.',
        feedback:
          'Diese Aussage ist nicht korrekt. Es gibt keine allgemeingültige Priorität, die für jedes Unternehmen gilt.',
      },
      {
        correct: true,
        value: 'Die Liquidität und Sicherheit begünstigen sich gegenseitig.',
        feedback: 'Diese Aussage ist korrekt.',
      },
      {
        value: 'Keine der Aussagen ist korrekt.',
        feedback:
          'Diese Aussage ist nicht korrekt. Eine der anderen Aussagen ist korrekt.',
      },
    ],
  },
  {
    id: 9,
    name: 'Jodel Woche 01',
    content: 'Wie oft benutzt du Jodel?',
    contentPlain: 'Wie oft benutzt du Jodel?',
    type: QuestionType.SC,
    choices: [
      {
        value: 'Ich schaue täglich rein und schreibe ab und zu einen Post.',
      },
      {
        value: 'Ich schaue täglich rein, aber poste nie selber.',
      },
      {
        value: 'Ab und zu.',
      },
      {
        value: 'Selten.',
      },
      {
        value: 'Was ist Jodel?',
      },
    ],
  },
]

export const LEARNING_ELEMENTS = [
  {
    id: '1f8178ab-a69a-4994-b292-5c56bea6defa',
    name: 'BF1 MC 1.1',
    displayName: 'BF1 - Test Modul 1.1',
    questions: [0, 1, 2, 3, 4],
  },
]

export const SESSIONS = [
  {
    id: 'd18dfa3b-a965-4dc3-985f-6695e8a43113',
    name: 'BF1 VL Woche 01',
    displayName: 'BF1 - Woche 01',
    status: SessionStatus.PREPARED,
    blocks: [{ questions: [9] }],
    linkTo: 'https://app.klicker.uzh.ch/join/bf1hs22',
  },
]

export const MICRO_SESSIONS = [
  {
    id: 'e3c71b0b-a8cf-43e9-8373-85a31673b178',
    name: 'BF1 Micro Woche 01',
    displayName: 'BF1 - Woche 01',
    scheduledStartAt: new Date('2022-09-14T07:00:00.000Z'),
    scheduledEndAt: new Date('2022-09-22T09:00:00.000Z'),
    description: `
### Einführung

![](https://sos-ch-dk-2.exo.io/klicker-prod/img/microlearning_bf1_1.png)

Was ist Corporate Finance? Gemäss Damodaran umfasst die Corporate Finance alle Entscheidungen von Unternehmen, die finanzielle Auswirkungen haben. Diese umfassen u.a. Investitionsentscheide, Finanzierungsentscheide oder Dividendenentscheide.

Du lernst zudem das finanzwirtschaftliche Zieldreieck kennen, bei dem sich die Rentabilität, Liquidität und Sicherheit einander gegenüber stehen. Zudem lernst du das oberste Ziel der unternehmerischen Tätigkeit kennen, nämlich die langfristige Maximierung des Unternehmenswertes.
`,
    questions: [5, 6, 7, 8],
  },
]
