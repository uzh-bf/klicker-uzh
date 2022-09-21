import Prisma from '@klicker-uzh/prisma'
const { AttachmentType, QuestionType, SessionStatus } = Prisma

export const PARTICIPANT_IDS = []

export const ATTACHMENTS = []

export const QUESTIONS = [
  {
    id: 0,
    name: 'Modul 1 Finanz- und Realanlagen',
<<<<<<< HEAD
    content: 'Welche der folgenden Aussagen zu den **Finanz- und Realanlagen** ist **richtig**?',
    contentPlain: 'Welche der folgenden Aussagen zu den Finanz- und Realanlagen ist richtig?',
=======
    content:
      'Welche der folgenden Aussagen zu den *Finanz- und Realanlagen* ist *richtig*?',
    contentPlain:
      'Welche der folgenden Aussagen zu den Finanz- und Realanlagen ist richtig?',
>>>>>>> d6189b76fb4b7e1de1077bf80b2f79b8f88f9887
    type: QuestionType.SC,
    choices: [
      {
        feedback:
          'Falsch! Finanzanlagen tragen nur indirekt zur Produktionsleistung bei, beispielsweise bei einem Kauf von Sachwerten.',
        value:
          'Finanzanlagen tragen sowohl direkt als auch indirekt zur Produktionsleistung eines Landes bei.',
      },
      {
        feedback: 'Falsch! Das Patent ist ein Beispiel für eine Realanlage.',
        value:
          'Patente, Aktien und Obligationen sind Beispiele für Finanzanlagen.',
      },
      {
        feedback: 'Korrekt!',
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
    id: 1,
    name: 'Modul 1 Investitionsprozess',
<<<<<<< HEAD
    content: 'Welche der folgenden Aussagen zum **Investment-Prozess** ist **falsch**?',
    contentPlain: 'Welche der folgenden Aussagen zum Investment-Prozess ist falsch?',
=======
    content:
      'Welche der folgenden Aussagen zum *Investment-Prozess* ist *falsch*?',
    contentPlain:
      'Welche der folgenden Aussagen zum Investment-Prozess ist falsch?',
>>>>>>> d6189b76fb4b7e1de1077bf80b2f79b8f88f9887
    type: QuestionType.SC,
    choices: [
      {
        feedback: 'Falsch! Diese Aussage ist korrekt.',
        value:
          'Mit der Strategischen Asset Allocation wird entschieden, in welche Anlageklassen (Aktien, Bonds, Rohstoffe, etc.) welcher Anteil des Vermögens investiert wird.',
      },
      {
        feedback: 'Falsch! Diese Aussage ist korrekt.',
        value:
          'Im Security Selection Prozess werden innerhalb der Anlageklassen die einzelnen Anlageinstrumente ausgewählt und das Portfolio erstellt.',
      },
      {
        feedback:
          'Korrekt! Die "Top-down" Portfoliokonstruktion beginnt mit der Asset Allocation und die "Bottom-up" mit der Titelselektion.',
        correct: true,
        value:
          'Die "Bottom-up" Portfoliobildung startet mit der Strategischen Asset Allocation.',
      },
      {
        feedback: 'Falsch! Diese Aussage ist korrekt.',
        value:
          'Die "Top-down" Portfoliobildung beinhaltet die Strategische und Taktische Asset Allocation gefolgt vom Security Selection Prozess.',
      },
      {
        feedback: 'Falsch! Diese Aussage ist korrekt.',
        value:
          'Ein Nachteil der "Bottom-up" Strategie kann die fehlende Diversifikation eines Portfolios und das daraus erwachsende unsystematische Risiko sein.',
      },
    ],
  },
  {
    id: 2,
    name: 'Modul 1 Index',
<<<<<<< HEAD
    content: 'Gehe von folgender Ausgangssituation aus: (Bild Modul 1 Index) Welche der folgenden Aussagen zu **Aktienindizes** ist **richtig**?',
    contentPlain: 'Gehe von folgender Ausgangssituation aus: (Bild Modul 1 Index) Welche der folgenden Aussagen zu Aktienindizes ist richtig?',
=======
    content:
      'Gehe von folgender Ausgangssituation aus: (Bild Modul 1 Index) Welche der folgenden Aussagen zu *Aktienindizes* ist *richtig*?',
    contentPlain:
      'Gehe von folgender Ausgangssituation aus: (Bild Modul 1 Index) Welche der folgenden Aussagen zu Aktienindizes ist richtig?',
>>>>>>> d6189b76fb4b7e1de1077bf80b2f79b8f88f9887
    type: QuestionType.SC,
    choices: [
      {
        feedback: 'Korrekt! $$\frac{($40+$70+$10)}{3}=$40$$.',
        correct: true,
        value: 'Der Preis-gewichtete Index der drei Aktien beträgt $40.',
      },
      {
<<<<<<< HEAD
        feedback: 'Falsch! Dies entspricht dem nach Marktwert gewichtetem Index.',
        value: 'Der Preis-gewichtete Index der drei Aktien beträgt "$49'000".',
=======
        feedback:
          'Falsch! Dies entspricht dem nach Marktwert gewichtetem Index.',
        value: 'Der Preis-gewichtete Index der drei Aktien beträgt $49`000.',
>>>>>>> d6189b76fb4b7e1de1077bf80b2f79b8f88f9887
      },
      {
<<<<<<< HEAD
        feedback: 'Falsch! Der nach Marktwert gewichtete Index beträgt: "$40*200+$70*500+$10*600=$49'000".',
        value: 'Der nach Marktwert gewichtete Index der drei Aktien beträgt "$1'200".',
=======
        feedback:
          'Falsch! Der nach Marktwert gewichtete Index beträgt: $40*200+$70*500+$10*600=$49`000.',
        value:
          'Der nach Marktwert gewichtete Index der drei Aktien beträgt $1`200.',
>>>>>>> d6189b76fb4b7e1de1077bf80b2f79b8f88f9887
      },
      {
<<<<<<< HEAD
        feedback: 'Falsch! Der nach Marktwert gewichtete Index beträgt: "$40*200+$70*500+$10*600=$49'000".',
        value: 'Der nach Marktwert gewichtete Index der drei Aktien beträgt "$1'300".',
=======
        feedback:
          'Falsch! Der nach Marktwert gewichtete Index beträgt: $40*200+$70*500+$10*600=$49`000.',
        value:
          'Der nach Marktwert gewichtete Index der drei Aktien beträgt $1`300.',
>>>>>>> d6189b76fb4b7e1de1077bf80b2f79b8f88f9887
      },
      {
        feedback: 'Falsch!',
        value: 'Keine der genannten Aussagen ist richtig.',
      },
    ],
  },
  {
    id: 3,
    name: 'Modul 1 Aktienkauf mit Fremdkapital',
    content: 'Beurteile folgende Aussagen auf ihre **Richtigkeit**.',
    contentPlain: 'Beurteile folgende Aussagen auf ihre Richtigkeit.',
    type: QuestionType.KPRIM,
    choices: [
      {
        feedback:
          'Diese Aussage ist nicht korrekt! Bei einem Aktienkauf mit Fremdkapital sind Renditechancen höher, jedoch steigt das Risiko mit.',
        value:
          'Finanziert ein Investor seinen Wertschriftenkauf teilweise mit Fremdkapital, kann er nur bei einem Kurszerfall der Anlage profitieren.',
      },
      {
        feedback: 'Diese Aussage ist korrekt!',
        correct: true,
        value:
          'Bei Leerverkäufen verkauft ein Investor ein Wertpapier, welches nicht in seinem Besitz ist.',
      },
      {
        feedback: 'Diese Aussage ist nicht korrekt!',
        value:
          'Die Initial Margin ist bei allen Aktientiteln immer gleich hoch und somit unabhängig von der Volatilität des Titels.',
      },
      {
        feedback:
          'Diese Aussage ist nicht korrekt! Fällt der Betrag auf dem Margen-Konto unterhalb der Maintenance-Margin, so erhält der Anleger einen Margin-Call in dem er aufgefordert wird, einen Betrag auf das Margen-Konto zu überweisen, welcher den Saldo wieder auf die Initial-Margin anhebt.',
        value:
          'Kommt es bei einem Investor zu einem Margin-Call, bedeutet dies, dass er den Betrag auf seinem Margenkonto wieder bis auf die Maintenance-Margin aufstocken muss. Ansonsten wird das Geschäft glattgestellt.',
      },
    ],
  },
  {
    id: 4,
    name: 'Modul 1 Aktienkauf mit Fremdkapital',
<<<<<<< HEAD
    content: 'Beurteile folgende Aussagen zum **Leerverkauf** auf ihre **Richtigkeit**.',
    contentPlain: 'Beurteile folgende Aussagen zum Leerverkauf auf ihre Richtigkeit.',
=======
    content:
      'Beurteile folgende Aussagen zum *Leerverkauf* auf ihre *Richtigkeit*.',
    contentPlain:
      'Beurteile folgende Aussagen zum Leerverkauf auf ihre Richtigkeit.',
>>>>>>> d6189b76fb4b7e1de1077bf80b2f79b8f88f9887
    type: QuestionType.KPRIM,
    choices: [
      {
        feedback: 'Diese Aussage ist korrekt!',
        correct: true,
        value:
          'Ein Leerverkauf kann durch den Erwerb und Rückgabe der entsprechenden Aktie glattgestellt werden.',
      },
      {
        feedback:
          'Diese Aussage ist nicht korrekt! Bei einem Leerverkauf profitiert der Anleger von sinkenden Kursen.',
        value:
          'Bei einem Leerverkauf profitiert der Anleger von steigenden Kursen.',
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
  {
    id: 5,
    name: 'Modul 1 Anlageprozess',
<<<<<<< HEAD
    content: 'Überprüfe die folgenden Aussagen zum **Anlageprozess** auf ihre **Richtigkeit**.',
    contentPlain: 'Überprüfe die folgenden Aussagen zum Anlageprozess auf ihre Richtigkeit.',
=======
    content:
      'Überprüfe die folgenden Aussagen zum *Anlageprozess* auf ihre *Richtigkeit*.',
    contentPlain:
      'Überprüfe die folgenden Aussagen zum Anlageprozess auf ihre Richtigkeit.',
>>>>>>> d6189b76fb4b7e1de1077bf80b2f79b8f88f9887
    type: QuestionType.KPRIM,
    choices: [
      {
        feedback: 'Diese Aussage ist korrekt!',
        correct: true,
        value:
          'Die Analyse der Bedürfnisse, die Ausarbeitung einer Strategie, die Umsetzung der Strategie und die Überwachung des Portfolios sind Bestandteile des Anlageprozesses.',
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
        value:
          'Die Risikobereitschaft eines Kunden ist objektiv und daher messbar.',
      },
      {
        feedback: 'Diese Aussage ist korrekt!',
        correct: true,
        value:
          'Bei der Ausarbeitung der Strategie wird die strategische und taktische Allokation erstellt.',
      },
    ],
  },
  {
    id: 6,
    name: 'Modul 1 Investitionsprozess',
<<<<<<< HEAD
    content: 'Welcher der folgenden Faktoren hat **keinen direkten Einfluss** auf das **Zinsniveau**?',
    contentPlain: 'Welcher der folgenden Faktoren hat keinen direkten Einfluss auf das Zinsniveau?',
=======
    content:
      'Welcher der folgenden Faktoren hat *keinen direkten Einfluss* auf das *Zinsniveau*?',
    contentPlain:
      'Welcher der folgenden Faktoren hat keinen direkten Einfluss auf das Zinsniveau?',
>>>>>>> d6189b76fb4b7e1de1077bf80b2f79b8f88f9887
    type: QuestionType.SC,
    choices: [
      {
        feedback:
          'Falsch! Das Angebot von Finanzierungsmitteln durch die Zentralbank hat einen direkten Einfluss auf das Zinsniveau.',
        value: 'Das Angebot von Finanzierungsmitteln durch die Zentralbank.',
      },
      {
        feedback:
          'Falsch! Die Nachfrage nach liquiden Mitteln durch die Zentralbank hat einen direkten Einfluss auf das Zinsniveau.',
        value: 'Die Nachfrage nach liquiden Mitteln durch die Zentralbank.',
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
        value: 'Die von Sparern auf Bankkonten gehaltenen Gelder.',
      },
      {
        feedback:
          'Korrekt! Die von Staat erhobenen Steuern können zwar von der Zinskurve abhängig sein, aber nicht umgekehrt. Wenn das Staatsdefizit günstig über den Kapitalmarkt ausgeglichen werden kann, hat der Staat keinen Anreiz die Steuern massiv zu erhöhen. Ist die Überbrückung des Staatsdefizites aufgrund der Zinslage teuer, wird der Staat zwar eher die Steuern erhöhen (um das Staatsdefizit nicht über den Kapitalmarkt finanzieren zu müssen), jedoch hat ein Land mit höheren Steuern nicht unbedingt höhere Zinsen.',
        correct: true,
        value: 'Die Nachfrage des Staates nach Steuergeldern.',
      },
    ],
  },
  {
    id: 7,
    name: 'Modul 1 Effective Annual Rate (EAR) I',
<<<<<<< HEAD
    content: 'Du hast die folgenden beiden Zero-Coupon Staatsanleihen:
      (Bild Modul 1 Effective Annual Rate (EAR) I) 
      Vergleiche die beiden Bonds mittels der Effective Annual Rate (EAR).Die beiden Bonds zahlen am Laufzeitende jeweils $100.',
    contentPlain: 'Du hast die folgenden beiden Zero-Coupon Staatsanleihen: 
      (Bild Modul 1 Effective Annual Rate (EAR) I) 
      Vergleiche die beiden Bonds mittels der Effective Annual Rate (EAR).Die beiden Bonds zahlen am Laufzeitende jeweils $100.',
=======
    content:
      'Du hast die folgenden beiden Zero-Coupon Staatsanleihen: (Bild Modul 1 Effective Annual Rate (EAR) I) Vergleiche die beiden Bonds mittels der Effective **Annual** Rate (EAR).Die beiden Bonds zahlen am Laufzeitende jeweils $100.',
    contentPlain:
      'Du hast die folgenden beiden Zero-Coupon Staatsanleihen: (Bild Modul 1 Effective Annual Rate (EAR) I) Vergleiche die beiden Bonds mittels der Effective Annual Rate (EAR).Die beiden Bonds zahlen am Laufzeitende jeweils $100.',
>>>>>>> d6189b76fb4b7e1de1077bf80b2f79b8f88f9887
    type: QuestionType.SC,
    choices: [
      {
        feedback: 'Falsch!',
        value: 'A: 4.5%, B: 4.9%',
      },
      {
<<<<<<< HEAD
        feedback: String.raw`
  Korrekt! 
  
  $$Total Return_A = \frac{100}{70.30}-1 = 42.2%$$
  
  $$EAR_A= (1+0.422)^{(\frac{1}{8}) }-1 = 4.5%$$
  
  $$Total Return_B = \frac{100}{98.787}-1=1.23%$$
  
  $$EAR_B = (1+0.0123)^{(\frac{1}{\frac{1}{4}})}-1 = 5.0%$$
  `,
=======
        feedback: String.raw`
Korrekt!

$$Total Return_A = \frac{100}{70.30}-1 = 42.2 %$$

$$EAR_A= (1+0.422)^{(\frac{1}{8}) }-1 = 4.5%$$

$$Total Return_B = \frac{100}{98.787}-1=1.23%$$

$$EAR_B = (1+0.0123)^{(\frac{1}{\frac{1}{4}})}-1 = 5.0%$$
`,
>>>>>>> d6189b76fb4b7e1de1077bf80b2f79b8f88f9887
        correct: true,
        value: 'A: 4.5%, B: 5.0%',
      },
      {
        feedback: 'Falsch!',
        value: 'A: 5.3%, B: 4.9%',
      },
      {
        feedback: 'Falsch!',
        value: 'A: 5.3%, B: 5.0%',
      },
      {
        feedback: 'Falsch!',
        value: 'Keine der genannten Aussagen ist richtig.',
      },
    ],
  },
  {
    id: 8,
    name: 'Modul 1 Effective Annual Rate (EAR) II',
<<<<<<< HEAD
    content: 'Du hast die folgende Zero-Coupon Staatsanleihe: 
      (Bild Modul 1 Effective Annual Rate (EAR) II) 
      Der Bond zahlt am Laufzeitende $100. 
       Berechne die Effective Annual Rate (EAR).',
    contentPlain: 'Du hast die folgende Zero-Coupon Staatsanleihe: 
      (Bild Modul 1 Effective Annual Rate (EAR) II) 
      Der Bond zahlt am Laufzeitende $100. 
      Berechne die Effective Annual Rate (EAR).',
=======
    content:
      'Du hast die folgende Zero-Coupon Staatsanleihe: (Bild Modul 1 Effective Annual Rate (EAR) II) Der Bond zahlt am Laufzeitende $100. Berechne die Effective Annual Rate (EAR).',
    contentPlain:
      'Du hast die folgende Zero-Coupon Staatsanleihe: (Bild Modul 1 Effective Annual Rate (EAR) II) Der Bond zahlt am Laufzeitende $100. Berechne die Effective Annual Rate (EAR).',
>>>>>>> d6189b76fb4b7e1de1077bf80b2f79b8f88f9887
    type: QuestionType.SC,
    choices: [
      {
        feedback: 'Falsch!',
        value: 'EAR: 5.90%',
      },
      {
        feedback: 'Falsch!',
        value: 'EAR: 6.03%',
      },
      {
        feedback: 'Falsch!',
        value: 'EAR: 6.03%',
      },
      {
        feedback: 'Falsch!',
        value: 'EAR: 6.70%',
      },
      {
<<<<<<< HEAD
        feedback: String.raw`
  Korrekt! 

  $$Total Return = \frac{100}{99.5}-1 =0.5%$$
  
  $$EAR = (1+0.005)^{(\frac{1}{\frac{1}{12}})} -1 = 6.20% $$
  `,
=======
        feedback:
          'Korrekt! $$Total Return = \frac{100}{99.5}-1 =0.5% \\ EAR = (1+0.005)^{(\frac{1}{\frac{1}{12}})} -1 = 6.20% $$',
>>>>>>> d6189b76fb4b7e1de1077bf80b2f79b8f88f9887
        correct: true,
        value: 'EAR: 6.20%',
      },
    ],
  },
  {
    id: 9,
    name: 'Modul 1 Continuous Compounding',
<<<<<<< HEAD
    content: 'Du hast die folgende Zero-Coupon Staatsanleihe: 
      (Bild Modul 1 Continuous Compounding) 
      Der Bond zahlt am Laufzeitende $100. 
      Berechne die Continuously Compounded Rate (CCR).',
    contentPlain: 'Du hast die folgende Zero-Coupon Staatsanleihe: 
      (Bild Modul 1 Continuous Compounding) 
      Der Bond zahlt am Laufzeitende $100. 
      Berechne die Continuously Compounded Rate (CCR).',
=======
    content:
      'Du hast die folgende Zero-Coupon Staatsanleihe: (Bild Modul 1 Continuous Compounding) Der Bond zahlt am Laufzeitende $100. Berechne die Continuously Compounded Rate (CCR).',
    contentPlain:
      'Du hast die folgende Zero-Coupon Staatsanleihe: (Bild Modul 1 Continuous Compounding) Der Bond zahlt am Laufzeitende $100. Berechne die Continuously Compounded Rate (CCR).',
>>>>>>> d6189b76fb4b7e1de1077bf80b2f79b8f88f9887
    type: QuestionType.SC,
    choices: [
      {
<<<<<<< HEAD
        feedback: String.raw`
  Korrekt! 
  
  $$Total Return = \frac{100}{98}-1 = 2.04%$$
  
  $$EAR = (1+0.0204)^{(\frac{1}{\frac{1}{4}})}-1 = 8.4%$$
  
  $$CCR = ln(1+0.084) = 8.1%$$
  `,
=======
        feedback:
          'Korrekt! $$Total Return = \frac{100}{98}-1 = 2.04% \\ EAR = (1+0.0204)^{(\frac{1}{\frac{1}{4}})}-1 = 8.4% \\ CCR = ln(1+0.084) = 8.1%$$',
>>>>>>> d6189b76fb4b7e1de1077bf80b2f79b8f88f9887
        correct: true,
        value: 'CCR: 8.1%',
      },
      {
        feedback: 'Falsch!',
        value: 'CCR: 8.2%',
      },
      {
        feedback: 'Falsch!',
        value: 'CCR: 8.3%',
      },
      {
        feedback: 'Falsch!',
        value: 'CCR: 8.4%',
      },
      {
        feedback: 'Falsch!',
        value: 'CCR: 8.5%',
      },
    ],
  },
  {
    id: 10,
    name: 'Modul 1 Varianz',
<<<<<<< HEAD
    content: 'Folgend siehst du den Aktienkurs- und Aktienrenditeverlauf der UBS in täglicher Frequenz über den Zeitraum 2005 bis 2008: 
      (Bild Modul 1 Varianz 1) 
      (Bild Modul 1 Varianz 2) 
      Zusätzlich liegen dir folgende Daten mit jährlicher Frequenz vor: 
      (Bild Modul 1 Varianz 3). 
      Berechne die Varianz (Annahme: der Grundgesamtheit) der jährlichen Aktienrenditen über den Zeitraum 2005 bis 2008.'',
    contentPlain: 'Folgend siehst du den Aktienkurs- und Aktienrenditeverlauf der UBS in täglicher Frequenz über den Zeitraum 2005 bis 2008: 
      (Bild Modul 1 Varianz 1) 
      (Bild Modul 1 Varianz 2) 
      Zusätzlich liegen dir folgende Daten mit jährlicher Frequenz vor: 
      (Bild Modul 1 Varianz 3)
      Berechne die Varianz (Annahme: der Grundgesamtheit) der jährlichen Aktienrenditen über den Zeitraum 2005 bis 2008.'',
=======
    content:
      'Folgend siehst du den Aktienkurs- und Aktienrenditeverlauf der UBS in täglicher Frequenz über den Zeitraum 2005 bis 2008: (Bild Modul 1 Varianz 1) (Bild Modul 1 Varianz 2) Zusätzlich liegen dir folgende Daten mit jährlicher Frequenz vor: (Bild Modul 1 Varianz 3). Berechne die Varianz (Annahme: der Grundgesamtheit) der jährlichen Aktienrenditen über den Zeitraum 2005 bis 2008.',
    contentPlain:
      'Folgend siehst du den Aktienkurs- und Aktienrenditeverlauf der UBS in täglicher Frequenz über den Zeitraum 2005 bis 2008: (Bild Modul 1 Varianz 1) (Bild Modul 1 Varianz 2) Zusätzlich liegen dir folgende Daten mit jährlicher Frequenz vor: (Bild Modul 1 Varianz 3) Berechne die Varianz (Annahme: der Grundgesamtheit) der jährlichen Aktienrenditen über den Zeitraum 2005 bis 2008.',
>>>>>>> d6189b76fb4b7e1de1077bf80b2f79b8f88f9887
    type: QuestionType.SC,
    choices: [
      {
<<<<<<< HEAD
        feedback: String.raw`
  Korrekt! Die entsprechenden Aktienrenditen lassen sich wie folgt kalkulieren: 
  
  $$\frac{(65.9 – 55.4)}{55.4} = 0.1895$$
  
  $$\frac{(46.6 – 65.9)}{65.9} = -0.2929$$

  $$\frac{(14.8 – 46.6)}{46.6} = -0.6824$$

  $$E(r) = - 0.26$$

  $$Varianz = \frac{1}{3}\cdot[(0.19-(-0.26))^2+(-0.29-(-0.26))^2+(-0.68-(-0.26))^2]=12.72%$$
  `,
=======
        feedback:
          'Korrekt! Die entsprechenden Aktienrenditen lassen sich wie folgt kalkulieren: (65.9 – 55.4) / 55.4 = 0.1895; (46.6 – 65.9) / 65.9 = -0.2929; (14.8 – 46.6) / 46.6 = -0.6824 Und die durchschnittliche Aktienrendite lautet: (0.1895 - 0.2929 - 0.6824) / 3 = -0.2619 $$E(r) = - 0.26;  Varianz = \frac{1}{3}cdot[(0.19-(-0.26))^2+(-0.29-(-0.26))^2+(-0.68-(-0.26))^2]=12.72%$$ ',
>>>>>>> d6189b76fb4b7e1de1077bf80b2f79b8f88f9887
        correct: true,
        value: '$$σ^2_x = 12.72%$$',
      },
      {
        feedback: 'Falsch!',
        value: '$$σ^2_x = 19.08%$$',
      },
      {
        feedback: 'Falsch!',
        value: '$$σ^2_x = 35.66%$$',
      },
      {
        feedback: 'Falsch!',
        value: '$$σ^2_x = 364.44$$',
      },
      {
        feedback: 'Falsch!',
        value: '$$σ^2_x = 485.92$$',
      },
    ],
  },
  {
    id: 11,
    name: 'Modul 1 Standardabweichung',
<<<<<<< HEAD
    content: 'Folgend siehst du den Aktienkurs- und Aktienrenditeverlauf der UBS in täglicher Frequenz über den Zeitraum 2005 bis 2008: 
      (Bild Modul 1 Varianz 1) (Bild Modul 1 Varianz 2) 
      Zusätzlich liegen dir folgende Daten mit jährlicher Frequenz vor: 
      (Bild Modul 1 Varianz 3) 
      Berechnene die Standardabweichung der jährlichen Aktienrenditen über den Zeitraum 2005 bis 2008.',
    contentPlain: 'Folgend siehst du den Aktienkurs- und Aktienrenditeverlauf der UBS in täglicher Frequenz über den Zeitraum 2005 bis 2008: 
      (Bild Modul 1 Varianz 1) 
      (Bild Modul 1 Varianz 2) 
      Zusätzlich liegen dir folgende Daten mit jährlicher Frequenz vor: 
      (Bild Modul 1 Varianz 3) 
      erechnene die Standardabweichung der jährlichen Aktienrenditen über den Zeitraum 2005 bis 2008.',
=======
    content:
      'Folgend siehst du den Aktienkurs- und Aktienrenditeverlauf der UBS in täglicher Frequenz über den Zeitraum 2005 bis 2008: (Bild Modul 1 Varianz 1) (Bild Modul 1 Varianz 2) Zusätzlich liegen dir folgende Daten mit jährlicher Frequenz vor: (Bild Modul 1 Varianz 3) Berechnene die Standardabweichung der jährlichen Aktienrenditen über den Zeitraum 2005 bis 2008.',
    contentPlain:
      'Folgend siehst du den Aktienkurs- und Aktienrenditeverlauf der UBS in täglicher Frequenz über den Zeitraum 2005 bis 2008: (Bild Modul 1 Varianz 1) (Bild Modul 1 Varianz 2) Zusätzlich liegen dir folgende Daten mit jährlicher Frequenz vor: (Bild Modul 1 Varianz 3) Berechnene die Standardabweichung der jährlichen Aktienrenditen über den Zeitraum 2005 bis 2008.',
>>>>>>> d6189b76fb4b7e1de1077bf80b2f79b8f88f9887
    type: QuestionType.SC,
    choices: [
      {
        feedback: 'Falsch!',
        value: '$$σ_x = 16.18%$$',
      },
      {
<<<<<<< HEAD
        feedback: String.raw`
  Korrekt! 

  $$Standardabweichung = \sqrt{0.1272} = 35.67%$$
  `,
=======
        feedback: 'Korrekt! $$Standardabweichung = sqrt{0.1272} = 35.67%$$',
>>>>>>> d6189b76fb4b7e1de1077bf80b2f79b8f88f9887
        correct: true,
        value: '$$σ_x = 35.67%$$',
      },
      {
        feedback: 'Falsch!',
        value: '$$σ_x = 43.68%$$',
      },
      {
        feedback: 'Falsch!',
        value: '$$σ_x = 83.8%$$',
      },
      {
        feedback: 'Falsch!',
        value: '$$σ_x = 1.618%$$',
      },
    ],
  },
  {
    id: 12,
    name: 'Modul 1 Wochenvolatilität',
<<<<<<< HEAD
    content: 'Folgend siehst du den Aktienkurs- und Aktienrenditeverlauf der UBS in täglicher Frequenz über den Zeitraum 2005 bis 2008: 
      (Bild Modul 1 Varianz 1) 
      (Bild Modul 1 Varianz 2) 
      Zusätzlich liegen dir folgende Daten mit jährlicher Frequenz vor: 
      (Bild Modul 1 Varianz 3) 
      Berechne die Wochenvolatilität der jährlichen Aktienrenditen für den Zeitraum 2005 bis 2008. (Annahme: Ein Jahr hat 50 Handelswochen.)',
    contentPlain: 'Folgend siehst du den Aktienkurs- und Aktienrenditeverlauf der UBS in täglicher Frequenz über den Zeitraum 2005 bis 2008: 
      (Bild Modul 1 Varianz 1) 
      (Bild Modul 1 Varianz 2) 
      Zusätzlich liegen dir folgende Daten mit jährlicher Frequenz vor: 
      (Bild Modul 1 Varianz 3) 
      Berechne die Wochenvolatilität der jährlichen Aktienrenditen für den Zeitraum 2005 bis 2008. (Annahme: Ein Jahr hat 50 Handelswochen.)',
=======
    content:
      'Folgend siehst du den Aktienkurs- und Aktienrenditeverlauf der UBS in täglicher Frequenz über den Zeitraum 2005 bis 2008: (Bild Modul 1 Varianz 1) (Bild Modul 1 Varianz 2) Zusätzlich liegen dir folgende Daten mit jährlicher Frequenz vor: (Bild Modul 1 Varianz 3) Berechne die Wochenvolatilität der jährlichen Aktienrenditen für den Zeitraum 2005 bis 2008. (Annahme: Ein Jahr hat 50 Handelswochen.)',
    contentPlain:
      'Folgend siehst du den Aktienkurs- und Aktienrenditeverlauf der UBS in täglicher Frequenz über den Zeitraum 2005 bis 2008: (Bild Modul 1 Varianz 1) (Bild Modul 1 Varianz 2) Zusätzlich liegen dir folgende Daten mit jährlicher Frequenz vor: (Bild Modul 1 Varianz 3) Berechne die Wochenvolatilität der jährlichen Aktienrenditen für den Zeitraum 2005 bis 2008. (Annahme: Ein Jahr hat 50 Handelswochen.)',
>>>>>>> d6189b76fb4b7e1de1077bf80b2f79b8f88f9887
    type: QuestionType.SC,
    choices: [
      {
        feedback: 'Falsch!',
        value: 'Wochenvolatilität = 2.26%',
      },
      {
        feedback: 'Falsch!',
        value: 'Wochenvolatilität = 2.52%',
      },
      {
        feedback: 'Falsch!',
        value: 'Wochenvolatilität = 3.09%',
      },
      {
<<<<<<< HEAD
        feedback: String.raw`
  Korrekt! 

  $$Wochenvolatilität = \frac{Jahresvolatilität}{\sqrt{50}} = 5.04%$$
  `,
=======
        feedback:
          'Korrekt! $$Wochenvolatilität = \frac{Jahresvolatilität}{sqrt{50}} = 5.04%$$',
>>>>>>> d6189b76fb4b7e1de1077bf80b2f79b8f88f9887
        correct: true,
        value: 'Wochenvolatilität = 5.04%',
      },
      {
        feedback: 'Falsch!',
        value: 'Wochenvolatilität = 6.18%',
      },
    ],
  },
  {
    id: 13,
    name: 'Modul 1 Geometric (Time-weighted) Average Return',
<<<<<<< HEAD
    content: 'Ein Investor möchte die jährliche Durchschnittsrendite seiner Investition über die letzten Jahre ausrechnen. Diese Investition hat folgende Renditen in den letzten Jahren abgeworfen. 
      (Bild Modul 1 Geometric (Time-weighted) Average Return) 
      Wie gross ist der geometrische Durchschnitt dieser Investition?',
    contentPlain: 'Ein Investor möchte die jährliche Durchschnittsrendite seiner Investition über die letzten Jahre ausrechnen. Diese Investition hat folgende Renditen in den letzten Jahren abgeworfen. 
      (Bild Modul 1 Geometric (Time-weighted) Average Return) 
      Wie gross ist der geometrische Durchschnitt dieser Investition?',
=======
    content:
      'Ein Investor möchte die jährliche Durchschnittsrendite seiner Investition über die letzten Jahre ausrechnen. Diese Investition hat folgende Renditen in den letzten Jahren abgeworfen. (Bild Modul 1 Geometric (Time-weighted) Average Return) Wie gross ist der geometrische Durchschnitt dieser Investition?',
    contentPlain:
      'Ein Investor möchte die jährliche Durchschnittsrendite seiner Investition über die letzten Jahre ausrechnen. Diese Investition hat folgende Renditen in den letzten Jahren abgeworfen. (Bild Modul 1 Geometric (Time-weighted) Average Return) Wie gross ist der geometrische Durchschnitt dieser Investition?',
>>>>>>> d6189b76fb4b7e1de1077bf80b2f79b8f88f9887
    type: QuestionType.SC,
    choices: [
      {
        feedback: 'Falsch!',
        value: '0.0%',
      },
      {
<<<<<<< HEAD
        feedback: String.raw`
  Korrekt! 

  $$Terminal Value=(1+0.25)*(1+0.10)*(1-0.15)=1.169$$
  
  $$Geometric Average Return=1.169^\frac{1}{3}-1=5.3%$$
  `,
=======
        feedback:
          'Korrekt! Terminal Value=(1+0.25)*(1+0.10)*(1-0.15)=1.169 ; Geometric Average Return=1.169^(1/3)-1=5.3%',
>>>>>>> d6189b76fb4b7e1de1077bf80b2f79b8f88f9887
        correct: true,
        value: '5.3%',
      },
      {
        feedback: 'Falsch!',
        value: '7.0%',
      },
      {
        feedback: 'Falsch!',
        value: '12.5%',
      },
      {
        feedback: 'Falsch!',
        value: '16.8%',
      },
    ],
  },
  {
    id: 14,
    name: 'Modul 1 Risikoaversion',
<<<<<<< HEAD
    content: 'Welche der folgenden Aussagen ist **richtig**? (A = Index für Risikoaversion)',
    contentPlain: 'Welche der folgenden Aussagen ist richtig? (A = Index für Risikoaversion)',
=======
    content:
      'Welche der folgenden Aussagen ist *richtig*? (A = Index für Risikoaversion)',
    contentPlain:
      'Welche der folgenden Aussagen ist richtig? (A = Index für Risikoaversion)',
>>>>>>> d6189b76fb4b7e1de1077bf80b2f79b8f88f9887
    type: QuestionType.SC,
    choices: [
      {
        feedback:
          'Falsch! Sie gehen risikolose und spekulative Investitionen ein. Sie verlangen aber für die spekulativen Investitionen eine entsprechend höhere Risikoprämie.',
        value:
          'Risikoaverse Investoren gehen nur risikolose Investitionen ein.',
      },
      {
        feedback:
          'Falsch! Je risikoaverser ein Investor, desto grösser wird A.',
        value: 'Je risikoaverser ein Investor, desto kleiner wird das A.',
      },
      {
        feedback: 'Falsch! Bei risikofreudigen Investoren gilt A<0.',
        value: 'Risikofreudige Investoren sind durch ein A>0 charakterisiert.',
      },
      {
        feedback: 'Korrekt!',
        correct: true,
        value:
          'Risikoneutrale Investoren beurteilen risikolose und risikoreiche Investitionen nur anhand der erwarteten Rendite (A=0).',
      },
      {
        feedback: 'Falsch!',
        value: 'Keine der genannten Aussagen ist richtig.',
      },
    ],
  },
  {
    id: 15,
    name: 'Modul 1 Nutzenfunktionen',
<<<<<<< HEAD
    content: 'Gehe von folgender Ausgangssituation aus: 
      (Bild Modul 1 Nutzenfunktionen) 
      Die Nutzenfunktion des Investors beträgt $$U=E(r)-\frac{A}{2}*SD^2$$, wobei A=4.0 ist. 
      Welches Investment wird der Anleger tätigen?',
    contentPlain: 'Gehe von folgender Ausgangssituation aus: 
      (Bild Modul 1 Nutzenfunktionen) 
      Die Nutzenfunktion des Investors beträgt $$U=E(r)-\frac{A}{2}*SD^2$$, wobei A=4.0 ist. 
      Welches Investment wird der Anleger tätigen?',
=======
    content:
      'Gehe von folgender Ausgangssituation aus: (Bild Modul 1 Nutzenfunktionen) Die Nutzenfunktion des Investors beträgt U=E(r)-(A/2)*SD^2, wobei A=4.0 ist. Welches Investment wird der Anleger tätigen?',
    contentPlain:
      'Gehe von folgender Ausgangssituation aus: (Bild Modul 1 Nutzenfunktionen) Die Nutzenfunktion des Investors beträgt U=E(r)-(A/2)*SD^2, wobei A=4.0 ist. Welches Investment wird der Anleger tätigen?',
>>>>>>> d6189b76fb4b7e1de1077bf80b2f79b8f88f9887
    type: QuestionType.SC,
    choices: [
      {
        feedback: 'Falsch!',
        value: '1',
      },
      {
        feedback: 'Falsch!',
        value: '2',
      },
      {
        feedback: 'Korrekt! $$U(3)=0.21-\frac{4}{2}*0.16^2=15.88$$',
        correct: true,
        value: '3',
      },
      {
        feedback: 'Falsch!',
        value: '4',
      },
      {
        feedback: 'Falsch!',
        value: 'Die Angaben reichen für die Berechnung nicht aus.',
      },
    ],
  },
  {
    id: 16,
    name: 'Modul 1 Statistische Kennzahlen',
<<<<<<< HEAD
    content: 'Überprüfe die folgenden Aussagen zu den **statistischen Kennzahlen** auf ihre **Richtigkeit**.',
    contentPlain: 'Überprüfe die folgenden Aussagen zu den statistischen Kennzahlen auf ihre Richtigkeit.',
=======
    content:
      'Überprüfe die folgenden Aussagen zu den *statistischen Kennzahlen* auf ihre *Richtigkeit*.',
    contentPlain:
      'Überprüfe die folgenden Aussagen zu den statistischen Kennzahlen auf ihre Richtigkeit.',
>>>>>>> d6189b76fb4b7e1de1077bf80b2f79b8f88f9887
    type: QuestionType.KPRIM,
    choices: [
      {
        feedback: 'Diese Aussage ist korrekt!',
        correct: true,
        value:
          'Statistische Kennzahlen basieren auf vergangenheitsorientierten Daten.',
      },
      {
        feedback: 'Diese Aussage ist korrekt!',
        correct: true,
        value:
          'In der klassischen Finance-Theorie wird davon ausgegangen, dass Aktienrenditen normalverteilt sind.',
      },
      {
<<<<<<< HEAD
        feedback: 'Diese Aussage ist nicht korrekt! Bei der Normalverteilung werden "Fat Tails" nicht berücksichtigt.',
        value: 'Bei der Normalverteilung werden "Fat Tails" berücksichtigt.',
=======
        feedback:
          'Diese Aussage ist nicht korrekt! Bei der Normalverteilung werden «Fat Tails» nicht berücksichtigt.',
        value: 'Bei der Normalverteilung werden „Fat Tails“ berücksichtigt.',
>>>>>>> d6189b76fb4b7e1de1077bf80b2f79b8f88f9887
      },
      {
        feedback:
          'Diese Aussage ist nicht korrekt! Die Schiefe einer Normalverteilung beträgt null.',
        value: 'Die Schiefe einer Normalverteilung beträgt eins.',
      },
    ],
  },
  {
    id: 17,
    name: 'Modul 1 Capital Allocation Line',
<<<<<<< HEAD
    content: 'Überprüfe die folgenden Aussagen zur **Indifferenzkurve** und zur **Capital Allocation Line (CAL)** auf ihre **Richtigkeit**.',
    contentPlain: 'Überprüfe die folgenden Aussagen zur Indifferenzkurve und zur Capital Allocation Line (CAL) auf ihre Richtigkeit.',
=======
    content:
      'Überprüfe die folgenden Aussagen zur *Indifferenzkurve* und zur *Capital Allocation Line (CAL)* auf ihre *Richtigkeit*.',
    contentPlain:
      'Überprüfe die folgenden Aussagen zur Indifferenzkurve und zur Capital Allocation Line (CAL) auf ihre Richtigkeit.',
>>>>>>> d6189b76fb4b7e1de1077bf80b2f79b8f88f9887
    type: QuestionType.KPRIM,
    choices: [
      {
        feedback: 'Diese Aussage ist korrekt!',
        correct: true,
        value:
          'Die Indifferenzkurve stellt die Risikoneigung des Investors dar.',
      },
      {
        feedback: 'Diese Aussage ist nicht korrekt!',
        value:
          'Je höher die Risikoaversion des Investors ist, desto flacher ist die entsprechende Indifferenzkurve.',
      },
      {
        feedback: 'Diese Aussage ist korrekt!',
        correct: true,
        value:
          'Auf der Capital Allocation Line (CAL) befinden sich alle optimalen Kombinationen von risikobehafteten und risikofreien Anlagen (Annahme: maximierte Sharp Ratio).',
      },
      {
        feedback: 'Diese Aussage ist korrekt!',
        correct: true,
        value:
          'Mithilfe der Indifferenzkurve und der Capital Allocation Line (CAL) kann der Investor sein optimales Portfolio bestimmen (Annahme: maximierte Sharp Ratio).',
      },
    ],
  },
]

export const LEARNING_ELEMENTS = [
  {
    id: '3e588933-36ce-49b1-9fad-87481843f7c1',
    name: 'AMI MC 1',
    displayName: 'AMI Modul 1 - Lernfragen',
    // questions: range(0, 18),
    questions: [7],
  },
]

export const SESSIONS = []

export const MICRO_SESSIONS = []
