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
    name: 'Modul 1 Index',
    content: 'Gehe von folgender Ausgangssituation aus:
              (Bild Modul 1 Index)
              Welche der folgenden Aussagen zu *Aktienindizes* ist *richtig*?',
    contentPlain: 'Gehe von folgender Ausgangssituation aus:
                  (Bild Modul 1 Index)
                  Welche der folgenden Aussagen zu Aktienindizes ist richtig?',
    type: QuestionType.SC,sss
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
        value:
          'Der Preis-gewichtete Index der drei Aktien beträgt $49`000',
      },
      {
        feedback:
          'Falsch! Der nach Marktwert gewichtete Index beträgt: $40*200+$70*500+$10*600=$49`000.',
        value: 'Der nach Marktwert gewichtete Index der drei Aktien beträgt $1`200.',
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
    name: 'Modul 1 Aktienkauf mit Fremdkapital',
    content:
      'Beurteile die folgenden Aussagen auf ihre *Richtigkeit*:',
    contentPlain:
      'Beurteile die folgenden Aussagen auf ihre Richtigkeit:',
    type: QuestionType.KPRIM,
    choices: [
      {
        feedback:
          'Diese Aussage ist nicht korrekt! Bei einem Aktienkauf mit Fremdkapital sind Renditechancen höher, jedoch steigt das Risiko mit.',
        value: 'Finanziert ein Investor seinen Wertschriftenkauf teilweise mit Fremdkapital, kann er nur bei einem Kurszerfall der Anlage profitieren.',
      },
      {
        feedback: 'Diese Aussage ist korrekt!',
        correct: true,
        value:
          'Bei Leerverkäufen verkauft ein Investor ein Wertpapier, welches nicht in seinem Besitz ist.',
      },
      {
        feedback:
          'Diese Aussage ist nicht korrekt!',
        value: 'Die Initial Margin ist bei allen Aktientiteln immer gleich hoch und somit unabhängig von der Volatilität des Titels.',
      },
      {
        feedback:
          'Fällt der Betrag auf dem Margen-Konto unterhalb der Maintenance-Margin, so erhält der Anleger einen Margin-Call in dem er aufgefordert wird, einen Betrag auf das Margen-Konto zu überweisen, welcher den Saldo wieder auf die Initial-Margin anhebt.',
        value:
          'Kommt es bei einem Investor zu einem Margin-Call, bedeutet dies, dass er den Betrag auf seinem Margenkonto wieder bis auf die Maintenance-Margin aufstocken muss. Ansonsten wird das Geschäft glattgestellt.',
      },
    ],
  },
  {
    name: 'Modul 1 Leerverkauf',
    content:
      'Beurteile folgende Aussagen zum *Leerverkauf* auf ihre *Richtigkeit*:',
    contentPlain:
      'Beurteile folgende Aussagen zum Leerverkauf auf ihre Richtigkeit:',
    type: QuestionType.KPRIM,
    choices: [
      {
        feedback: 'Diese Aussage ist korrekt!',
        correct: true,
        value: 'Ein Leerverkauf kann durch den Erwerb und Rückgabe der entsprechenden Aktie glattgestellt werden.',
      },
      {
        feedback:
          'Diese Aussage ist nicht korrekt! Bei einem Leerverkauf profitiert der Anleger von sinkenden Kursen.',
        value: 'Bei einem Leerverkauf profitiert der Anleger von steigenden Kursen.',
      },
      {
        feedback: 'Diese Aussage ist korrekt!',
        correct: true,
        value:
          'Verkäufe von Wertpapieren, die sich gar nicht im Besitz des Verkäufers befinden, werden als Leerverkäufe bezeichnet.',
      },
      {
        feedback: 'Diese Aussage ist korrekt!',
        correct: true,
        value:
          'Mit Leerverkäufen können vorhandene Investitionen abgesichert werden.',
      },
    ],
  },
  name: 'Modul 1 Anlageprozess',
  content:
    'Beurteile folgende Aussagen zum *Anlageprozess* auf ihre *Richtigkeit*:',
  contentPlain:
    'Beurteile die folgende Aussagen zum Anlageprozess auf ihre Richtigkeit:',
  type: QuestionType.KPRIM,
  choices: [
    {
      feedback: 'Diese Aussage ist korrekt!',
      correct: true,
      value: 'Die Analyse der Bedürfnisse, die Ausarbeitung einer Strategie, die Umsetzung der Strategie und die Überwachung des Portfolios sind Bestandteile des Anlageprozesses.',
    },
    {
    feedback: 'Diese Aussage ist korrekt!',
    correct: true,
    value:
      'Das Ziel der Bedürfnisanalyse ist, ein Risiko-Renditeprofil des Kunden zu erstellen.',
    },
    {
      feedback:
        'Diese Aussage ist nicht korrekt! Die Risikobereitschaft ist subjektiv, wobei die Risikofähigkeit objektiv ist.',
      value: 'Die Risikobereitschaft eines Kunden ist objektiv und daher messbar.',
    },
    {
      feedback: 'Diese Aussage ist korrekt!',
      correct: true,
      value:
        'Bei der Ausarbeitung der Strategie wird die strategische und taktische Allokation erstellt.',
    },
    {
      name: 'Modul 1 Treiber für Zinsen',
      content: 'Welcher der folgenden Faktoren hat *keinen direkten Einfluss* auf das *Zinsniveau*?',
      contentPlain: 'Welcher der folgenden Faktoren hat keinen direkten Einfluss auf das Zinsniveau?',
      type: QuestionType.SC,sss
      choices: [
        {
          feedback:
            'Falsch! Das Angebot von Finanzierungsmitteln durch die Zentralbank hat einen direkten Einfluss auf das Zinsniveau.',
          value:
            'Das Angebot von Finanzierungsmitteln durch die Zentralbank.',
        },
        {
          feedback:
            'Falsch! Die Nachfrage nach liquiden Mitteln durch die Zentralbank hat einen direkten Einfluss auf das Zinsniveau.',
          value:
            'Die Nachfrage nach liquiden Mitteln durch die Zentralbank.',
        },
        {
          feedback:
            'Falsch! Die Nachfrage der Industrie nach Finanzierungsmitteln für geplante Investitionen hat einen direkten Einfluss auf das Zinsniveau.',
          value:
            'Die Nachfrage der Industrie nach Finanzierungsmitteln für geplante Investitionen.',
        },
        {
          feedback:
            'Falsch! Die von Sparern auf Bankkonten gehaltenen Gelder haben einen direkten Einfluss auf das Zinsniveau.',
          value:
            'Die von Sparern auf Bankkonten gehaltenen Gelder.',
        },
        {
          feedback:
            'Korrekt!  Die von Staat erhobenen Steuern können zwar von der Zinskurve abhängig sein, aber nicht umgekehrt. Wenn das Staatsdefizit günstig über den Kapitalmarkt ausgeglichen werden kann, hat der Staat keinen Anreiz die Steuern massiv zu erhöhen. Ist die Überbrückung des Staatsdefizites aufgrund der Zinslage teuer, wird der Staat zwar eher die Steuern erhöhen (um das Staatsdefizit nicht über den Kapitalmarkt finanzieren zu müssen), jedoch hat ein Land mit höheren Steuern nicht unbedingt höhere Zinsen.',
            correct: true,
          value: 'Die Nachfrage des Staates nach Steuergeldern.',
        },
        {
      name: 'Modul 1 Treiber für Zinsen',
      content: 'Welcher der folgenden Faktoren hat *keinen direkten Einfluss* auf das *Zinsniveau*?',
      contentPlain: 'Welcher der folgenden Faktoren hat keinen direkten Einfluss auf das Zinsniveau?',
      type: QuestionType.SC,sss
      choices: [
        {
          feedback:
            'Falsch! Das Angebot von Finanzierungsmitteln durch die Zentralbank hat einen direkten Einfluss auf das Zinsniveau.',
          value:
            'Das Angebot von Finanzierungsmitteln durch die Zentralbank.',
        },
        {
          feedback:
            'Falsch! Die Nachfrage nach liquiden Mitteln durch die Zentralbank hat einen direkten Einfluss auf das Zinsniveau.',
          value:
            'Die Nachfrage nach liquiden Mitteln durch die Zentralbank.',
        },
        {
          feedback:
            'Falsch! Die Nachfrage der Industrie nach Finanzierungsmitteln für geplante Investitionen hat einen direkten Einfluss auf das Zinsniveau.',
          value:
            'Die Nachfrage der Industrie nach Finanzierungsmitteln für geplante Investitionen.',
        },
        {
          feedback:
            'Falsch! Die von Sparern auf Bankkonten gehaltenen Gelder haben einen direkten Einfluss auf das Zinsniveau.',
          value:
            'Die von Sparern auf Bankkonten gehaltenen Gelder.',
        },
        {
          feedback:
            'Korrekt!  Die von Staat erhobenen Steuern können zwar von der Zinskurve abhängig sein, aber nicht umgekehrt. Wenn das Staatsdefizit günstig über den Kapitalmarkt ausgeglichen werden kann, hat der Staat keinen Anreiz die Steuern massiv zu erhöhen. Ist die Überbrückung des Staatsdefizites aufgrund der Zinslage teuer, wird der Staat zwar eher die Steuern erhöhen (um das Staatsdefizit nicht über den Kapitalmarkt finanzieren zu müssen), jedoch hat ein Land mit höheren Steuern nicht unbedingt höhere Zinsen.',
            correct: true,
          value: 'Die Nachfrage des Staates nach Steuergeldern.',
        },
        {
          name: 'Modul 1 Effective Annual Rate (EAR) I',
          content: 'Du hast die folgenden beiden Zero-Coupon Staatsanleihen:
                    (Bild Modul 1 Effective Annual Rate (EAR) I
                    Vergleiche die beiden Bonds mittels der Effective Annual Rate (EAR).Die beiden Bonds zahlen am Laufzeitende jeweils $100.',
          contentPlain: 'Du hast die folgenden beiden Zero-Coupon Staatsanleihen:
          (Bild Modul 1 Effective Annual Rate (EAR) I
          Vergleiche die beiden Bonds mittels der Effective Annual Rate (EAR).Die beiden Bonds zahlen am Laufzeitende jeweils $100.',
          type: QuestionType.SC,sss
          choices: [
            {
              feedback:
                'Falsch!',
              value:
                ' A: 4.5%, B: 4.9%',
            },
            {
              feedback:
                'Korrekt! Total Return_A = \frac{100}{70.30}-1 = 42.2 \% \ ; \ EAR_A= (1+0.422)^{(\frac{1}{8}) }-1 = 4.5\% \\ Total Return_B = \frac{100}{98.787}-1=1.23\% \ ; \ EAR_B = (1+0.0123)^{(\frac{1}{\frac{1}{4}})}-1 = 5.0\%',
                correct: true,
                value:
                ' A: 4.5%, B: 5.0%',
            },
            {
              feedback:
                'Falsch!',
              value:
                'A: 5.3%, B: 4.9%',
            },
            {
              feedback:
                'Falsch!',
              value:
                'A: 5.3%, B: 5.0%',
            },
            {
              feedback:
                'Falsch!',
              value: 'Keine der genannten Aussagen ist richtig.',
            },
            {
              name: 'Modul 1 Effective Annual Rate (EAR) II',
              content: 'Du hast die folgende Zero-Coupon Staatsanleihe:
                        (Bild Modul 1 Effective Annual Rate (EAR) II)
                        Der Bond zahlt am Laufzeitende $100.
                        Berechne die Effective Annual Rate (EAR).',
              contentPlain: 'Du hast die folgende Zero-Coupon Staatsanleihe:
              (Bild Modul 1 Effective Annual Rate (EAR) II)
              Der Bond zahlt am Laufzeitende $100.
              Berechne die Effective Annual Rate (EAR).',
              type: QuestionType.SC,sss
              choices: [
                {
                  feedback:
                    'Falsch!',
                  value:
                    'EAR: 5.90%',
                },
                {
                  feedback:
                    'Falsch!',
                    value:
                    'EAR: 6.03%',
                },
                {
                  feedback:
                    'Falsch!',
                  value:
                    'EAR: 6.03%',
                },
                {
                  feedback:
                    'Falsch!',
                  value:
                    'EAR: 6.70%',
                },
                {
                  feedback: 'Korrekt! Total Return = \frac{100}{99.5}-1 =0.5\% \\ EAR = (1+0.005)^{(\frac{1}{\frac{1}{12}})} -1 = 6.20\% ',
                    correct: true,
                  value: 'EAR: 6.20%',
                },
  ],
},
  {},
]

export const LEARNING_ELEMENTS = []

export const SESSIONS = []

export const MICRO_SESSIONS = []
