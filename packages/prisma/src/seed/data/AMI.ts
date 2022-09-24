// prettier
import Prisma from '@klicker-uzh/prisma'
import { range } from 'ramda'
const { AttachmentType, QuestionType, SessionStatus } = Prisma

export const PARTICIPANT_IDS = []

export const ATTACHMENTS = []

export const QUESTIONS = [
  {
    id: 30,
    name: 'Modul 1 Finanz- und Realanlagen',
    content:
      'Welche der folgenden Aussagen zu den **Finanz- und Realanlagen** ist **richtig**?',
    contentPlain:
      'Welche der folgenden Aussagen zu den Finanz- und Realanlagen ist richtig?',
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
    id: 31,
    name: 'Modul 1 Investitionsprozess',
    content:
      'Welche der folgenden Aussagen zum **Investment-Prozess** ist **falsch**?',
    contentPlain:
      'Welche der folgenden Aussagen zum Investment-Prozess ist falsch?',
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
          'Richtig, diese Aussage ist nicht korrekt! Die "Top-down" Portfoliokonstruktion beginnt mit der Asset Allocation und die "Bottom-up" mit der Titelselektion.',
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
    id: 32,
    name: 'Modul 1 Index',
    content:
      'Gehe von folgender Ausgangssituation aus: ![Index](https://sos-ch-dk-2.exo.io/klicker-prod/img/modul1_index.png) Welche der folgenden Aussagen zu **Aktienindizes** ist **richtig**?',
    contentPlain:
      'Gehe von folgender Ausgangssituation aus: BILD Welche der folgenden Aussagen zu Aktienindizes ist richtig?',
    type: QuestionType.SC,
    choices: [
      {
        feedback: String.raw`Korrekt! $$ \frac{(\$40+\$70+\$10)}{3}=\$40 $$.`,
        correct: true,
        value: 'Der Preis-gewichtete Index der drei Aktien beträgt $40.',
      },
      {
        feedback:
          'Falsch! Dies entspricht dem nach Marktwert gewichtetem Index.',
        value: "Der Preis-gewichtete Index der drei Aktien beträgt $49'000.",
      },
      {
        feedback: String.raw`Falsch! Der nach Marktwert gewichtete Index beträgt: $$ \$40*200+\$70*500+\$10*600=\$49'000 $$.`,
        value:
          "Der nach Marktwert gewichtete Index der drei Aktien beträgt $1'200.",
      },
      {
        feedback: String.raw`Falsch! Der nach Marktwert gewichtete Index beträgt: $$ \$40*200+\$70*500+\$10*600=\$49'000 $$.`,
        value:
          "Der nach Marktwert gewichtete Index der drei Aktien beträgt $1'300.",
      },
      {
        feedback: 'Falsch!',
        value: 'Keine der genannten Aussagen ist richtig.',
      },
    ],
  },
  {
    id: 33,
    name: 'Modul 1 Aktienkauf mit Fremdkapital',
    content: '',
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
    id: 34,
    name: 'Modul 1 Aktienkauf mit Fremdkapital',
    content: '',
    contentPlain:
      'Beurteile folgende Aussagen zum Leerverkauf auf ihre Richtigkeit.',
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
    id: 35,
    name: 'Modul 1 Anlageprozess',
    content: '',
    contentPlain:
      'Überprüfe die folgenden Aussagen zum Anlageprozess auf ihre Richtigkeit.',
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
    id: 36,
    name: 'Modul 1 Investitionsprozess',
    content:
      'Welcher der folgenden Faktoren hat **keinen direkten Einfluss** auf das **Zinsniveau**?',
    contentPlain:
      'Welcher der folgenden Faktoren hat keinen direkten Einfluss auf das Zinsniveau?',
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
    id: 37,
    name: 'Modul 1 Effective Annual Rate (EAR) I',
    content: `Du hast die folgenden beiden Zero-Coupon Staatsanleihen:
![EAR I](https://sos-ch-dk-2.exo.io/klicker-prod/img/modul1_effective_annual_rate_EAR_I.png)
Vergleiche die beiden Bonds mittels der Effective Annual Rate (EAR). Die beiden Bonds zahlen am Laufzeitende jeweils $100.`,
    contentPlain: `Du hast die folgenden beiden Zero-Coupon Staatsanleihen:
BILD
Vergleiche die beiden Bonds mittels der Effective Annual Rate (EAR). Die beiden Bonds zahlen am Laufzeitende jeweils $100.`,
    type: QuestionType.SC,
    choices: [
      {
        feedback: 'Falsch!',
        value: 'A: 4.5%, B: 4.9%',
      },
      {
        feedback: String.raw`
Korrekt!

$$Total Return_A = \frac{100}{70.30}-1 = 42.2\%$$

$$EAR_A= (1+0.422)^{(\frac{1}{8}) }-1 = 4.5\%$$

$$Total Return_B = \frac{100}{98.787}-1=1.23\%$$

$$EAR_B = (1+0.0123)^{(\frac{1}{\frac{1}{4}})}-1 = 5.0\%$$
`,
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
    id: 38,
    name: 'Modul 1 Effective Annual Rate (EAR) II',
    content: `Du hast die folgende Zero-Coupon Staatsanleihe:
![EAR I](https://sos-ch-dk-2.exo.io/klicker-prod/img/modul1_effective_annual_rate_EAR_II.png)
Der Bond zahlt am Laufzeitende $100.
Berechne die Effective Annual Rate (EAR).`,
    contentPlain: `Du hast die folgende Zero-Coupon Staatsanleihe:
BILD
Der Bond zahlt am Laufzeitende $100.
Berechne die Effective Annual Rate (EAR).`,
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
        value: 'EAR: 6.30%',
      },
      {
        feedback: 'Falsch!',
        value: 'EAR: 6.70%',
      },
      {
        feedback: String.raw`
Korrekt!

$$Total Return = \frac{100}{99.5}-1 =0.5\%$$

$$EAR = (1+0.005)^{(\frac{1}{\frac{1}{12}})} -1 = 6.20\% $$
`,
        correct: true,
        value: 'EAR: 6.20%',
      },
    ],
  },
  {
    id: 39,
    name: 'Modul 1 Continuous Compounding',
    content: `Du hast die folgende Zero-Coupon Staatsanleihe:
![Continuous Compounding](https://sos-ch-dk-2.exo.io/klicker-prod/img/modul1_continuous_compounding.png)
Der Bond zahlt am Laufzeitende $100.
Berechne die Continuously Compounded Rate (CCR).`,
    contentPlain: `Du hast die folgende Zero-Coupon Staatsanleihe:
BILD
Der Bond zahlt am Laufzeitende $100.
Berechne die Continuously Compounded Rate (CCR).`,
    type: QuestionType.SC,
    choices: [
      {
        feedback: String.raw`
Korrekt!

$$Total Return = \frac{100}{98}-1 = 2.04\%$$

$$EAR = (1+0.0204)^{(\frac{1}{\frac{1}{4}})}-1 = 8.4\%$$

$$CCR = ln(1+0.084) = 8.1\%$$
`,
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
    id: 40,
    name: 'Modul 1 Varianz',
    content: `Folgend siehst du den Aktienkurs- und Aktienrenditeverlauf der UBS in täglicher Frequenz über den Zeitraum 2005 bis 2008:
![Varianz 1](https://sos-ch-dk-2.exo.io/klicker-prod/img/modul1_varianz1.png)
![Varianz 2](https://sos-ch-dk-2.exo.io/klicker-prod/img/modul1_varianz2.png)
Zusätzlich liegen dir folgende Daten mit jährlicher Frequenz vor:
![Varianz 3](https://sos-ch-dk-2.exo.io/klicker-prod/img/modul1_varianz3.png)
Berechne die Varianz (Annahme: der Grundgesamtheit) der jährlichen Aktienrenditen über den Zeitraum 2005 bis 2008.`,
    contentPlain: `Folgend siehst du den Aktienkurs- und Aktienrenditeverlauf der UBS in täglicher Frequenz über den Zeitraum 2005 bis 2008:
BILD
BILD
Zusätzlich liegen dir folgende Daten mit jährlicher Frequenz vor:
BILD
Berechne die Varianz (Annahme: der Grundgesamtheit) der jährlichen Aktienrenditen über den Zeitraum 2005 bis 2008.`,
    type: QuestionType.SC,
    choices: [
      {
        feedback: String.raw`
Korrekt! Die entsprechenden Aktienrenditen lassen sich wie folgt kalkulieren:

$$\frac{(65.9 – 55.4)}{55.4} = 0.1895$$

$$\frac{(46.6 – 65.9)}{65.9} = -0.2929$$

$$\frac{(14.8 – 46.6)}{46.6} = -0.6824$$

$$E(r) = - 0.26$$

$$Varianz = \frac{1}{3}\cdot[(0.19-(-0.26))^2+(-0.29-(-0.26))^2+(-0.68-(-0.26))^2]=12.72\%$$
`,
        correct: true,
        // prettier-ignore
        value: String.raw`$$σ^2_x = 12.72\%$$`,
      },
      {
        feedback: 'Falsch!',
        // prettier-ignore
        value: String.raw`$$σ^2_x = 19.08\%$$`,
      },
      {
        feedback: 'Falsch!',
        // prettier-ignore
        value: String.raw`$$σ^2_x = 35.66\%$$`,
      },
      {
        feedback: 'Falsch!',
        // prettier-ignore
        value: String.raw`$$σ^2_x = 364.44\%$$`,
      },
      {
        feedback: 'Falsch!',
        // prettier-ignore
        value: String.raw`$$σ^2_x = 485.92\%$$`,
      },
    ],
  },
  {
    id: 41,
    name: 'Modul 1 Standardabweichung',
    content: `Folgend siehst du den Aktienkurs- und Aktienrenditeverlauf der UBS in täglicher Frequenz über den Zeitraum 2005 bis 2008:
![Varianz 1](https://sos-ch-dk-2.exo.io/klicker-prod/img/modul1_varianz1.png)
![Varianz 2](https://sos-ch-dk-2.exo.io/klicker-prod/img/modul1_varianz2.png)
Zusätzlich liegen dir folgende Daten mit jährlicher Frequenz vor:
![Varianz 3](https://sos-ch-dk-2.exo.io/klicker-prod/img/modul1_varianz3.png)
Berechnene die Standardabweichung der jährlichen Aktienrenditen über den Zeitraum 2005 bis 2008.`,
    contentPlain: `Folgend siehst du den Aktienkurs- und Aktienrenditeverlauf der UBS in täglicher Frequenz über den Zeitraum 2005 bis 2008:
BILD
BILD
Zusätzlich liegen dir folgende Daten mit jährlicher Frequenz vor:
BILD
erechnene die Standardabweichung der jährlichen Aktienrenditen über den Zeitraum 2005 bis 2008.`,
    type: QuestionType.SC,
    choices: [
      {
        feedback: 'Falsch!',
        // prettier-ignore
        value: String.raw`$$σ_x = 16.18\%$$`,
      },
      {
        feedback: String.raw`
Korrekt!

$$Standardabweichung = \sqrt{0.1272} = 35.67\%$$
`,
        correct: true,
        // prettier-ignore
        value: String.raw`$$σ_x = 35.67\%$$`,
      },
      {
        feedback: 'Falsch!',
        // prettier-ignore
        value: String.raw`$$σ_x = 43.68\%$$`,
      },
      {
        feedback: 'Falsch!',
        // prettier-ignore
        value: String.raw`$$σ_x = 83.8\%$$`,
      },
      {
        feedback: 'Falsch!',
        // prettier-ignore
        value: String.raw`$$σ_x = 1.618\%$$`,
      },
    ],
  },
  {
    id: 42,
    name: 'Modul 1 Wochenvolatilität',
    content: `Folgend siehst du den Aktienkurs- und Aktienrenditeverlauf der UBS in täglicher Frequenz über den Zeitraum 2005 bis 2008:
![Varianz 1](https://sos-ch-dk-2.exo.io/klicker-prod/img/modul1_varianz1.png)
![Varianz 2](https://sos-ch-dk-2.exo.io/klicker-prod/img/modul1_varianz2.png)
Zusätzlich liegen dir folgende Daten mit jährlicher Frequenz vor:
![Varianz 3](https://sos-ch-dk-2.exo.io/klicker-prod/img/modul1_varianz3.png)
Berechne die Wochenvolatilität der jährlichen Aktienrenditen für den Zeitraum 2005 bis 2008. (Annahme: Ein Jahr hat 50 Handelswochen.)`,
    contentPlain: `Folgend siehst du den Aktienkurs- und Aktienrenditeverlauf der UBS in täglicher Frequenz über den Zeitraum 2005 bis 2008:
BILD
BILD
Zusätzlich liegen dir folgende Daten mit jährlicher Frequenz vor:
BILD
Berechne die Wochenvolatilität der jährlichen Aktienrenditen für den Zeitraum 2005 bis 2008. (Annahme: Ein Jahr hat 50 Handelswochen.)`,
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
        feedback: String.raw`
Korrekt!

$$Wochenvolatilität = \frac{Jahresvolatilität}{\sqrt{50}} = 5.04\%$$
  `,
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
    id: 43,
    name: 'Modul 1 Geometric (Time-weighted) Average Return',
    content: `Ein Investor möchte die jährliche Durchschnittsrendite seiner Investition über die letzten Jahre ausrechnen. Diese Investition hat folgende Renditen in den letzten Jahren abgeworfen.
![Geometric Return](https://sos-ch-dk-2.exo.io/klicker-prod/img/modul1_geometric_time-weighted_average_return.png)
Wie gross ist der geometrische Durchschnitt dieser Investition?`,
    contentPlain: `Ein Investor möchte die jährliche Durchschnittsrendite seiner Investition über die letzten Jahre ausrechnen. Diese Investition hat folgende Renditen in den letzten Jahren abgeworfen.
BILD
Wie gross ist der geometrische Durchschnitt dieser Investition?`,
    type: QuestionType.SC,
    choices: [
      {
        feedback: 'Falsch!',
        value: '0.0%',
      },
      {
        feedback: String.raw`
Korrekt!

$$Terminal Value=(1+0.25)*(1+0.10)*(1-0.15)=1.169$$

$$Geometric Average Return=1.169^\frac{1}{3}-1=5.3\%$$
`,
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
    id: 44,
    name: 'Modul 1 Risikoaversion',
    content:
      'Welche der folgenden Aussagen ist **richtig**? (A = Index für Risikoaversion)',
    contentPlain:
      'Welche der folgenden Aussagen ist richtig? (A = Index für Risikoaversion)',
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
    id: 45,
    name: 'Modul 1 Nutzenfunktionen',
    content: String.raw`Gehe von folgender Ausgangssituation aus:
![Nutzenfunktionen](https://sos-ch-dk-2.exo.io/klicker-prod/img/modul1_nutzenfunktion.png)
Die Nutzenfunktion des Investors beträgt U=E(r)-\frac{A}{2}*SD^2$$, wobei A=4.0 ist.
Welches Investment wird der Anleger tätigen?`,
    contentPlain: String.raw`Gehe von folgender Ausgangssituation aus:
BILD
Die Nutzenfunktion des Investors beträgt U=E(r)-$$\frac{A}{2}*SD^2$$, wobei A=4.0 ist.
Welches Investment wird der Anleger tätigen?`,
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
        feedback: String.raw`Korrekt! U(3)=0.21-$$\frac{4}{2}*0.16^2=15.88$$`,
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
    id: 46,
    name: 'Modul 1 Statistische Kennzahlen',
    content: '',
    contentPlain:
      'Überprüfe die folgenden Aussagen zu den statistischen Kennzahlen auf ihre Richtigkeit.',
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
        feedback:
          'Diese Aussage ist nicht korrekt! Bei der Normalverteilung werden "Fat Tails" **nicht** berücksichtigt.',
        value: 'Bei der Normalverteilung werden "Fat Tails" berücksichtigt.',
      },
      {
        feedback:
          'Diese Aussage ist nicht korrekt! Die Schiefe einer Normalverteilung beträgt null.',
        value: 'Die Schiefe einer Normalverteilung beträgt eins.',
      },
    ],
  },
  {
    id: 47,
    name: 'Modul 1 Capital Allocation Line',
    content: '',
    contentPlain:
      'Überprüfe die folgenden Aussagen zur Indifferenzkurve und zur Capital Allocation Line (CAL) auf ihre Richtigkeit.',
    type: QuestionType.KPRIM,
    choices: [
      {
        feedback: 'Diese Aussage ist korrekt!',
        correct: true,
        value:
          'Die Indifferenzkurve stellt die Risikoneigung des Investors dar.',
      },
      {
        feedback:
          'Diese Aussage ist nicht korrekt! Es ist genau umgekehrt: Je höher die Risikoaversion des Investors ist, desto steiler ist die entsprechende Indifferenzkurve.',
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
<<<<<<< HEAD
  {
    id: 48,
    name: 'Modul 2 Diversifikation I',
    content:
      'Welche der folgenden Aussagen zur **Diversifikation** ist **falsch**?',
    contentPlain:
      'Welche der folgenden Aussagen zur Diversifikation ist falsch?',
    type: QuestionType.SC,
    choices: [
      {
        feedback:
          'Falsch! Diese Aussage ist korrekt.',
        value:
          'Das Portfolio-Risiko lässt sich nur dann wegdiversifizieren, wenn die Anlagen perfekt negativ korreliert sind.',
      },
      {
        feedback:
          ' Richtig, diese Aussage ist nicht korrekt! Das Marktrisiko (systematisches Risiko) lässt sich durch Diversifikation nicht vermeiden. Nur firmenspezifische (unsystematische) Risiken können dadurch reduziert werden.',
        correct: true,
        value: 'Das Marktrisiko lässt sich durch eine Streuung in unterschiedliche Anlagen vollständig wegdiversifizieren.',
      },
      {
        feedback: 'Falsch! Bei risikofreudigen Investoren gilt A<0.',
        value: 'Mit zunehmender Anzahl an Anlagen im Portfolio nimmt die Wirkung weiterer Diversifikation ab.',
      },
      {
        feedback: 'Falsch! Diese Aussage ist korrekt.',
        value:
          'Die durchschnittliche Kovarianz zwischen verschiedenen Anlagen ist null, wenn das Risiko vollständig auf firmenspezifische Gründe zurückzuführen ist.',
      },
      {
        feedback: 'Falsch! Diese Aussage ist korrekt.',
        value: 'Im Falle einer positiven (aber nicht perfekt positiven) Korrelation zwischen den Anlagen entspricht das systematische Risiko bei zunehmender Diversifikation der durchschnittlichen Kovarianz.',
      },
    ],
  },
  {
    id: 49,
    name: 'Modul 2 Diversifikation II',
    content:
      'Unter welcher **Bedingung** ist der **Diversifikationseffekt** (ceteris paribus) am **grössten**?',
    contentPlain:
      'Unter welcher Bedingung ist der Diversifikationseffekt (ceteris paribus) am grössten?',
    type: QuestionType.SC,
    choices: [
      {
        feedback:
          'Falsch! Nicht perfekt positiv korrelierte Renditen ermöglichen zwar einen Diversifikationseffekt, jedoch wird dieser umso grösser, je negativer die Korrelation zwischen den Renditen ist.',
        value:
          'Die erwarteten Renditen sind positiv korreliert.',
      },
      {
        feedback:
          ' Falsch! Unkorrelierte Renditen ermöglichen zwar einen Diversifikationseffekt, jedoch wird dieser grösser, falls die Korrelation zwischen den Renditen negativ ist.',
        value: 'Die erwarteten Renditen sind unkorreliert.',
      },
      {
        feedback: 'Falsch! Die Standardabweichung spielt für den Diversifikationseffekt eine untergeordnete Rolle, ausschlaggebend ist die Korrelation.',
        value: 'Die Standardabweichung ist sehr klein.',
      },
      {
        feedback: 'Falsch! Die Standardabweichung spielt für den Diversifikationseffekt eine untergeordnete Rolle, ausschlaggebend ist die Korrelation.',
        value:
          'Die Standardabweichung ist sehr gross.',
      },
      {
        feedback: 'Korrekt!',
        correct: true,
        value: 'Die erwarteten Renditen sind negativ korreliert.',
      },
    ],
  },
  {
    id: 50,
    name: 'Modul 2 Efficient Frontier',
    content:
      'Die Efficient Frontier setzt sich zusammen aus:',
    contentPlain:
      'Die Efficient Frontier setzt sich zusammen aus:',
    type: QuestionType.SC,
    choices: [
      {
        feedback:
          'Korrekt! Portfolios auf der Efficient Frontier zeichnen sich dadurch aus, dass sie die grösste erwartete Rendite zu einer gegebenen Standardabweichung liefern. Dies trifft jedoch nur auf die Portfolios zu, welche oberhalb des (globalen) Minimum-Varianz-Portfolios liegen.',
        correct: true,
        value:
          'Den Portfolios, welche oberhalb des Minimum-Varianz-Portfolios liegen.',
      },
      {
        feedback:
          ' Falsch! Eine hohe Standardabweichung muss nicht zwingend zu einer hohen Portfoliorendite führen, dies gilt nur für optimal diversifizierte Portfolios.',
        value: 'Den Portfolios, welche über die höchste Standardabweichung und somit die grösste Rendite verfügen.',
      },
      {
        feedback: 'Falsch! Eine tiefe Standardabweichung führt nicht automatisch dazu, dass das Portfolio optimal diversifiziert ist und daher müssen solche Portfolios nicht zwingend auf der Efficient Frontier liegen.',
        value: 'Den Portfolios, welche die kleinste Standardabweichung aufweisen.',
      },
      {
        feedback: 'Falsch! Portfolios mit tiefer Korrelation müssen nicht zwingend optimal sein. relevant ist, dass die Rendite-Risiko-Relation optimal ist.',
        value:
          'Den Portfolios, welche die geringste Korrelation aufweisen.',
      },
      {
        feedback: 'Falsch!  Portfolios mit einem tiefen Beta müssen nicht ein optimales Risiko-Rendite-Verhältnis aufweisen',
        value: 'Den Portfolios, welche ein tiefes Beta aufweisen.',
      },
    ],
  },
  {
    id: 51,
    name: 'Modul 2 Capital Allocation Line',
    content:
      'Damit ein Investor in ein Portfolio auf der Capital Allocation Line rechts vom optimalen risikobehaftetem Portfolio investieren kann, muss er ...',
    contentPlain:
      'Damit ein Investor in ein Portfolio auf der Capital Allocation Line rechts vom optimalen risikobehaftetem Portfolio investieren kann, muss er ...',
    type: QuestionType.SC,
    choices: [
      {
        feedback:
          'Falsch!',
        value:
          'Kapital zum risikolosen Zinssatz aufnehmen und dieses in die risikolose Anlage sowie in das optimale Risikoportfolio auf der Capital Allocation Line investieren.',
      },
      {
        feedback:
          'Korrekt!',
        correct: true,
        value: 'Eine Netto-Short-Position in der risikolosen Anlage eingehen und das Kapital in das optimale Risikoportfolio auf der Capital Allocation Line investieren.',
      },
      {
        feedback: 'Falsch! Eine tiefe Standardabweichung führt nicht automatisch dazu, dass das Portfolio optimal diversifiziert ist und daher müssen solche Portfolios nicht zwingend auf der Efficient Frontier liegen.',
        value: 'Den Portfolios, welche die kleinste Standardabweichung aufweisen.',
      },
      {
        feedback: 'Falsch!',
        value:
          'Eine Netto-Short-Position in der risikolosen Anlage eingehen und das Kapital in ein drittes Portfolio rechts vom optimalen Risikoportfolio investieren.',
      },
      {
        feedback: 'Falsch!',
        value: 'Ein Portfolio auf der Capital Allocation Line rechts vom optimalen Risikoportfolio kann nicht erreicht werden.',
      },
    ],
  },
  {
    id: 52,
    name: 'Modul 2 Portfoliobildung I',
    content:
      'Ein Portfolio besteht aus zwei risikoreichen Anlagen, welche **positiv** miteinander korrelieren (jedoch nicht perfekt). Welche der folgenden Aussagen ist ausgehend von diesen Informationen **richtig**?',
    contentPlain:
      'Ein Portfolio besteht aus zwei risikoreichen Anlagen, welche positiv miteinander korrelieren (jedoch nicht perfekt). Welche der folgenden Aussagen ist ausgehend von diesen Informationen richtig?',
    type: QuestionType.SC,
    choices: [
      {
        feedback:
          'Falsch! Auch im Falle einer positiven Korrelation resultiert eine Portfolio-Standardabweichung, welche unter dem Mittelwert der einzelnen Standardabweichungen liegt.',
        value:
          'Die Standardabweichung des Portfolios ist stets grösser als der Mittelwert der einzelnen Standardabweichungen zusammen.',
      },
      {
        feedback:
          'Korrekt!',
        correct: true,
        value: 'Die Standardabweichung des Portfolios ist stets kleiner als der Mittelwert der einzelnen Standardabweichungen zusammen.',
      },
      {
        feedback: 'Falsch! Auch im Falle einer positiven Korrelation resultiert eine Portfolio-Standardabweichung, welche unter dem Mittelwert der einzelnen Standardabweichungen liegt.',
        value: 'Die Standardabweichung des Portfolios ist stets gleich gross wie der Mittelwert der einzelnen Standardabweichungen zusammen.',
      },
      {
        feedback: 'Falsch! Ceteris paribus würde die erwartete Rendite zunehmen.',
        value:
          'Je kleiner die Korrelation zwischen den beiden Anlagen, umso kleiner ist (ceteris paribus) die erwartete Rendite.',
      },
      {
        feedback: 'Falsch!',
        value: 'Keine der Aussagen ist richtig.',
      },
    ],
  },
  {
    id: 53,
    name: 'Modul 2 Portfoliobildung II',
    content:
    `Gehe von folgender Ausgangssituation aus:
    (Bild_modul2_portfoliobildung_II)
    Wie hoch ist die erwartete Rendite und die Standardabweichung eines Portfolios, welches 35% des Kapitals in Aktie A und 65% in Aktie B investiert hat?`,
    contentPlain:
    `Gehe von folgender Ausgangssituation aus:
    (Bild_modul2_portfoliobildung_II)
    Wie hoch ist die erwartete Rendite und die Standardabweichung eines Portfolios, welches 35% des Kapitals in Aktie A und 65% in Aktie B investiert hat?`,
    type: QuestionType.SC,
    choices: [
      {
        feedback:
          'Falsch! Die erwartete Rendite einer Anlage entspricht der wahrscheinlichkeitsgewichteten Summe der möglichen Renditerealisationen. $$E(r_A)=13\%, E(r_B)=8.4\%$$. Die erwartete Rendite des Portfolios entspricht der kapitalgewichteten Summe der erwarteten Renditen der einzelnen Anlagen. $$E(r_p)=10.01\%$$.',
        value:
          '$$E(r_p)=13.9\%; SD=2.98\%$$',
      },
      {
        feedback:
          'Falsch! Die erwartete Rendite einer Anlage entspricht der wahrscheinlichkeitsgewichteten Summe der möglichen Renditerealisationen. $$E(r_A)=13\%, E(r_B)=8.4\%$$. Die erwartete Rendite des Portfolios entspricht der kapitalgewichteten Summe der erwarteten Renditen der einzelnen Anlagen. $$E(r_p)=10.01\%$$.',
        value: '$$E(r_p)=13.9\%; SD=2.10\%$$',
      },
      {
        feedback: 'Falsch! Die erwartete Rendite einer Anlage entspricht der wahrscheinlichkeitsgewichteten Summe der möglichen Renditerealisationen. $$E(r_A)=13\%, E(rB)=8.4\%$$. Die erwartete Rendite des Portfolios entspricht der kapitalgewichteten Summe der erwarteten Renditen der einzelnen Anlagen. $$E(rp)=10.01\%$$.',
        value: '$$E(r_p)=13.9\%; SD=3.00\%$$',
      },
      {
        feedback: 'Falsch! Die Varianz einer Anlage entspricht der wahrscheinlichkeitsgewichteten Summe der quadrierten Abweichungen zwischen möglicher Renditerealisation und erwarteter Rendite. Daraus folgt: SDA=2.45%; SDB=1.66%. Die Standardabweichung des Portfolios wird wie folgt berechnet: $$SD_p=\sqrt{(0.35)^2*(0.0245)^2+(0.65)^2*(0.0166)^2+2*(0.35)*(0.65)*(0.0245)*(0.0166)*(0.5919))}=1.73\%$$.',
        value:
          '$$E(r_p)=10.01\%; SD=2.98\%$$',
      },
      {
        feedback: 
`Korrekt!
E(r_A) = 0.15 * 8\% + 0.2 * 13\% + … + 0.2 * 16\% = 13.00\%
E(r_B) = 0.15 * 8\% + 0.2 * 7\% + … + 0.2 * 11\% = 8.40\%
E(r_{PF}) = 0.35 * 13.00\% + 0.65 * 8.40\% = 10.01\%
Var_A = 0.15 * (8\% - 13\%)^2 + … + 0.2 * (16\% - 13\%)^2 = 0.0006
SDA = \sqrt{Var_A} = 0.024495 = 2.45\%
Var_B = 0.15 * (8\% - 8.4\%)^2 + … + 0.2 * (11\% - 8.4\%)^2 = 0.000274
SDB = \sqrt{Var_B} = 0.016553 = 1.66\%
Cov(A,B) = E(r_Ar_B) – E(r_A) * E(r_B) = 1.116\% - 13\% * 8.4\% = 0.00024
E(r_Ar_B) = 0.15 * 8\% * 8\% + … + 0.2 * 16\% * 11\% = 0.01116 = 1.116\%
Corr(A,B) = Cov(A,B) / (SDA * SDB) = 0.5919
Var_{PF} = 0.352 * Var_A + 0.652 * Var_B + 2 * 0.35 * 0.65 * SDA * SDB * Corr(A,B) = 0.00029847
SD_{PF}  = \sqrt{Var_{PF}} = 0.017276 = 1.73\%`,
        correct: true,
        value: '$$E(r_p)=10.01\%; SD=1.73\%$$',
      },
    ],
  },
  {
    id: 53,
    name: 'Modul 2 Portfoliobildung III',
    content:
    `Gehe von folgender Ausgangssituation aus:
    Anlage A: $$E(r_A)=12\%; SDA=17\%$$
    Anlage B: $$E(r_B)=9\%; SDB=14\%$$
    Korrelation: r=-1
    Welche Gewichtung weisen die Anlage A und Anlage B im globalen Minimum-Varianz-Portfolio auf?`,
    contentPlain:
    `Gehe von folgender Ausgangssituation aus:
    Anlage A: $$E(r_A)=12\%; SDA=17\%$$
    Anlage B: $$E(r_B)=9\%; SDB=14\%$$
    Korrelation: r=-1
    Welche Gewichtung weisen die Anlage A und Anlage B im globalen Minimum-Varianz-Portfolio auf?`,
    type: QuestionType.SC,
    choices: [
      {
        feedback:
          'Falsch!',
        value:
          '$$w_A=0.24; w_B=0.76$$',
      },
      {
        feedback:
          'Korrekt! $$w_A=\frac{14}{(17+14)}=0.45; w_B=1-0.45=0.55$$',
        correct: true,
        value: '$$w_A=0.45; w_B=0.55$$',
      },
      {
        feedback: 'Falsch!',
        value: '$$w_A=0.50; w_B=0.50$$',
      },
      {
        feedback: 'Falsch!',
        value:
          '$$w_A=0.57; w_B=0.43$$',
      },
      {
        feedback: 'Falsch'
        value: '$$w_A=0.76; w_B=0.24$$',
      },
    ],
  },
  {
    id: 54,
    name: 'Modul 2 Portfoliobildung IV',
    content:
    `Gehe von folgender Ausgangssituation aus:
    Aktie A weist eine erwartete Rendite von 10% bei einer Standardabweichung von 18% auf. Aktie B hingegen verfügt über eine erwartete Rendite von 17% bei einer Standardabweichung von 29%. Welchen Wert hat die Kovarianz, wenn die Korrelation 0.4 beträgt? (Auf zwei Nachkommastellen gerundet.)`,
    contentPlain:
    `Gehe von folgender Ausgangssituation aus:
    Aktie A weist eine erwartete Rendite von 10% bei einer Standardabweichung von 18% auf. Aktie B hingegen verfügt über eine erwartete Rendite von 17% bei einer Standardabweichung von 29%. Welchen Wert hat die Kovarianz, wenn die Korrelation 0.4 beträgt? (Auf zwei Nachkommastellen gerundet.)`,
    type: QuestionType.SC,
    choices: [
      {
        feedback:
          'Falsch!',
        value:
          '$$Cov(r_A,r_B)=0.01$$',
      },
      {
        feedback:
          'Korrekt! $$Cov(r_A,r_B)=0.4*0.18*0.29=0.02$$',
        correct: true,
        value: '$$Cov(r_A,r_B)=0.02$$',
      },
      {
        feedback: 'Falsch!',
        value: '$$Cov(r_A,r_B)=0.03$$',
      },
      {
        feedback: 'Falsch!',
        value:
          '$$Cov(r_A,r_B)=0.04$$',
      },
      {
        feedback: 'Falsch'
        value: 'Die Angaben reichen für die Berechnung nicht aus.',
      },
    ],
  },
  {
    id: 55,
    name: 'Modul 2 Diversifikation',
    content: "",
    contentPlain: 'Beurteile folgende Aussagen auf ihre Richtigkeit.',
    type: QuestionType.KPRIM,
    choices: [
      {
        feedback:
          'Diese Aussage ist korrekt!',
        correct: true,
        value:
          'Bei einem gut diversifizierten, gleichgewichteten Portfolio ist das Portfoliorisiko abhängig von der Kovarianz/Korrelation zwischen den Renditen der Anlagen im Portfolio.',
      },
      {
        feedback: 'Diese Aussage ist nicht korrekt! Es führt zu einem erhöhten Risiko, falls eine tiefe Korrelation vorliegt.',
        value:
          'Bei Strukturierten Produkten mit einem Worst-of-Mechanismus führt eine hohe Korrelation zu einem erhöhten Risiko für den Investor.',
      },
      {
        feedback: 'Diese Aussage ist nicht korrekt!  Es ist keine hohe Korrelation erwünscht, da Hedge Funds dem Portfolio beigemischt werden, aufgrund ihrer tiefen Korrelation zu anderen Märkten.',
        value:
          'Bei einem Funds of Hedge Funds ist der Diversifikationseffekt erwünscht, da eine möglichst hohe Korrelation mit den anderen Märkten angestrebt wird.',
      },
      {
        feedback:
          'Diese Aussage ist korrekt!',
        correct: true,
        value:
          'Je breiter das Portfolio eines Hedge Funds diversifiziert ist, desto höher ist die Korrelation mit dem Aktienmarkt.',
      },
    ],
  },
  {
    id: 56,
    name: 'Modul 2 Capital Market Line',
    content: "",
    contentPlain: 'Beurteile folgende Aussagen auf ihre Richtigkeit.',
    type: QuestionType.KPRIM,
    choices: [
      {
        feedback:
          'Diese Aussage ist korrekt! Im Fokus steht die “Kernbotschaft“ der CML. Der generelle Investor ist bereit alle auf der CML liegenden Risiko-Rendite Kombinationen zu akzeptieren. Zusatz: Für einen spezifischen Investor mit spezifischer Risikoneigung würde sich dann ein spezifisches Portfolio (Kombination aus risikoloser Anlage und Marktportfolio) ergeben.',
        correct: true,
        value:
          ' Auf der Capital Market Line (CML) liegen alle Risiko-Rendite Kombinationen, die der Investor bereit ist zu akzeptieren.',
      },
      {
        feedback: 'Diese Aussage ist ist korrekt! Einzelne Wertpapiere und deren Risikoprämien werden mithilfe der SML analysiert (nicht auf Portfolio-Ebene).',
        value:
          'Mit der Capital Market Line (CML) kann die Risikoprämie eines Wertpapiers ermittelt werden.',
      },
      {
        feedback: 'Diese Aussage ist nicht korrekt! Die Sharpe-Ratio bildet die Steigung der CAL.',
        value:
          'Die Steigung der Security Market Line (SML) entspricht der Sharpe-Ratio.',
      },
      {
        feedback:
          'Diese Aussage ist nicht korrekt! Bei der CML wird das gesamte Risiko angeschaut und bei der SML nur das systematische Risiko.',
        value:
          'Die Capital Market Line (CML) stellt einen Zusammenhang zwischen der erwarteten Rendite und dem systematischen Risiko dar.',
      },
    ],
  },
  {
    id: 57,
    name: 'Modul 2 Marktportfolio',
    content:
      'Welche der folgenden Aussagen ist **falsch**?',
    contentPlain:
      'Welche der folgenden Aussagen ist falsch?',
    type: QuestionType.SC,
    choices: [
      {
        feedback:
          'Falsch! Diese Aussage ist korrekt.',
        value:
          'Das Marktportfolio beinhaltet alle gehandelten Risikoanlagen.',
      },
      {
        feedback:
          'Falsch! Diese Aussage ist korrekt.',
        value: 'Das Marktportfolio liegt auf der Efficient Frontier.',
      },
      {
        feedback: 'Richtig, diese Aussage ist nicht korrekt! Das Marktportfolio liegt auf dem Tangentialpunkt zwischen der Efficient Frontier und der Capital Market Line (CML).',
        correct: true,
        value: 'Das Marktportfolio liegt auf dem Tangentialpunkt zwischen der Capital Market Line (CML) und der Indifferenzkurve jedes Investors.',
      },
      {
        feedback: 'Falsch! Diese Aussage ist korrekt.',
        value:
          'Die Gewichtung einer Anlage im Marktportfolio entspricht seiner Marktkapitalisierung dividiert durch die Marktkapitalisierung aller Anlagen.',
      },
      {
        feedback: 'Falsch! Diese Aussage ist korrekt.',
        value: 'Das Marktportfolio hat ein Beta von 1.',
      },
    ],
  },
  {
    id: 58,
    name: 'Modul 2 Security Market Line',
    content:
      'Welche der folgenden Aussagen ist **richtig**?',
    contentPlain:
      'Welche der folgenden Aussagen ist richtig?',
    type: QuestionType.SC,
    choices: [
      {
        feedback:
          'Falsch! Die Steigung der SML berechnet sich folgendermassen: E(rM)-rf. Im CAPM werden risikoreichere Aktien mit einer grösseren Rendite, risikoärmere Aktien mit einer kleineren Rendite belohnt. Aus dieser theoretischen Perspektive hat die SML folglich zwingend eine positive Steigung. Zusatz: Die SML kann – empirisch gesehen – auch eine negative Steigung aufweisen. Dies ist der Fall, wenn nicht-risikoadjustierte Renditen von Aktientiteln mit tieferem Beta höher sind als diejenigen von Aktientiteln mit höherem Beta. Dies würde jedoch nicht mehr den CAPM Annahmen entsprechen.',
        value:
          'Die Security Market Line (SML) hat nicht zwingend eine positive Steigung (CAPM Annahmen).',
      },
      {
        feedback:
          'Korrekt!',
        correct: true,
        value: 'Eine Aktie, die unter der SML liegt, ist überbewertet.',
      },
      {
        feedback: 'Falsch! Gemäss CAPM sollte jede Anlage auf der SML liegen. Liegt eine Aktie unter der SML, so ist sie überbewertet, da sie im Verhältnis zu ihrem Risiko eine zu geringe Rendite aufweist. In einem effizienten Markt wird sich die Nachfrage nach dieser Aktie verringern und der Preis wieder auf der SML einpendeln.',
        value: 'Nur das Marktportfolio, nicht aber die einzelnen Aktien, liegen auf der SML.',
      },
      {
        feedback: 'Falsch! Die SML drückt die Beziehung zwischen dem erwarteten Return und dem Marktrisiko (systematische Risiko) aus.',
        value:
          'Die SML drückt die Beziehung zwischen dem erwarteten Return und dem Portfoliorisiko aus.',
      },
      {
        feedback: 'Falsch!',
        value: 'Keine der genannten Aussagen ist richtig.',
      },
    ],
  },
  {
    id: 59,
    name: 'Modul 2 Überrendite Alpha I',
    content:
      'Unterbewertete Aktien haben gemäss dem CAPM ein...',
    contentPlain:
      'Unterbewertete Aktien haben gemäss dem CAPM ein...',
    type: QuestionType.SC,
    choices: [
      {
        feedback:
          'Falsch! Unterbewertete Aktien haben gemäss dem CAPM ein positives Alpha.',
        value:
          'negatives Alpha.',
      },
      {
        feedback:
          'Falsch! Nur aufgrund des Betas lässt sich keine Aussage über Unter- oder Überbewertung machen.',
        value: 'negatives Beta.',
      },
      {
        feedback: 'Falsch! Nur aufgrund des Betas lässt sich keine Aussage über Unter- oder Überbewertung machen.',
        value: 'positives Beta.',
      },
      {
        feedback: 'Falsch! Unterbewertete Aktien haben gemäss dem CAPM ein positives Alpha.',
        value:
          'Alpha von null.',
      },
      {
        feedback: 'Korrekt!',
        correct: true,
        value: 'positives Alpha.',
      },
    ],
  },
  {
    id: 60,
    name: 'Modul 2 Überrendite Alpha II',
    content:
`Gehe von folgender Ausgangssituation aus:
(Bild_modul2_ueberrendite_alpha_II)
Die Marktrendite beträgt 8.5% und der risikolose Zinssatz 4%. Welche Anlage wird ein Investor eher kaufen und aus welchem Grund?`,
    contentPlain:
`Gehe von folgender Ausgangssituation aus:
(Bild_modul2_ueberrendite_alpha_II)
Die Marktrendite beträgt 8.5% und der risikolose Zinssatz 4%. Welche Anlage wird ein Investor eher kaufen und aus welchem Grund?`,
    type: QuestionType.SC,
    choices: [
      {
        feedback:
          `Korrekt! A's erwartete Überrendite (Alpha) beträgt: 0.12-[0.04+1.2*(0.085-0.04)]=2.6%, das Alpha von B hingegen beträgt: 0.14-[0.04+1.8*(0.085-0.04)]=1.9%.`,
        correct: true,
        value:
        'A, da A eine erwartete Überrendite (Alpha) von 2.6% aufweist.',
      },
      {
        feedback:
          `Falsch! A's erwartete Überrendite (Alpha) beträgt: 0.12-[0.04+1.2*(0.085-0.04)]=2.6%.`,
        value: 'A, da A ein Alpha von 2.7% aufweist.',
      },
      {
        feedback: `Falsch! A's erwartete Überrendite (Alpha) beträgt: 0.12-[0.04+1.2*(0.085-0.04)]=2.6%, das Alpha von B hingegen beträgt: 0.14-[0.04+1.8*(0.085-0.04)]=1.9%. Das Alpha von A ist grösser als dasjenige von B und daher bevorzugt ein Investor die Anlage A`,
        value: 'B, da B ein Alpha von 1.9% aufweist.',
      },
      {
        feedback: 'Falsch! Die erwartete Rendite muss noch mit der Rendite gemäss CAPM verglichen werden.',
        value:
          'B, da B eine erwartete Rendite von 12% aufweist.',
      },
      {
        feedback: 'Falsch! B, da B ein höheres Beta besitzt',
        value: 'Ohne die Renditebetrachtung kann mit dem Beta keine Aussage gemacht werden.',
      },
    ],
  },
  {
    id: 61,
    name: `Modul 2 Annahmen des CAPM's`,
    content: 'Welche der folgenden Aussagen ist gemäss den theoretischen Annahmen des CAPM **richtig**?',
    contentPlain:
    'Welche der folgenden Aussagen ist gemäss den theoretischen Annahmen des CAPM richtig?',
    type: QuestionType.SC,
    choices: [
      {
        feedback: 'Falsch! Rationale Investoren werden nie in Aktien investieren, die unterhalb der SML liegen, da diese Aktien überbewertet, d.h. gemessen an der erwarteten Rendite zu teuer sind.',
        value:
        'Rationale Investoren investieren vorzugsweise in Aktien, welche unterhalb der Security Market Line (SML) liegen.',
      },
      {
        feedback:
          `Falsch! Bei uneingeschränkt vielen Marktteilnehmern kann ein Investor keinen Einfluss auf die Preise einzelner Aktien ausüben.`,
        value: 'Ein einzelner Investor kann auf die Marktpreise einzelner Aktien Einfluss nehmen.',
      },
      {
        feedback: `Falsch! Investoren haben homogene Risiko- und Renditeerwartungen.`,
        value: 'Investoren haben heterogene Risiko- und Renditeerwartungen.',
      },
      {
        feedback: 'Korrekt! Die erwartete Rendite muss noch mit der Rendite gemäss CAPM verglichen werden.',
        correct: true,
        value:
          'Alle Investoren sind gezwungen zu gegebenen Marktpreisen zu investieren.',
      },
      {
        feedback: 'Falsch!',
        value: 'Keine der genannten Aussagen ist korrekt.',
      },
    ],
  },
  {
    id: 62,
    name: 'Modul 2 Low-Risk-Anomalie',
    content: "",
    contentPlain: 'Beurteile folgende Aussagen auf ihre Richtigkeit.',
    type: QuestionType.KPRIM,
    choices: [
      {
        feedback:
          'Diese Aussage ist korrekt!',
        correct: true,
        value:
          ' Die Low-Risk-Anomalie besagt, dass Titel mit einem tiefen Beta in der langen Frist im Durchschnitt eine höhere Rendite abwerfen als Titel mit einem hohen Beta.',
      },
      {
        feedback: 'Diese Aussage ist nicht korrekt! Genau der umgekehrte Fall ist korrekt: Die Beta-Streuung ist in steigenden Märkten tief und in fallenden Märkten (Krisen) hoch.',
        value:
          'Eine mögliche Erklärung der Low-Risk-Anomalie ist, dass die Beta-Streuung in fallenden Märkten tief und in steigenden Märkten sehr hoch ist.',
      },
      {
        feedback: 'Diese Aussage ist korrekt!',
        correct: true,
        value:
          'Bei der Low-Risk-Strategie erhöht sich das Beta des Portfolios, falls die Marktvolatilität sinkt.',
      },
      {
        feedback:
          'Diese Aussage ist nicht korrekt!',
        value:
          'Die Low-Risk-Strategie zeichnet sich dadurch aus, dass auch in der langen Frist immer ein Alpha generiert werden kann.',
      },
    ],
  },
  {
    id: 63,
    name: 'Modul 2 Annahmen der APT',
    content: 'Welche der folgenden Aussagen ist **falsch**?',
    contentPlain:
    'Welche der folgenden Aussagen ist falsch?',
    type: QuestionType.SC,
    choices: [
      {
        feedback: 'Falsch! Diese Aussage ist korrekt.',
        value:
        'Eine Annahme der Arbitrage Pricing Theorie (APT) lautet: Aktienrenditen lassen sich durch Faktormodelle beschreiben.',
      },
      {
        feedback:
          'Falsch! Diese Aussage ist korrekt.',
        value: 'Eine Annahme der APT lautet: Es gibt genügend Aktien, um unsystematische Risiken wegzudiversifizieren.',
      },
      {
        feedback: 'Falsch! Diese Aussage ist korrekt. Arbitragefreiheit ist eine Modellannahme in der Arbitrage Pricing Theory (theoretische Sicht). Zusatz: In der Realität ist diese Voraussetzung aber häufig nicht gegeben (Praxissicht).',
        value: 'Eine Annahme der APT lautet: Es existieren keine Arbitragemöglichkeiten.',
      },
      {
        feedback: 'Falsch! Diese Aussage ist korrekt.',
        value:
          'Zur Herleitung der APT sind alle obigen Annahmen notwendig.',
      },
      {
        feedback: 'Richtig, diese Aussage ist nicht korrekt! Die Annahmen des CAPM sind deutlich restriktiver als jene der APT. Beispielsweise geht die APT nicht von der Existenz eines allgemeinen Marktportfolios aus.',
        correct: true,
        value: 'Im Gegensatz zum CAPM sind die Annahmen der APT restriktiver.',
      },
    ],
  },
  {
    id: 64,
    name: 'Modul 2 CAPM und APT I',
    content: 'Welche der folgenden Aussagen ist **falsch**?',
    contentPlain:
    'Welche der folgenden Aussagen ist falsch?',
    type: QuestionType.SC,
    choices: [
      {
        feedback: 'Richtig, diese Aussage ist nicht korrekt! Die SML gibt einen linearen Zusammenhang zwischen dem Beta einer Aktie und deren erwartete Rendite an.',
        correct: true,
        value:
        'Die Security Market Line (SML) im CAPM gibt einen linearen Zusammenhang zwischen der erwarteten Rendite und der Standardabweichung der Renditen einer Aktie an.',
      },
      {
        feedback:
          'Falsch! Diese Aussage ist korrekt.',
        value: 'Sowohl das CAPM als auch die Arbitrage Pricing Theorie (APT) unterliegen dem "Law of One Price".',
      },
      {
        feedback: 'Falsch! Diese Aussage ist korrekt. Arbitragefreiheit ist eine Modellannahme in der Arbitrage Pricing Theory (theoretische Sicht). Zusatz: In der Realität ist diese Voraussetzung aber häufig nicht gegeben (Praxissicht).',
        value: 'Sowohl im CAPM als auch in der APT werden Investoren ausschliesslich für das Eingehen systematischer Risiken entschädigt.',
      },
      {
        feedback: 'Falsch! Diese Aussage ist korrekt.',
        value:
          'Sowohl im CAPM als auch in der APT gilt: Das Beta eines Portfolios bezüglich eines Risikofaktors entspricht der Linearkombination der Betas aller einzelnen Aktien im Portfolio bezüglich desselben Risikofaktors.',
      },
      {
        feedback: 'Falsch! Diese Aussage ist korrekt.',
        value: 'Im Gegensatz zum CAPM sind in der APT auch negative Risikoprämien möglich.',
      },
    ],
  },
  {
    id: 65,
    name: 'Modul 2 CAPM und APT II',
    content: 'Welche der folgenden Aussagen ist **richtig**?',
    contentPlain:
    'Welche der folgenden Aussagen ist richtig?',
    type: QuestionType.SC,
    choices: [
      {
        feedback: 'Falsch! Das Gegenteil ist richtig: Im CAPM wird - im Gegensatz zur APT - der systematische Risikofaktor (die Schwankungen relativ zum Marktportfolio) endogen durch das Modell bestimmt.',
        value:
        'Im Gegensatz zum CAPM werden die systematischen Risikofaktoren in der Arbitrage Pricing Theorie (APT) endogen durch das Modell bestimmt.',
      },
      {
        feedback:
          'Falsch! Die Aussagen der APT beruhen nicht auf der Existenz eines Marktportfolios.',
        value: 'Sowohl die APT als auch das CAPM setzen die Existenz eines allgemeinen Marktportfolios voraus.',
      },
      {
        feedback: 'Falsch! Das Gegenteil ist richtig: Aufgrund des Arbitragearguments ist die Konvergenzgeschwindigkeit in der APT höher als im CAPM.',
        value: 'In der APT ist die Konvergenzgeschwindigkeit inkorrekt bewerteter Aktienkurse zum Marktgleichgewicht tiefer als im CAPM.',
      },
      {
        feedback: 'Korrekt!',
        correct: true,
        value:
          'Das CAPM kann als ein Spezialfall der APT angesehen werden.',
      },
      {
        feedback: 'Falsch!',
        value: 'Keine der genannten Aussagen ist richtig.',
      },
    ],
  },
  {
    id: 66,
    name: 'Modul 2 CAPM und APT III',
    content: 'Die/das ________ liefert einen Zusammenhang zwischen der erwarteten Rendite und dem Beta eines jeden Assets, wohingegen die/das ________ einen solchen Zusammenhang für sämtliche Aktien exklusive einiger weniger Titel impliziert.',
    contentPlain:
    'Die/das ________ liefert einen Zusammenhang zwischen der erwarteten Rendite und dem Beta eines jeden Assets, wohingegen die/das ________ einen solchen Zusammenhang für sämtliche Aktien exklusive einiger weniger Titel impliziert.',
    type: QuestionType.SC,
    choices: [
      {
        feedback: 'Falsch!',
        value:
        'APT, CAPM',
      },
      {
        feedback:
          'Falsch!',
        value: 'APT, OPM (Option Pricing Model)',
      },
      {
        feedback: 'Korrekt! Das CAPM liefert einen Zusammenhang zwischen der erwarteten Rendite und dem Beta eines jeden Assets, wohingegen die APT einen solchen Zusammenhang für sämtliche Aktien exklusive einiger weniger Titel impliziert.',
        correct: true,
        value: 'CAPM, APT',
      },
      {
        feedback: 'Falsch!',
        value:
          'CAPM, OPM',
      },
      {
        feedback: 'Falsch!',
        value: 'Keine der genannten Aussagen ist richtig.',
      },
    ],
  },
  {
    id: 67,
    name: 'Modul 2 Arbitrage I',
    content: `Ausgangspunkt sei ein Ein-Faktor-APT. Das Portfolio A hat ein Beta von 0.2 und eine erwartete Rendite von 13%. Das Portfolio B besitzt ein Beta von 0.4 und eine erwartete Rendite von 15%. Der risikofreie Zinssatz ist 10%.
    Um eine allfällige Arbitragemöglichkeit auszunützen, kann ein Investor eine Short-Position im Portfolio ___ und eine Long-Position im Portfolio ___ einnehmen.`,
    contentPlain:
    `Ausgangspunkt sei ein Ein-Faktor-APT. Das Portfolio A hat ein Beta von 0.2 und eine erwartete Rendite von 13%. Das Portfolio B besitzt ein Beta von 0.4 und eine erwartete Rendite von 15%. Der risikofreie Zinssatz ist 10%.
    Um eine allfällige Arbitragemöglichkeit auszunützen, kann ein Investor eine Short-Position im Portfolio ___ und eine Long-Position im Portfolio ___ einnehmen.`,
    type: QuestionType.SC,
    choices: [
      {
        feedback: 'Falsch!',
        value:
        'A, A',
      },
      {
        feedback:
          'Falsch!',
        value: 'A, B',
      },
      {
        feedback: `Korrekt!
Portfolio A: 13%=10%+0.2*F <--> F=15%; 
Portfolio B: 15%=10%+0.4*F <--> F=12.5%. 
=> Daraus folgt: Short-Position in B und Long-Position in A.`,
        correct: true,
        value: 'B, A',
      },
      {
        feedback: 'Falsch!',
        value:
          'B, B',
      },
      {
        feedback: 'Falsch!',
        value: 'Keine der genannten Aussagen ist richtig.',
      },
    ],
  },
  {
    id: 68,
    name: 'Modul 2 Arbitrage II',
    content: `Um eine allfällige Arbitragemöglichkeit auszunützen, sollte ein Investor allgemein...
    ...ein im ersten Markt unterbewertetes Asset leerverkaufen und dasselbe im zweiten Markt überbewertete Asset kaufen.
    ...ein kostenneutrales Portfolio konstruieren, das einen sicheren Gewinn erzielen wird.
    ...zeitgleiche, kostenneutrale Trades in zwei Märkten durchführen.
    ...ein Null-Beta Portfolio konstruieren, das einen sicheren Gewinn erzielen wird.`,
    contentPlain:
    `Um eine allfällige Arbitragemöglichkeit auszunützen, sollte ein Investor allgemein...
    ...ein im ersten Markt unterbewertetes Asset leerverkaufen und dasselbe im zweiten Markt überbewertete Asset kaufen.
    ...ein kostenneutrales Portfolio konstruieren, das einen sicheren Gewinn erzielen wird.
    ...zeitgleiche, kostenneutrale Trades in zwei Märkten durchführen.
    ...ein Null-Beta Portfolio konstruieren, das einen sicheren Gewinn erzielen wird.`,
    type: QuestionType.SC,
    choices: [
      {
        feedback: 'Falsch!',
        value:
        '1. und 4.',
      },
      {
        feedback:
          'Falsch!',
        value: '1. und 3.',
      },
      {
        feedback: 'Korrekt! Um eine allfällige Arbitragemöglichkeit auszunutzen, sollte ein Investor allgemein ein kostenneutrales Portfolio konstruieren, das einen sicheren Gewinn erzielen wird oder zeitgleiche, kostenneutrale Trades in zwei Märkten durchführen. (Zusatz: Die 4. Aussage ist nicht korrekt, denn gemäss Definition erfordert Arbitrage das Erzielen eines sicheren Gewinns ohne den Einsatz von Kapital. Bei der Konstruktion eines Null-Beta-Portfolios ist diese Voraussetzung aber nicht zwingend erfüllt (Kapitaleinsatz beim Erstellen eines Portfolios).)',
        correct: true,
        value: '2. und 3.',
      },
      {
        feedback: 'Falsch!',
        value:
          '1. sowie 3. und 4.',
      },
      {
        feedback: 'Falsch!',
        value: '2. sowie 3. und 4.',
      },
    ],
  },
  {
    id: 69,
    name: 'Modul 2 Anwendung',
    content: `Gegeben sei ein diversifiziertes Portfolio A in einer Zwei-Faktoren-Ökonomie. Der risikolose Zinssatz beträgt 6%. Die Risikoprämie des ersten Faktor-Portfolios ist 4% und die Risikoprämie des zweiten Faktor-Portfolios liegt bei 3%. Das Beta des Portfolios A bezüglich des ersten Faktors sei 1.2 und das Beta bezüglich des zweiten Faktors 0.8.
    Wie hoch ist die erwartete Rendite des Portfolios A?`,
    contentPlain:
    `Gegeben sei ein diversifiziertes Portfolio A in einer Zwei-Faktoren-Ökonomie. Der risikolose Zinssatz beträgt 6%. Die Risikoprämie des ersten Faktor-Portfolios ist 4% und die Risikoprämie des zweiten Faktor-Portfolios liegt bei 3%. Das Beta des Portfolios A bezüglich des ersten Faktors sei 1.2 und das Beta bezüglich des zweiten Faktors 0.8.
    Wie hoch ist die erwartete Rendite des Portfolios A?`,
    type: QuestionType.SC,
    choices: [
      {
        feedback: 'Falsch!',
        value:
        '7.0%',
      },
      {
        feedback:
          'Falsch!',
        value: '8.0%',
      },
      {
        feedback: 'Korrekt! Um eine allfällige Arbitragemöglichkeit auszunutzen, sollte ein Investor allgemein ein kostenneutrales Portfolio konstruieren, das einen sicheren Gewinn erzielen wird oder zeitgleiche, kostenneutrale Trades in zwei Märkten durchführen. (Zusatz: Die 4. Aussage ist nicht korrekt, denn gemäss Definition erfordert Arbitrage das Erzielen eines sicheren Gewinns ohne den Einsatz von Kapital. Bei der Konstruktion eines Null-Beta-Portfolios ist diese Voraussetzung aber nicht zwingend erfüllt (Kapitaleinsatz beim Erstellen eines Portfolios).)',
        value: '9.2%',
      },
      {
        feedback: 'Falsch!',
        value:
          '13.0%',
      },
      {
        feedback: 'Korrekt! Die erwartete Rendite beträgt: 6%+1.2*4%+0.8*3%=13.2%.',
        correct: true,
        value: '13.2%',
      },
    ],
  },
  {
    id: 70,
    name: 'Modul 2 Fama-French-Modell',
    content: 'Welche der folgenden Aussagen ist **falsch**?',
    contentPlain: 'Welche der folgenden Aussagen ist falsch?',
    type: QuestionType.SC,
    choices: [
      {
        feedback: 'Falsch! Diese Aussage ist korrekt. Denn die Aussage lautet nicht, dass alle drei Faktoren firmenspezifische Risikofaktoren darstellen, sondern dass das Fama-French-Modell auf firmenspezifischen Risikofaktoren basiert. “Small-Minus-Big“ und “High-Minus-Low“ sind firmenspezifische Risikofaktoren. Folglich basiert das Fama-French-Modell auf firmenspezifischen Risikofaktoren (und zusätzlich auf dem “CAPM-Beta“, welches das systematische Risiko bzw. das Marktrisiko abbildet).',
        value:
        'Das Fama-French-Modell ist ein Beispiel eines Drei-Faktoren-Modells auf Basis firmenspezifischer Risikofaktoren.',
      },
      {
        feedback: 'Falsch! Diese Aussage ist korrekt.',
        value: 'Die Auswahl der Risikofaktoren im Fama-French-Modell beruht unter anderem auf der empirisch signifikanten Korrelation der Faktoren mit Aktienrenditen.',
      },
      {
        feedback:
          'Richtig, diese Aussage ist nicht korrekt! Das Fama-French-Modell ist nicht nur in der empirischen Forschung weit verbreitet, es spielt auch eine dominante Rolle in der Finanzindustrie.',
        correct:true,
        value: 'Trotz der grossen Beachtung in der akademischen Welt fand das Fama-French-Modell nie Eingang in die Praxis.',
      },
      {
        feedback: 'Falsch! Diese Aussage ist korrekt.',
        value:
          'Der erste firmenspezifische Risikofaktor im Fama-French-Modell berücksichtigt die unterschiedlichen Renditen in Abhängigkeit der Grösse eines Unternehmens.',
      },
      {
        feedback: 'Falsch! Diese Aussage ist korrekt.',
        value: 'Der zweite firmenspezifische Risikofaktor im Fama-French-Modell misst die Differenz der Renditen zwischen Unternehmen mit hohem und solchen mit tiefem Book-to-Market Ratio.',
      },
    ],
  },
  {
    id: 70,
    name: 'Modul 3 zeitgewichteter vs. kapitalgewichteter Mittelwert',
    content: `Gegeben ist folgende Ausgangslage:
Ein Anlagefonds, der ein Anfangsvermögen von $500'000 hat, erzielt im ersten Jahr 15% und im zweiten Jahr 10% Rendite. Zu Beginn des zweiten Jahres zahlt ein Sponsor weitere $300'000 ein.
Berechne den kapitalgewichteten und den zeitgewichteten Mittelwert, wenn keine Reinvestition möglich ist und Ende des zweiten Jahres alles ausbezahlt wird.`,
    contentPlain: `Gegeben ist folgende Ausgangslage:
Ein Anlagefonds, der ein Anfangsvermögen von $500'000 hat, erzielt im ersten Jahr 15% und im zweiten Jahr 10% Rendite. Zu Beginn des zweiten Jahres zahlt ein Sponsor weitere $300'000 ein.
Berechne den kapitalgewichteten und den zeitgewichteten Mittelwert, wenn keine Reinvestition möglich ist und Ende des zweiten Jahres alles ausbezahlt wird.`,
    type: QuestionType.SC,
    choices: [
      {
        feedback: 'Falsch!',
        value:
        '11.7% und 12.5%',
      },
      {
        feedback: `Korrekt!
$$ Kapitalgewichteter Mittelwert: PV (Einzahlungen) = PV (Auszahlungen) --> \$500'000 + \frac{\$300'000}{(1+r)} = \frac{\$75'000}{(1+r)} + \frac{\$880'000}{(1+r)}^2 --> r = 12.06\%
Zeitgewichteter Mittelwert (geometrischer Durchschnitt der Renditen): ((1+0.15)*(1+0.10))^{1/2} - 1 = 12.47\% $$`,
        correct:true,     
        value: '12.1% und 12.5%',
      },
      {
        feedback:
          'Falsch!',
        value: '12.5% und 11.7%',
      },
      {
        feedback: 'Falsch!',
        value:
          '12.5% und 12.1%',
      },
      {
        feedback: 'Falsch!',
        value: 'Keine der genannten Aussagen ist richtig.',
      },
    ],
  },
  {
    id: 71,
    name: 'Modul 3 Sharpe und Treynor Ratio',
    content: `Gegeben ist folgende Ausgangslage zur Performance des Sooner Stock Fonds und des Marktportfolios:
(Bild_modul3_sharpe_und_treynorratio)
Der risikolose Zinssatz für diese Zeitperiode liegt bei 3%.
Berechne das Sharpe und Treynor Ratio des Sooner Stock Fonds.`,
    contentPlain: `Gegeben ist folgende Ausgangslage zur Performance des Sooner Stock Fonds und des Marktportfolios:
(Bild_modul3_sharpe_und_treynorratio)
Der risikolose Zinssatz für diese Zeitperiode liegt bei 3%.
Berechne das Sharpe und Treynor Ratio des Sooner Stock Fonds.`,
    type: QuestionType.SC,
    choices: [
      {
        feedback: 'Falsch!',
        value:
        '0.013 / 0.087',
      },
      {
        feedback: 'Falsch!',      
        value: '0.371 / 0.087',
      },
      {
        feedback:
          'Falsch!',
        value: '0.371 / 0.094',
      },
      {
        feedback: 'Korrekt! $$ Die Sharpe Ratio beträgt: \frac{(r_P-r_f)}{SD_P}= {(0.2-0.03)}{0.44} = 0.386 und das Treynor Ratio: \frac{(r_P-r_f)}{β_P}= \frac{(0.2-0.03)}{1.8} = 0.094 $$',
        correct: true,
        value:
          '0.386 / 0.094',
      },
      {
        feedback: 'Falsch!',
        value: '0.386 / 0.371',
      },
    ],
  },
  {
    id: 72,
    name: `Modul 3 Jensen's Alpha`,
    content: `Gegeben ist (wie im Beispiel zuvor) folgende Ausgangslage zur Performance des Sooner Stock Fonds und des Marktportfolios:
(Bild_modul3_sharpe_und_treynorratio)
Der risikofreie Zinssatz für diese Zeitperiode liegt bei 2%.
Wie hoch ist das Jensen's Alpha des Sooner Stock Funds?`,
    contentPlain: `Gegeben ist (wie im Beispiel zuvor) folgende Ausgangslage zur Performance des Sooner Stock Fonds und des Marktportfolios:
(Bild_modul3_sharpe_und_treynorratio)
Der risikofreie Zinssatz für diese Zeitperiode liegt bei 2%.
Wie hoch ist das Jensen's Alpha des Sooner Stock Funds?`,
    type: QuestionType.SC,
    choices: [
      {
        feedback: 'Falsch!',
        value:
        '-0.234',
      },
      {
        feedback: 'Korrekt! $$ \alpha_P=r_P-(r_f+\beta_P*(r_m-r_f)) = 0.2 - (0.02+1.8*(0.11-0.02)) $$',      
        correct: true,
        value: '0.018',
      },
      {
        feedback:
          'Falsch!',
        value: '0.038',
      },
      {
        feedback: 'Falsch!',
        value:
          '0.09',
      },
      {
        feedback: 'Falsch!',
        value: 'Keine der genannten Antworten ist korrekt.',
      },
    ],
  }
  {
    id: 73,
    name: `Modul 3 Information Ratio`,
    content: `Gegeben ist (wie im Beispiel zuvor) folgende Ausgangslage zur Performance des Sooner Stock Fonds und des Marktportfolios:
(Bild_modul3_sharpe_und_treynorratio)
Der risikolose Zinssatz für diese Zeitperiode liegt bei 3%.
Wie gross ist das Information Ratio des Sooner Stock Fonds?`,
    contentPlain: `Gegeben ist (wie im Beispiel zuvor) folgende Ausgangslage zur Performance des Sooner Stock Fonds und des Marktportfolios:
(Bild_modul3_sharpe_und_treynorratio)
Der risikolose Zinssatz für diese Zeitperiode liegt bei 3%.
Wie gross ist das Information Ratio des Sooner Stock Fonds?`,
    type: QuestionType.SC,
    choices: [
      {
        feedback: 'Falsch!',
        value:
        '1.22',
      },
      {
        feedback: 'Korrekt! $$ Das Jensen Ratio beträgt: α_P = r_P- (r_f + β_P*(r_m-r_f) = 0.2 - [0.03 + 1.8*(0.11-0.03)] = 0.026 und das Information Ratio ist demnach: α_P/SD(e_P) = \frac{0.026}{0.02} = 1.30. $$',      
        correct: true,
        value: '1.30',
      },
      {
        feedback:
          'Falsch!',
        value: '1.53',
      },
      {
        feedback: 'Falsch!',
        value:
          '10.30',
      },
      {
        feedback: 'Falsch!',
        value: '31.43',
      },
    ],
  },
  {
    id: 74,
    name: `Modul 3 M2 Measure`,
    content: `Gegeben ist folgende Ausgangslage zur Performance des Seminole Fonds und des Marktportfolios:
(Bild_modul3_M2_measure)
Der risikolose Zinssatz für diese Zeitperiode liegt bei 6%.
Berechne die M2 Measure für den Seminole Fonds.`,
    contentPlain: `Gegeben ist folgende Ausgangslage zur Performance des Seminole Fonds und des Marktportfolios:
(Bild_modul3_M2_measure)
Der risikolose Zinssatz für diese Zeitperiode liegt bei 6%.
Berechne die M2 Measure für den Seminole Fonds.`,
    type: QuestionType.SC,
    choices: [
      {
        feedback: 'Korrekt! $$ w_P= \frac{0.22}{0.30} = 0.73; w_{rf}= 1-0.73 = 0.27 --> M^2 = [0.73*(0.18)+0.27*(0.06)] - 0.14 = 0.8%.',
        correct: true,
        value:
        '0.8%',
      },
      {
        feedback: 'Falsch!',
        value: '2.9%',
      },
      {
        feedback:
          'Falsch!',
        value: '4.0%',
      },
      {
        feedback: 'Falsch!',
        value:
          '20.0%',
      },
      {
        feedback: 'Falsch!',
        value: '40.1%',
      },
    ],
  },
  {
    id: 75,
    name: `Modul 3 Performance-Messung`,
    content: 'Welche der folgenden Aussagen ist **richtig**?',
    contentPlain: 'Welche der folgenden Aussagen ist richtig?',
    type: QuestionType.SC,
    choices: [
      {
        feedback: 'Korrekt!',
        correct: true,
        value:
        'Falls das gesamte Investionsvolumen in das Portfolio investiert ist, ist das M2-Measure ein sinnvolles Portfolio-Mass.',
      },
      {
        feedback: 'Falsch! Die Sharpe-Ratio ist bei einer Gesamtinvestition des Anlageuniversum ein sinnvolles Mass.',
        value: 'Falls nur ein Teil des Investitionsvolumen in das Portfolio investiert ist, ist die Sharpe-Ratio ein sinnvolles Performance-Mass.',
      },
      {
        feedback:
          'Falsch! Um zwei Portfolios adäquat zu vergleichen muss sowohl die Rendite als auch das eingegangene Risiko verglichen werden.',
        value: 'Um die Performance zweier Portfolios adäquat zu messen, reicht es, die historischen Renditen zu vergleichen.',
      },
      {
        feedback: 'Falsch! Sowohl die Sharpe-Ratio als auch die Treynor-Ratio sind bei negativen Renditen nicht brauchbar.',
        value:
          'Bei negativen Portfolio-Renditen ist die Sharpe-Ratio nicht brauchbar zur Performance-Messung, die Treynor-Ratio dagegen schon.',
      },
      {
        feedback: 'Falsch!',
        value: 'Keine der genannten Aussagen ist korrekt.',
      },
    ],
  },
  {
    id: 76,
    name: `Modul 3 Probleme der Performance-Messung`,
    content: 'Welche der folgenden Aussagen ist **richtig**?',
    contentPlain: 'Welche der folgenden Aussagen ist richtig?',
    type: QuestionType.SC,
    choices: [
      {
        feedback: 'Korrekt!',
        correct: true,
        value:
        'Viele Beobachtungen sind notwendig für eine signifikante Performance Evaluation, selbst wenn der Erwartungswert und die Varianz des Portfolios konstant sind.',
      },
      {
        feedback: 'Falsch! Eine Veränderung der Portfolioparameter in aktiv gemanagten Portfolios verkompliziert die Performance Evaluation zusätzlich.',
        value: 'Eine Veränderung der Portfolioparameter in aktiv gemanagten Portfolios stellt keine Herausforderung dar für die Performance Evaluation.',
      },
      {
        feedback:
          'Falsch! Unter Window Dressing versteht man, dass der Portfoliomanager vor dem vierteljährlichen Reportdatum das Portfolio umschichtet, um am Reportdatum möglichst viele erfolgreiche Aktien im Portfolio zu halten. Dabei berücksichtigt er die zukünftige Performance dieser Aktien nicht.',
        value: 'Unter Window Dressing versteht man, dass der Portfoliomanager nach dem vierteljährlichen Reportdatum das Portfolio umschichtet, um für die nächste Periode eine maximale Rendite zu erreichen.',
      },
      {
        feedback: 'Falsch! Der Survivorship Bias verkompliziert die Performance Evaluation zusätzlich. Denn der Datensatz enthält nur jene Fonds, welche überlebt haben. Die Marktindexrendite ist somit "künstlich" erhöht und schwerer zu schlagen.',
        value:
          'Der Survivorship Bias vereinfacht generell die Performancemessung.',
      },
      {
        feedback: 'Falsch!',
        value: 'Keine der genannten Aussagen ist korrekt.',
      },
    ],
  },
  {
    id: 77,
    name: 'Modul 3 Performance Attribution',
    content: "",
    contentPlain: 'Beurteile folgende Aussagen auf ihre Richtigkeit.',
    type: QuestionType.KPRIM,
    choices: [
      {
        feedback:
          'Diese Aussage ist nicht korrekt!',
        value:
          'Die Performance Attribution verliert aufgrund sinkender Ansprüche der Pensionskassen an Wichtigkeit.',
      },
      {
        feedback: 'Diese Aussage ist korrekt!',
        correct: true,
        value:
          'Bei der Performance Attribution wird die Portfolio Performance in ihre einzelnen Komponenten zerlegt.',
      },
      {
        feedback: 'Diese Aussage ist korrekt!',
        correct: true,
        value:
          'Die Performance wird in die Komponenten strategische Asset Allocation, taktische Asset Allocation, Industrieselektion und Titelselektion unterteilt.',
      },
      {
        feedback:
          'Diese Aussage ist korrekt!',
        correct: true,
        value:
          'Mithilfe der Performance Attribution kann erklärt werden, weshalb die Portfolio Performance von der Performance des Benchmarks abweicht.',
      },
    ],
  },
  {
    id: 78,
    name: 'Modul 4 Grundlagen der Behavioral Finance',
    content: 'Welche der folgenden Aussagen ist **richtig**?',
    contentPlain: 'Welche der folgenden Aussagen ist richtig?',
    type: QuestionType.SC,
    choices: [
      {
        feedback: 'Korrekt!',
        correct: true,
        value:
        'Während konventionelle Theorien annehmen, dass Investoren rational sind, impliziert die Behavioral Finance, dass sie es nicht sein müssen.',
      },
      {
        feedback: 'Falsch! Falls die irrationalen Entscheidungen der Investoren die Preise beeinflussen, werden rationale Investoren diese Arbitragemöglichkeiten ausnutzen und sie somit wieder auf das rationale Niveau bringen.',
        value: 'Die Existenz von irrationalen Investoren impliziert, dass Kapitalmärkte ineffizient sind.',
      },
      {
        feedback:
          'Falsch! Irrationales Verhalten entsteht aufgrund von Verzerrungen in der Informationsverarbeitung sowie inkonsistenten oder systematisch suboptimalen Entscheidungen.',
        value: 'Die Behavioral Finance nimmt an, dass irrationales Verhalten nur aufgrund von Verzerrungen in der Informationsaufbereitung entsteht.',
      },
      {
        feedback: 'Falsch! Börsenblasen - wie beispielsweise die Dotcom Blase - werden von irrationalem Investorenverhalten verursacht.',
        value:
          'Börsenblasen lassen sich auch rational erklären.',
      },
      {
        feedback: 'Falsch!',
        value: 'Keine der genannten Aussagen ist richtig.',
      },
    ],
  },
  {
    id: 79,
    name: 'Modul 4 Information Processing und Behavioral Biases',
    content: 'Welche der folgenden Aussagen ist **richtig**?',
    contentPlain: 'Welche der folgenden Aussagen ist richtig?',
    type: QuestionType.SC,
    choices: [
      {
        feedback: 'Falsch! Wenn ein Investor neue Informationen im Verhältnis zu älteren Einschätzungen übergewichtet, dann ist dies auf den Forecasting Error zurückzuführen.',
        value:
        'Wenn ein Investor Informationen, die er gestern in der Zeitung gelesen hat gegenüber früheren Einschätzungen übergewichtet, so ist dies auf den Anchoring Bias zurückzuführen.',
      },
      {
        feedback: 'Korrekt!',
        correct: true,
        value: 'Der Overconfidence Bias entsteht, da Investoren ihre eigenen Einschätzungen und Fähigkeiten überschätzen.',
      },
      {
        feedback:
          'Falsch! Wenn ein Investor aufgrund einer zu kleinen Stichprobe auf einen Trend schliesst, dann ist dies auf den Representativeness Effekt zurückzuführen.',
        value: 'Wenn ein Investor aufgrund zweier guter Quartalsabschlüsse auf eine gute zukünftige Performance schliesst, dann ist dies auf Mental Accounting zurückzuführen.',
      },
      {
        feedback: 'Falsch! Framing Biases resultieren, wenn Investoren risikoavers in Bezug auf Gewinne, aber risikosuchend bezüglich Verlusten sind. Als Beispiel sei hier auf die Barings Bank verwiesen, bei welcher Nick Leeson zwischen 1993 und 1995 rund 827 Millionen Pfund durch Optionsspekulationen verloren hatte. Dies, bei dem Versuch Verluste mittels noch riskanteren Spekulationen wieder gut zu machen.',
        value:
          'Framing Biases resultieren, wenn Investoren risikosuchend in Bezug auf Gewinne, aber risikoavers bezüglich Verlusten sind.',
      },
      {
        feedback: 'Falsch! Ein Beispiel der Regret Avoidance ist, das es einen Investor mehr schmerzt, wenn eine Aktie einer unbekannten Start-up Firma an Wert verliert, als wenn ein ETF auf den SMI denselben Wert einbüsst.',
        value: 'Ein Beispiel der Regret Avoidance ist, dass es einen Investor weniger schmerzt, wenn eine Aktie einer unbekannten Start-up Firma an Wert verliert, als wenn ein ETF auf den SMI denselben Wert einbüsst.',
      },
    ],
  },
  {
    id: 80,
    name: 'Modul 4 Information Processing und Behavioral Biases',
    content: 'Welche der folgenden Aussagen ist **richtig**?',
    contentPlain: 'Welche der folgenden Aussagen ist richtig?',
    type: QuestionType.SC,
    choices: [
      {
        feedback: 'Falsch! Falls Investoren inkonsistente Entscheidungen treffen, handelt es sich um den Decision Bias.',
        value:
        'Wenn Investoren inkonsistente Entscheidungen treffen, ist dies auf den Information Selection Bias zurückzuführen.',
      },
      {
        feedback: 'Falsch! Selektive Wahrnehmung von Informationen sind auf den Information Selection Bias zurückzuführen.',
        value: 'Wenn Investoren Informationen selektiv wahrnehmen, ist dies auf den Information Processing Bias zurückzuführen.',
      },
      {
        feedback:
          'Korrekt!',
        correct: true,
        value: 'Der Book-to-market Effekt kann durch den Information Selection Bias erklärt werden.',
      },
      {
        feedback: 'Falsch! Dieser Effekt kann durch den Information Selection Bias erklärt werden.',
        value:
          'Eine mögliche Erklärung dafür, dass Anleger Aktien mit hoher Aufmerksamkeit bevorzugen, ist der Information Processing Bias.',
      },
      {
        feedback: 'Falsch!',
        value: 'Keine der genannten Aussagen ist korrekt.',
      },
    ],
  },
  {
    id: 81,
    name: 'Modul 4 Prospect Theory',
    content: 'Welche der folgenden Aussagen ist **falsch**?',
    contentPlain: 'Welche der folgenden Aussagen ist falsch?',
    type: QuestionType.SC,
    choices: [
      {
        feedback: 'Falsch! Diese Aussage ist korrekt.',
        value:
        'Durch die Konkavität der Nutzenfunktion im Gewinnbereich wird in der Prospect Theory Risikoaversion ausgedrückt.',
      },
      {
        feedback: 'Falsch! Diese Aussage ist korrekt.',
        value: 'Gemäss der Prospect Theory sind Anleger im Verlustbereich risikosuchend. Dies wird mit einer konvexen Nutzenfunktion im Verlustbereich modelliert.',
      },
      {
        feedback:
          'Falsch! Diese Aussage ist korrekt.',
        value: 'Die steilere Nutzenfunktion im Verlustbereich drückt die höhere Gewichtung der Verluste gegenüber den Gewinnen aus.',
      },
      {
        feedback: 'Richtig! Diese Aussage ist nicht korrekt. Als Refernzpunkt dient die Veränderung im Vergleich zum aktuellen Vermögen und nicht das gesamte Vermögen.',
        correct: true,
        value:
          'Das gesamte Vermögen dient als Referenzpunkt für die Nutzenfunktion in der Prospect Theory.',
      },
      {
        feedback: 'Falsch! Diese Aussage ist korrekt.',
        value: 'Die Cumulative Prospect Theory besagt, dass Individuen die Eintrittswahrscheinlichkeit von wenig wahrscheinlichen Ereignissen überschätzen und von sehr wahrscheinlichen Ereignissen unterschätzen.',
      },
    ],
  },
  {
    id: 82,
    name: 'Modul 4 Verzerrungen',
    content: "",
    contentPlain: 'Beurteile folgende Aussagen auf ihre Richtigkeit.',
    type: QuestionType.KPRIM,
    choices: [
      {
        feedback:
          'Diese Aussage ist korrekt!',
        correct: true,
        value:
          'Anchoring beschreibt die Tatsache, dass Individuen dazu tendieren, sich von nicht relevanten Ankerwerten beeinflussen zu lassen.',
      },
      {
        feedback: 'Diese Aussage ist korrekt!',
        correct: true,
        value:
          'Overconfidence beschreibt den Effekt, dass Investoren dazu tendieren, ihre Fähigkeiten zu überschätzen.',
      },
      {
        feedback: 'Diese Aussage ist nicht korrekt! Der Framing-Effekt beschreibt, dass Investoren bei den gleichen Entscheidungsproblemen, welche unterschiedlich formuliert wurden, anders handeln.',
        value:
          'Framing beschreibt den Effekt, dass Investoren diejenige Investitionsmöglichkeit wählen, welche ihnen bekannter ist oder welche sie sich besser vorstellen können.',
      },
      {
        feedback:
          'Diese Aussage ist nicht korrekt! Mental Accounting beschreibt den Effekt, dass Individuen psychologisch dazu tendieren ihr Vermögen in Teilvermögen zu unterteilen und dieses Teilvermögen behandeln sie schlussendlich unterschiedlich.',
       value:
          'Mental Accounting beschreibt den Effekt, dass Investoren dazu tendieren, Wahrscheinlichkeiten verzerrt einzuschätzen, da sie von einer kurzen Reihe auf die gesamte Verteilung schliessen.',
      },
    ],
  },
  {
    id: 83,
    name: 'Modul 4 Efficient Market Hypothesis I',
    content: 'Welche der folgenden Aussagen zur **Efficient Market Hypothesis (EMH)** ist **falsch**?',
    contentPlain: 'Welche der folgenden Aussagen zur Efficient Market Hypothesis (EMH) ist falsch?',
    type: QuestionType.SC,
    choices: [
      {
        feedback: 'Falsch! Diese Aussage ist korrekt.',
        value:
        'Unter dem Begriff Random Walk versteht man, dass künftige Aktienkursveränderungen zufällig und somit nicht vorhersagbar sind.',
      },
      {
        feedback: 'Richtig! Diese Aussage ist nicht korrekt. Ursache des Random Walks ist die Tatsache, dass Aktienpreise jederzeit alle verfügbaren Informationen vollständig reflektieren. Dies ist der Fall, wenn sich die Marktteilnehmer rational verhalten.',
        correct: true,
        value: 'Der Random Walk ist nur durch Irrationalität in der Preisfindung zu erklären.',
      },
      {
        feedback:
          'Falsch! Diese Aussage ist korrekt.',
        value: 'Reflektieren Aktienpreise jederzeit alle verfügbaren Informationen, können sie gemäss der EMH als effizient bezeichnet werden.',
      },
      {
        feedback: 'Falsch! Diese Aussage ist korrekt.',
        value:
          'Ist der Preis einer Aktie gemäss der schwachen Form der Markteffizienz informationseffizient, ist es mittels Analyse vergangener Kurse nicht möglich, Aussagen über zukünftige Aktienpreisentwicklungen zu treffen.',
      },
      {
        feedback: 'Falsch! Diese Aussage ist korrekt. Die starke Form der Markteffizienz umfasst sowohl die schwache als auch die semi-starke Form.',
        value: 'Die starke Form der Markteffizienz bedeutet implizit, dass der Markt auch gemäss der schwachen Form informationseffizient ist.',
      },
    ],
  },
  {
    id: 84,
    name: 'Modul 4 Efficient Market Hypothesis II',
    content: 'Personen, welche davon ausgehen, dass die EMH zumindest semi-strong effizient ist, empfehlen Anlegern typischerweise ...',
    contentPlain: 'Personen, welche davon ausgehen, dass die EMH zumindest semi-strong effizient ist, empfehlen Anlegern typischerweise ...',
    type: QuestionType.SC,
    choices: [
      {
        feedback: 'Falsch! Aktive Anlagestrategien mit Stock Picking lohnen sich nur in nicht effizienten Märkten.',
        value:
        'eine aktive Handelsstrategie, um ständig die profitabelsten Aktientitel kaufen zu können.',
      },
      {
        feedback: 'Richtig!',
        correct: true,
        value: `den Kauf von Index-Fonds oder Exchange-Traded Funds (ETF's).`,
      },
      {
        feedback:
          'Falsch! Fondsmanager verursachen höhere Kosten als bei passiven Anlagen und da es nicht möglich ist, Überrenditen zu generieren, schneiden aktiv verwaltete Fonds schlechter als passive Instrumente ab.',
        value: 'über Fondsmanager zu investieren, um von deren Erfahrung im Bereich der Aktienanalyse und Titelauswahl zu profitieren.',
      },
      {
        feedback: 'Falsch! Auch effiziente Märkte versprechen Renditen.',
        value:
          'Investitionen in Rohstoffe oder Immobilien, da effiziente Aktienmärkte ausgereizt sind und keine Renditen mehr versprechen.',
      },
      {
        feedback: 'Falsch! Hedge Funds versuchen durch aktives Management eine Überrendite zu generieren.',
        value: 'Anlagen in Hedge Funds.',
      },
    ],
  },
  {
    id: 85,
    name: 'Modul 4 Efficient Market Hypothesis III',
    content: 'Angenommen das Pharmaunternehmen Roche bringt überraschend ein neues Medikament gegen Schweinegrippe auf den Markt. Auf welche Weise wird der Aktienkurs von Roche auf dieses Ereignis reagieren, wenn man von einem mittelstark effizienten Markt ausgeht?',
    contentPlain: 'Angenommen das Pharmaunternehmen Roche bringt überraschend ein neues Medikament gegen Schweinegrippe auf den Markt. Auf welche Weise wird der Aktienkurs von Roche auf dieses Ereignis reagieren, wenn man von einem mittelstark effizienten Markt ausgeht?',
    type: QuestionType.SC,
    choices: [
      {
        feedback: 'Falsch! In einem effizienten Markt reagiert der Aktienkurs sofort und korrekt auf neue Informationen.',
        value:
        'Der Aktienkurs wird allmählich auf einen neuen, höheren Gleichgewichtspreis steigen.',
      },
      {
        feedback: 'Falsch! In einem effizienten Markt reagiert der Aktienkurs sofort und korrekt auf neue Informationen und da durch das neue Medikament der Gewinn oder Cash-flow vermutlich steigen wird, muss der Aktienkurs ansteigen.',
        value: 'Der Aktienkurs wird in die Höhe schiessen und sich anschliessend langsam wieder auf einen tieferen Gleichgewichtspreis zu bewegen.',
      },
      {
        feedback:
          'Falsch! Da das Schweinegrippe Medikament überraschend auf den Markt kommt, steigt auch der Aktienkurs sofort auf einen höheren Gleichgewichtspreis.',
        value: 'Der Aktienkurs wird sich nicht verändern, da in effizienten Märkten bereits sämtliche Informationen im Preis einbezogen sind.',
      },
      {
        feedback: 'Korrekt!',
        correct: true,
        value:
          'Der Aktienkurs wird sofort auf einen neuen, höheren Gleichgewichtspreis steigen.',
      },
      {
        feedback: 'Falsch! In einem effizienten Markt reagiert der Aktienkurs sofort und korrekt auf neue Informationen.',
        value: 'Der Aktienkurs wird fallen und sich anschliessend langsam wieder auf einen höheren Gleichgewichtspreis zu bewegen.',
      },
    ],
  },
  {
    id: 86,
    name: 'Modul 4 Momentum-Strategien',
    content: "",
    contentPlain: 'Beurteile folgende Aussagen auf ihre Richtigkeit.',
    type: QuestionType.KPRIM,
    choices: [
      {
        feedback:
          'Diese Aussage ist korrekt!',
        correct: true,
        value:
          'Es exististieren zwei Hauptstrategien: Das Kurs- sowie das Gewinn-Momentum.',
      },
      {
        feedback: 'Diese Aussage ist nicht korrekt! Erfolgreiche Momentum-Strategien widersprechen der Annahme, dass der Markt (zumindest in schwacher Form) effizient ist.',
        value:
          'Viele empirische Studien können nachweisen, dass mit einer Momentum-Strategie Überrenditen erzielt werden können. Solch erfolgreiche Momentum-Strategien unterstützen die Annahme, dass der Markt (zumindest in schwacher Form) effizient ist.',
      },
      {
        feedback: 'Diese Aussage ist nicht korrekt! Gemäss dem Kurs-Momentum werden die Renditen von Aktien, die bereits in der Vergangenheit gut performt haben, auch in der Zukunft besser abschneiden.',
        value:
          'Gemäss dem Kurs-Momentum werden die Renditen von Aktien, welche in der Vergangenheit unterdurchschnittlich performt haben, in der Zukunft überdurchschnittliche Renditen erzielen.',
      },
      {
        feedback:
          'Diese Aussage ist korrekt!',
        correct: true,
        value:
          'Das Gewinn-Momentum besagt, dass Aktienkurse den Veränderungen der Gewinnschätzungen der Analysten folgen.',
      },
    ],
  },
  {
    id: 87,
    name: 'Modul 4 Gründe gegen Markteffizienz',
    content: "",
    contentPlain: 'Beurteile folgende Aussagen auf ihre Richtigkeit.',
    type: QuestionType.KPRIM,
    choices: [
      {
        feedback:
          'Diese Aussage ist nicht korrekt! Ein Finanzmarkt ist effizient, wenn die Marktpreise der Wertpapiere alle verfügbaren preisrelevanten Informationen reflektieren.',
        value:
          'Alle verfügbaren preisrelevanten Informationen widerspiegeln sich im Marktpreis und eine Erzielung von Überrenditen ist nicht möglich.',
      },
      {
        feedback: 'Diese Aussage ist korrekt!',
        correct: true,
        value:
          'Aufgrund hoher Transaktionskosten erfolgt die Reaktion von Investoren auf Informationen oft verzögert. Neue Informationen werden nur langsam verarbeitet.',
      },
      {
        feedback: 'Diese Aussage ist korrekt!',
        correct: true,
        value:
          'Auftretende Phänomene wie Verlustaversion, Overconfidence oder Framing deuten auf verzerrte Wahrnehmungen von Anlegern hin.',
      },
      {
        feedback:
          'Diese Aussage ist korrekt!',
        correct: true,
        value:
          'Wahrscheinlichkeitsverteilungen der Aktienrenditen bleiben über die Zeit nicht konstant. Als möglicher Grund seien die Konjunkturzyklen genannt.',
      },
    ],
  },
  {
    id: 88,
    name: 'Modul 4 Anlagestrategien',
    content: "",
    contentPlain: 'Beurteile folgende Aussagen auf ihre Richtigkeit.',
    type: QuestionType.KPRIM,
    choices: [
      {
        feedback:
          'Diese Aussage ist nicht korrekt!',
        value:
          'Ist der Markt in der mittelstarken Form effizient, so wird bevorzugterweise aktiv investiert.',
      },
      {
        feedback: 'Diese Aussage ist korrekt!',
        correct: true,
        value:
          'Exchange Traded Funds (ETF) werden bevorzugt, wenn die mittelstarke Markteffizienz gegeben ist.',
      },
      {
        feedback: 'Diese Aussage ist korrekt!',
        correct: true,
        value:
          'Wenn die mittelstarke Markteffizienz als gegeben erachtet wird, so ist es langfristig nicht möglich ein Alpha zu generieren.',
      },
      {
        feedback:
          'Diese Aussage ist korrekt!',
        correct: true,
        value:
          'Beim aktiven Management spielt die Performance Attribution eine entscheidende Rolle.',
      },
    ],
  },
  {
    id: 89,
    name: 'Modul 4 Aktives und passives Portfoliomanagement',
    content: 'Nach eingehender Analyse der Marktsituation stufen die Analysten der Copenhagen Fish Invest AG den **Aktienmarkt mit Firmen der dänischen Fischindustrie** als **effizient** ein. Zudem existiert ein **Index**, der die Kapitalisierung der dänischen Fischindustrie abbildet. Folgende **Empfehlungen** durch die Analysten an ihre Kundschaft, die in die dänische Fischindustrie investieren möchte, sind deshalb angebracht (d.h. im Sinne der Kundschaft):',
    contentPlain: 'Nach eingehender Analyse der Marktsituation stufen die Analysten der Copenhagen Fish Invest AG den Aktienmarkt mit Firmen der dänischen Fischindustrie als effizient ein. Zudem existiert ein Index, der die Kapitalisierung der dänischen Fischindustrie abbildet. Folgende Empfehlungen durch die Analysten an ihre Kundschaft, die in die dänische Fischindustrie investieren möchte, sind deshalb angebracht (d.h. im Sinne der Kundschaft):',
    type: QuestionType.KPRIM,
    choices: [
      {
        feedback:
          'Diese Aussage ist korrekt!',
        correct: true,
        value:
          'Eine Abweichung von der Benchmark, d.h. dem Index, der die dänische Fischindustrie abbildet, erbringt keinen Mehrwert, da langfristig kein Alpha generiert werden kann.',
      },
      {
        feedback: 'Diese Aussage ist nicht korrekt! Es ist zwar korrekt, dass passives Portfoliomanagement im Normalfall günstiger ist als die aktive Variante, da beispielsweise aufwändige Researcharbeiten wegfallen. Rebalancing nimmt bei passivem Portfoliomanagement jedoch eine wichtige Rolle ein. Von Rebalancing wird gesprochen, wenn das Vermögen umgeschichtet wird, um das Portfolio wieder in Einklang zur strategischen Asset Allocation zu bringen.',
        value:
          'Kunden, die passiv investieren möchten, können im Vergleich zum aktiven Management Kosten einsparen, da die Rebalancing-Kosten bei passivem Portfoliomanagement wegfallen.',
      },
      {
        feedback: 'Diese Aussage ist nicht korrekt! Da der dänische Fischmarkt als effizient befunden wird, sollte passives Investieren vorgezogen werden. Market-Timing sowie Titelselektion gehören zum aktiven Portfoliomanagement.',
        value:
          'Market-Timing und Titelselektion sind beim Investieren in den dänischen Fischmarkt auch in der längeren Frist erfolgsversprechender als eine Investition in den Index.',
      },
      {
        feedback:
          'Diese Aussage ist korrekt!',
        correct: true,
        value:
          'Eine passive buy-and-hold Strategie bei einer Investition in den dänischen Fischmarkt ist sinnvoll.',
      },
    ],
  },
  {
    id: 90,
    name: 'Modul 4 Technische Analyse',
    content: "",
    contentPlain: 'Beurteile folgende Aussagen auf ihre Richtigkeit.',
    type: QuestionType.KPRIM,
    choices: [
      {
        feedback:
          'Diese Aussage ist nicht korrekt!',
        value:
          'Die Chart Technik Analyse versucht durch Berechnung verschiedener Kennzahlen einen neuen Trend oder eine Trendänderung zu erkennen.',
      },
      {
        feedback: 'Diese Aussage ist korrekt!',
        correct: true,
        value:
          'Der Relativ Strength Index kann den Momentum-Indikatoren zugeordnet werden.',
      },
      {
        feedback: 'Diese Aussage ist korrekt!',
        correct: true,
        value:
          'Bei der Technischen Analyse werden anhand von vergangenen Marktbewegungen Prognosen für die zukünftigen Kursbewegungen erstellt.',
      },
      {
        feedback:
          'Diese Aussage ist korrekt!',
        correct: true,
        value:
          'Die Technische Analyse basiert auf der Annahme, dass die Aktienkurse alle relevanten Informationen enthalten.',
      },
    ],
  },
  {
    id: 91,
    name: 'Modul 4 Growth-, GARP- und Value-Investing',
    content: "",
    contentPlain: 'Beurteile folgende Aussagen auf ihre Richtigkeit.',
    type: QuestionType.KPRIM,
    choices: [
      {
        feedback:
          'Diese Aussage ist korrekt!',
        correct: true,
        value:
          'Growth-, GARP- und Value-Investing lohnen sich langfristig nur, wenn die Märkte als nicht vollständig effizient erachtet werden.',
      },
      {
        feedback: 'Diese Aussage ist nicht korrekt! Ein Growth-Investor berücksichtigt auch Unternehmen mit überdurchschnittlichen Wachstumserwartungen, die in Bezug auf Multiples eher teuer erscheinen.',
        value:
          'In Unternehmen, welche überdurchschnittliches Wachstum versprechen, aber in Bezug auf Multiples teuer erscheinen, investiert ein Growth-Investor nicht.',
      },
      {
        feedback: 'Diese Aussage ist korrekt!',
        correct: true,
        value:
          'Ein Value-Investor setzt insbesondere auf Unternehmen mit tiefem Kurs-Gewinn-Verhältnis (P/E-Ratio).',
      },
      {
        feedback:
          'Diese Aussage ist korrekt!',
        correct: true,
        value:
          'Das P/E-Ratio im Verhältnis zum EPS-Wachstum (PEG-Ratio) ist für GARP-Investoren von besonderer Relevanz, da sie das Verhältnis zwischen dem Wachstumspotenzial einer Aktie und ihrem Wert beschreibt.',
      },
    ],
  },
  {
    id: 92,
    name: 'Modul 4 Black-Litterman Modell I',
    content: "",
    contentPlain: 'Beurteile folgende Aussagen auf ihre Richtigkeit.',
    type: QuestionType.KPRIM,
    choices: [
      {
        feedback:
          'Diese Aussage ist nicht korrekt! Basis des Black-Litterman Ansatzes bilden zwar Portfoliogewichtungen, die der jeweiligen Marktkapitalisierung entsprechen. Typischerweise baut der Portfoliomanager in einem der nachfolgenden Schritte jedoch seine eigenen Einschätzungen („Views“) ein, um so eine Überrendite gegenüber dem Markt erzielen zu können. Er fährt somit eine aktive Strategie.',
        value:
          'Ein Portfoliomanager, der seine Asset Allocation anhand des Black-Litterman Modells festlegt, investiert typischerweise mit einer passiven Anlagestrategie.',
      },
      {
        feedback: 'Diese Aussage ist korrekt!',
        correct: true,
        value:
          'Ausgangspunkt des Black-Litterman Ansatzes bilden unter anderem Portfoliogewichtungen, die der jeweiligen Marktkapitalisierung der entsprechenden Anlageklasse oder Wertpapiere entsprechen.',
      },
      {
        feedback: 'Diese Aussage ist korrekt!',
        correct: true,
        value:
          'Das Black-Litterman Modell erlaubt Portfoliomanagern, ihre eigenen Einschätzungen („Views“) über die Entwicklung von Anlageklassen, verschiedenen Ländern oder Wertpapieren einzubringen.',
      },
      {
        feedback:
          'Diese Aussage ist nicht korrekt! Beim Black-Litterman Modell fliessen historische und prognostizierte Daten in die Asset Allocation Entscheidung mit ein.',
        value:
          'Historische Renditedaten werden beim Black-Litterman Ansatz nicht mehr benötigt, da lediglich die Einschätzungen („Views“) des jeweiligen Anlegers verwendet werden, um die Asset Allocation zu optimieren.',
      },
    ],
  },
  {
    id: 93,
    name: 'Modul 4 Black-Litterman Modell II',
    content: `Drei Analysten der Black-Litter-Man Consulting AG haben ihre **Views zur Entwicklung der Kapitalmärkte verschiedener Länder** abgegeben.
    1. Prognosematrix **P** mit Erwartungen („Views“) der Analysten:
    (Bild_modul4_BlackLitterman_Modell_II_1)
    2. Vektor **Q** mit Prognoseerwartungen der jeweiligen Analysten:
    (Bild_modul4_BlackLitterman_Modell_II_2)
    Überprüfe die folgenden Aussagen zu den **Einschätzungen der drei Analysten** auf ihre Korrektheit**.`,
    contentPlain: `Drei Analysten der Black-Litter-Man Consulting AG haben ihre Views zur Entwicklung der Kapitalmärkte verschiedener Länder abgegeben.
    1. Prognosematrix P mit Erwartungen („Views“) der Analysten:
    (Bild_modul4_BlackLitterman_Modell_II_1)
    2. Vektor Q mit Prognoseerwartungen der jeweiligen Analysten:
    (Bild_modul4_BlackLitterman_Modell_II_2)
    Überprüfe die folgenden Aussagen zu den Einschätzungen der drei Analysten auf ihre Korrektheit`,
    type: QuestionType.KPRIM,
    choices: [
      {
        feedback:
          'Diese Aussage ist korrekt!',
        correct: true,
        value:
          'Analyst Black erwartet, dass die Rendite eines Long-Schweiz-Portfolios um 5% höher sein wird als diejenige eines Short-Russland- und -USA-Portfolio.',
      },
      {
        feedback: 'Diese Aussage ist nicht korrekt! In der Aufgabenstellung sind keine Angaben bezüglich der Unsicherheit der Prognose der jeweiligen Analysten aufgeführt.',
        value:
          'Anhand der gegebenen Informationen ist ersichtlich, dass sich Analyst Litter bezüglich seiner Erwartung („View“) sicherer ist als Analyst Black.',
      },
      {
        feedback: 'Diese Aussage ist nicht korrekt! Analyst Man erwartet, dass die Rendite einer Investition in Deutschland 10% betragen wird.',
        value:
          'Analyst Man erwartet, dass die Rendite einer Investition in Deutschland um 10% höher sein wird als in den restlichen Märkten.',
      },
      {
        feedback:
          'Diese Aussage ist nicht korrekt! Beim Black-Litterman Modell fliessen historische und prognostizierte Daten in die Asset Allocation Entscheidung mit ein.',
        correct: true,
        value:
          'Die Analysten Black und Litter haben relative Erwartungen angegeben, während Analyst Man eine absolute Einschätzung abgegeben hat.',
      },
    ],
  },
  {
    id: 94,
    name: 'Modul 4 Marchzins',
    content: `Gegeben ist folgende Ausgangslage:
    Ein ausstehender Bond der XY AG zahlt einen Coupon von 4% p.a. vierteljährlich, jeweils am 1. Januar, 1. April, 1. Juli und 1. Oktober. Ein Investor kauft diesen Bond mit Nominalwert von 100 CHF am 1. August. Wie hoch ist der Marchzins (Accrued Interest), wenn ein Jahr 360 Tagen entspricht?`,
    contentPlain: `Gegeben ist folgende Ausgangslage:
    Ein ausstehender Bond der XY AG zahlt einen Coupon von 4% p.a. vierteljährlich, jeweils am 1. Januar, 1. April, 1. Juli und 1. Oktober. Ein Investor kauft diesen Bond mit Nominalwert von 100 CHF am 1. August. Wie hoch ist der Marchzins (Accrued Interest), wenn ein Jahr 360 Tagen entspricht?`,
    type: QuestionType.SC,
    choices: [
      {
        feedback: 'Falsch!',
        value:
        'CHF 0.16',
      },
      {
        feedback: `Korrekt! Die Couponzahlungen erfolgen vierteljährlich: $$ \frac{CHF 4}{4}*\frac{30}{90}=CHF 0.33 $$.
        Jährlichen Coupon von 4% (100 CHF*0.04 = 4 CHF), welcher vierteljährlich ausgeschüttet wird – also man dividiert durch 4.`,
        correct: true,
        value: 'CHF 0.33',
      },
      {
        feedback:
          'Falsch!',
        value: 'CHF 0.67',
      },
      {
        feedback: 'Falsch!',
        value:
          'CHF 1.33',
      },
      {
        feedback: 'Falsch!',
        value: 'Keine der genannten Aussagen ist richtig.',
      },
    ],
  },
  {
    id: 95,
    name: 'Modul 4 Bondpricing',
    content: `Gegeben ist folgende Ausgangslage:
    Ein Bond mit einer Laufzeit von 25 Jahren und einem Nennwert von 100 bezahlt halbjährlich einen Coupon von 3% (Zinssatz für 6 Monate). Der Marktzinssatz beträgt 5% p.a..
    Berechne den Preis des Bonds.`,
    contentPlain: `Gegeben ist folgende Ausgangslage:
    Ein Bond mit einer Laufzeit von 25 Jahren und einem Nennwert von 100 bezahlt halbjährlich einen Coupon von 3% (Zinssatz für 6 Monate). Der Marktzinssatz beträgt 5% p.a..
    Berechne den Preis des Bonds.`,
    type: QuestionType.SC,
    choices: [
      {
        feedback: 'Falsch!',
        value:
        'CHF 63.5',
      },
      {
        feedback: 'Falsch!',
        value: 'CHF 100.0',
      },
      {
        feedback:
          'Falsch!',
        value: 'CHF 109.8',
      },
      {
        feedback: `Korrekt! Der Marktzinssatz beträgt 5% p.a. Da wir den Zinssatz für 6 Monate benötigen, müssen wir diesen in den halbjährlichen Zinssatz umrechnen: $$(1+0.05)^{0.5}-1 = 0.0247$$, dann erst können wir den Bond bewerten: $$3*(\fraca{1}{0.0247}*(1-\frac{1}{(1+0.0247)}^{50}))+100*\frac{1}{(1+0.0247)}^{50}=115.1 CHF $$
        Der Coupon ist bereits halbjährlich, deshalb muss man diesen nicht mehr umwandeln.`,
        correct: true,
        value:
          'CHF 115.1',
      },
      {
        feedback: 'Falsch!',
        value: 'Keine der genannten Aussagen ist richtig.',
      },
    ],
  },
  {
    id: 96,
    name: 'Modul 4 Bondsensitivität',
    content: `Gegeben ist folgende Ausgangslage:
    Es sind zwei Bonds gegeben: A und B. Beide werden zu pari verkauft, haben einen Nennwert von CHF 100 und zahlen einen jährlichen Coupon von 3%. Während Bond A eine Laufzeit von 20 Jahren besitzt, ist das Ende der Laufzeit von Bond B erst in 27 Jahren.
    Wenn nun das allgemeine Marktzinsniveau um 2% steigt, dann...`,
    contentPlain: `Gegeben ist folgende Ausgangslage:
    Es sind zwei Bonds gegeben: A und B. Beide werden zu pari verkauft, haben einen Nennwert von CHF 100 und zahlen einen jährlichen Coupon von 3%. Während Bond A eine Laufzeit von 20 Jahren besitzt, ist das Ende der Laufzeit von Bond B erst in 27 Jahren.
    Wenn nun das allgemeine Marktzinsniveau um 2% steigt, dann...`,
    type: QuestionType.SC,
    choices: [
      {
        feedback: 'Falsch!',
        value:
        'sind die Bondpreise beider Bonds gestiegen, wobei der Preis des Bonds A stärker gestiegen ist als der Preis des Bonds B.',
      },
      {
        feedback: 'Falsch!',
        value: 'sind die Bondpreise beider Bonds gestiegen, wobei der Preis des Bonds B stärker gestiegen ist als der Preis des Bonds A.',
      },
      {
        feedback:
          'Falsch!',
        value: 'sind die Bondpreise beider Bonds gesunken, wobei der Preis des Bonds A stärker gefallen ist als der Preis des Bonds B.',
      },
      {
        feedback: 'Korrekt! Je länger die Laufzeit eines Bonds, desto stärker wirken sich Zinssatzveränderungen auf Bondpreise aus. Die Bondpreise sinken, da ein inverser Zusammenhang zwischen dem Preis eines Bonds und der Yield-to-Maturity besteht.',
        correct: true,
        value:
          'sind die Bondpreise beider Bonds gesunken, wobei der Preis des Bonds B stärker gefallen ist als der Preis des Bonds A.',
      },
      {
        feedback: 'Falsch!',
        value: 'Keine der genannten Aussagen ist richtig.',
      },
    ],
  },
  {
    id: 97,
    name: 'Modul 4 Yield-to-Maturity vs. Current Yield',
    content: 'Ein Bond wird **unter pari** gehandelt, wenn...',
    contentPlain: 'Ein Bond wird unter pari gehandelt, wenn...',
    type: QuestionType.SC,
    choices: [
      {
        feedback: 'Falsch!',
        value:
        'Coupon > Current Yield > Yield-to-Maturity',
      },
      {
        feedback: 'Korrekt! Ein Bond ist gleich pari, wenn der Coupon = Current Yield = Yield-to-Maturity. Sinkt nun der Bondpreis, so steigt sowohl die Current Yield, wie auch die Yield-to-Maturity an (inverse Beziehung): Coupon < Current Yield < Yield-to-Maturity.',
        correct: true
        value: 'Coupon < Current Yield < Yield-to-Maturity',
      },
      {
        feedback:
          'Falsch!',
        value: 'Coupon > Yield-to-Maturity',
      },
      {
        feedback: 'Falsch! Die Current Yield muss kleiner sein als die Yield-to-Maturity, da sie den Kapitalgewinn des Bonds nicht berücksichtigt.',
        value:
          'Coupon < Current Yield > Yield-to-Maturity',
      },
      {
        feedback: 'Falsch!',
        value: 'Keine der genannten Aussagen ist richtig.',
      },
    ],
  },
  {
    id: 98,
    name: 'Modul 4 Default Risk',
    content: 'Welche der folgenden Aussagen ist **richtig**?',
    contentPlain: 'Welche der folgenden Aussagen ist richtig?',
    type: QuestionType.SC,
    choices: [
      {
        feedback: 'Korrekt!',
        correct: true,
        value:
        'Junk Bonds sind Bonds die zum Spekulative Grade gehören und durch Ratings tiefer als BBB (S&P, Fitch) oder Baa (Moody's) charakterisiert sind.',
      },
      {
        feedback: 'Falsch! "Fallen Angel" nennt man einen im Investment Grade emittierten Bond (Rating von BBB und höher), dessen Bonität und Rating sich über die Zeit verschlechtert haben.',
        value: 'Wenn HeidelbergCement (mit einem BB Rating) einen Bond emittiert, so bezeichnet man diesen als "Fallen Angel".',
      },
      {
        feedback:
          'Falsch! Durch ein Collateral gedeckte Bonds sind zwar risikoärmer, allerdings kann auch der Wert des Collaterals bedeutend schwanken, wie wir am Beispiel von Mortgage Backed-Securities im Jahr 2007 gesehen haben.',
        value: 'Wird ein Bond durch ein Collateral gedeckt, so wird bei einem Ausfall der Unternehmung das Collateral verkauft und der Investor erleidet nie einen Ausfall.',
      },
      {
        feedback: 'Falsch! Ein bisheriger Bondhalter schützt seine Rückzahlung, indem sich das Unternehmen verpflichtet nur noch eine begrenzte Summe Fremdkapital aufzunehmen. Zusätzlich darf dieses neu aufgenommene Fremdkapital nur nachrangig aufgenommen werden, wodurch bisherige Fremdkapitalgeber in ihrer vorrangigen Stellung geschützt sind.',
        value:
          'Wenn eine Firma bereits Fremdkapital aufgenommen hat, können neue Gläubiger geschützt werden, indem ihre Bonds einen Seniorstatus erlangen, während die noch ausstehenden Bonds den neu Emittierten untergeordnet werden.',
      },
      {
        feedback: 'Falsch!',
        value: 'Keine der genannten Aussagen ist richtig.',
      },
    ],
  },
  {
    id: 99,
    name: 'Modul 4 Zinssensitivität I',
    content: 'Welche der folgenden Aussagen ist **richtig**?',
    contentPlain: 'Welche der folgenden Aussagen ist richtig?',
    type: QuestionType.SC,
    choices: [
      {
        feedback: 'Falsch! Die Höhe eines Coupons und die Preissensitivität eines Bonds stehen in einem inversen Verhältnis zueinander. Je höher also der Coupon eines Bonds, desto geringer reagiert sein Preis auf Zinsänderungen.',
        value:
        'Die Höhe eines Coupons und die Preissensitivität eines Bonds korrelieren positiv mit Zinsänderungen.',
      },
      {
        feedback: 'Falsch! Ein Anstieg der Yield to Maturity resultiert in einer kleineren Preisänderung, als eine Senkung der Yield to Maturity um den gleichen Betrag.',
        value: 'Ein Anstieg der Yield to Maturity resultiert in einer grösseren Preisänderung, als eine Senkung der Yield to Maturity um den gleichen Betrag.',
      },
      {
        feedback:
          'Korrekt!',
        correct: true,
        value: 'Preise von Bonds mit längerer Laufzeit reagieren stärker auf Zinsänderungen, als solche mit kürzerer Restlaufzeit.',
      },
      {
        feedback: 'Falsch! Bei steigender Restlaufzeit steigt die Sensitivität des Bondpreises an, allerdings ist dieser Anstieg der Sensitivität nicht linear, sondern degressiv.',
        value:
          'Wenn Bond A eine Restlaufzeit von sechs Jahren besitzt und Bond B eine von einem Jahr, dann hat Bond A auch eine sechsmal grössere Zinssensitivität.',
      },
      {
        feedback: 'Falsch! Das Zinsänderungsrisiko eines Coupon-Bonds steigt (ceteris paribus) mit sinkender Yield to Maturity.',
        value: 'Das Zinsänderungsrisiko eines Coupon-Bonds steigt (ceteris paribus) mit steigender Yield to Maturity.',
      },
    ],
  },
  {
    id: 100,
    name: 'Modul 4 Zinssensitivität II',
    content: 'Bei welchem der folgenden Bonds (alle mit dem gleichen Rating) hat eine Marktzinssatzsenkung von 2% die grösste Auswirkung auf den Preis?',
    contentPlain: 'Bei welchem der folgenden Bonds (alle mit dem gleichen Rating) hat eine Marktzinssatzsenkung von 2% die grösste Auswirkung auf den Preis?',
    type: QuestionType.SC,
    choices: [
      {
        feedback: 'Falsch!',
        value:
        '5 Jahre Laufzeit, Verkaufspreis 100.',
      },
      {
        feedback: 'Falsch!',
        value: '10 Jahre Laufzeit, Verkaufspreis 80.',
      },
      {
        feedback:
          'Falsch!',
        value: '10 Jahre Laufzeit, Verkaufspreis 100.',
      },
      {
        feedback: 'Korrekt! Je länger die Laufzeit und je kleiner die Coupons, desto grösser ist die Marktzinssensitivität. Bonds mit derselben Laufzeit und demselben Rating aber tieferem Kurs weisen eine kleinere Couponverzinsung auf.',
        correct: true,
        value:
          '20 Jahre Laufzeit, Verkaufspreis 80.',
      },
      {
        feedback: 'Falsch!',
        value: '20 Jahre Laufzeit, Verkaufspreis 100.',
      },
    ],
  },
  {
    id: 101,
    name: 'Modul 4 Duration I',
    content: `Welche der folgenden Aussagen ist **falsch**?
    Hinweis: Gehe immer vom absoluten Betrag der Modified Duration aus.`,
    contentPlain: `Welche der folgenden Aussagen ist falsch?
    Hinweis: Gehe immer vom absoluten Betrag der Modified Duration aus.`,
    type: QuestionType.SC,
    choices: [
      {
        feedback: 'Falsch!',
        value:
        'Bei gegebener YTM und Restlaufzeit ist die Modified Duration bei kleineren Coupons höher.',
      },
      {
        feedback: 'Falsch!',
        value: 'Die Modified Duration steigt - ceteris paribus - mit wachsender Restlaufzeit an.',
      },
      {
        feedback:
          'Falsch!',
        value: 'Die Modified Duration ist ein besseres Zinssensitivitätsmass als die YTM.',
      },
      {
        feedback: 'Korrekt! Die Duration eines Zero Bonds ist immer gleich der Restlaufzeit.',
        correct: true,
        value:
          'Bei gegebener Restlaufzeit steigt die einfache Duration eines Zero Bonds mit sinkender YTM.',
      },
      {
        feedback: 'Falsch!',
        value: 'Einfache und Modified Duration reagieren beide bei Veränderungen des Zinsniveaus, der Restlaufzeit und der Couponhöhe in die gleiche Richtung.',
      },
    ],
  },
  {
    id: 102,
    name: 'Modul 4 Duration II',
    content: `Berechne die Duration eines Bonds mit Preis gleich Nennwert von CHF 1000, einem Coupon von 7% und einer Restlaufzeit von 3 Jahren.`,
    contentPlain: `Berechne die Duration eines Bonds mit Preis gleich Nennwert von CHF 1000, einem Coupon von 7% und einer Restlaufzeit von 3 Jahren.`,
    type: QuestionType.SC,
    choices: [
      {
        feedback: 'Falsch!',
        value:
        '2.71 Jahre',
      },
      {
        feedback: `Korrekt! 
(Bild_modul4_durationII)`,
        correct: true,
        value: '2.81 Jahre',
      },
      {
        feedback:
          'Falsch!',
        value: '2.91 Jahre',
      },
      {
        feedback: 'Falsch!',
        value:
          '2.93 Jahre',
      },
      {
        feedback: 'Falsch!',
        value: '3.00 Jahre',
      },
    ],
  },
  {
    id: 103,
    name: 'Modul 4 Duration III',
    content: `Wie hoch ist die Duration einer ewigen Rente (Perpetuity), wenn ihr Zins 8% beträgt?`,
    contentPlain: `Wie hoch ist die Duration einer ewigen Rente (Perpetuity), wenn ihr Zins 8% beträgt?`,
    type: QuestionType.SC,
    choices: [
      {
        feedback: 'Falsch!',
        value:
        '0.07 Jahre',
      },
      {
        feedback: 'Falsch!',
        value: '6.66 Jahre',
      },
      {
        feedback:
          'Falsch!',
        value: '12.11 Jahre',
      },
      {
        feedback: 'Korrekt! Die Duration einer ewigen Rente berechnet sich folgendermassen: $$ \frac{(1+y}{y} --> \frac{(1+0.08)}{0.08}=13.50 Jahre $$.',
        correct: true,
        value:
          '13.50 Jahre',
      },
      {
        feedback: 'Falsch!',
        value: 'Keine der genannten Aussagen ist richtig.',
      },
    ],
  },
  {
    id: 104,
    name: 'Modul 4 Modified Duration',
    content: `Gegeben ist ein Bond mit einer Macaulay Duration von 4.24 Jahren und einer YTM von 6%. Welche der folgenden Aussagen ist **richtig**?`,
    contentPlain: `Gegeben ist ein Bond mit einer Macaulay Duration von 4.24 Jahren und einer YTM von 6%. Welche der folgenden Aussagen ist richtig?`,
    type: QuestionType.SC,
    choices: [
      {
        feedback: 'Korrekt!',
        correct: true,
        value:
        'Steigt der Marktzins um 0.5%, so sinkt der Bondpreis um 2%.',
      },
      {
        feedback: 'Falsch! Die Modified Duration beträgt zwar 4, jedoch ist der Zusammenhang zwischen Marktzinssatz und Bondpreisänderungen invers.',
        value: 'Steigt der Marktzins um 0.5%, so steigt der Bondpreis um 2%.',
      },
      {
        feedback:
          'Falsch! Der Zusammenhang zwischen Marktzinssatz und Bondpreisänderungen ist zwar invers, jedoch beträgt Modified Duration 4.',
        value: 'Sinkt der Marktzins um 2%, so steigt der Bondpreis um 4%.',
      },
      {
        feedback: 'Falsch! Die Modified Duration beträgt 4 und der Zusammenhang zwischen Marktzinssatz und Bondpreisänderungen ist invers.',
        value:
          'Sinkt der Marktzins um 2%, so sinkt der Bondpreis um 4%.',
      },
      {
        feedback: 'Falsch!',
        value: 'Keine der genannten Aussagen ist richtig.',
      },
    ],
  },
  {
    id: 105,
    name: 'Modul 4 Passives Bond Management',
    content: 'Welche der folgenden Aussagen ist **falsch**?',
    contentPlain: 'Welche der folgenden Aussagen ist falsch?',
    type: QuestionType.SC,
    choices: [
      {
        feedback: 'Falsch!',
        value:
        'Es existieren zwei Klassen von passivem Management im Fixed-Income Markt: Die Index-Strategie und die Zinsimmunisierung, welche das Zinsänderungsrisiko im Portfolio aufheben soll.',
      },
      {
        feedback: 'Falsch!',
        value: 'Schwierigkeiten bei der Konstruktion eines Bond-Indizes bereiten beispielsweise die Addition aller Neuemissionen in den Index und die Streichung aller Bonds mit Restlaufzeiten unter einem Jahr.',
      },
      {
        feedback:
          'Falsch!',
        value: 'Das Konzept hinter der Zinsimmunisierung ist das folgende: Eine Erhöhung des Marktzinssatzes führt zu einem Kapitalverlust auf dem Bond. Gleichzeitig erhöht sich die Reinvestment Rate - im Falle einer optimal gewählten Portfolioduration  - genau um jenen Betrag, so dass sich die beiden Effekte aufheben.',
      },
      {
        feedback: 'Falsch!',
        value:
          'Damit die Duration des Portfolios und der Investitionshorizont des Investors übereinstimmen, muss ein Portfolio Manager das Portfolio kontinuierlich rebalancieren.',
      },
      {
        feedback: 'Richtig! Diese Aussage ist nicht korrekt. Das Konzept der Duration unterstellt flache Zinskurven. Im Fall steigender oder fallender Zinskurven kann die Zinsimmunisierung ineffektiv oder ungeeignet sein.',
        correct: true,
        value: 'Die Zinsimmunisierung kann ineffektiv oder ungeeignet sein, da das Konzept der Duration steigende Zinskurven unterstellt.',
      },
    ],
  },
  {
    id: 106,
    name: 'Modul 4 Innerer Wert',
    content: `Gegeben ist folgende Ausgangslage:
    Der heutige Kurs der Citigroup-Aktie liegt bei $4.70. Die 52-Woche Kursvorhersage nennt einen Aktienpreis von $5.42, wobei in einem Jahr zusätzlich eine Bardividende von $0.32 erwartet wird. Citigroup besitzt ein Beta von 1.34. Schliesslich sind mit 4.5% und 11% der risikofreie Zinssatz sowie die erwartete Rendite des Marktportfolios für ein Jahr gegeben.
    Wie hoch ist bei obigen Annahmen der heutige innerer Wert der Citigroup-Aktie?`,
    contentPlain: `Gegeben ist folgende Ausgangslage:
    Der heutige Kurs der Citigroup-Aktie liegt bei $4.70. Die 52-Woche Kursvorhersage nennt einen Aktienpreis von $5.42, wobei in einem Jahr zusätzlich eine Bardividende von $0.32 erwartet wird. Citigroup besitzt ein Beta von 1.34. Schliesslich sind mit 4.5% und 11% der risikofreie Zinssatz sowie die erwartete Rendite des Marktportfolios für ein Jahr gegeben.
    Wie hoch ist bei obigen Annahmen der heutige innerer Wert der Citigroup-Aktie?`,
    type: QuestionType.SC,
    choices: [
      {
        feedback: 'Falsch!',
        value:
        '$4.43',
      },
      {
        feedback: 'Falsch!',
        value: '$4.70',
      },
      {
        feedback:
          'Falsch!',
        value: '$4.81',
      },
      {
        feedback: 'Korrekt!',
        correct: true,
        value:`$5.07
Diese Aussage ist korrekt! Der intrinsische Wert $$V_0$$ ist der Present Value aller künftigen Cash Flows. Dies bedeutet, dass sowohl die erwartete Dividende als auch der erwartete Aktienkurs mit dem per CAPM ermittelten risikogerechten Diskontierungssatz verrechnet werden müssen.
Angaben für das CAPM sind die folgenden gegeben: risikofreier Zinssatz 4.5%, erwartete Rendite des Marktportfolios 11%, Beta der Citigroup von 1.34. Verwendest du nun die CAPM Formel:
$$ k_{EK}=r_f+β*(r_m−r_f)*k_{EK}=r_f+β*(r_m−r_f) $$
In einem zweiten Schritt werden die einjährige Kursvorhersage für den Aktienpreis von 5.42 und die Bardividende von 0.32 auf t=0 diskontiert.
$$ 5.42+0.32*(1+0.1321)*1=5.07 $$

Achtung:
**Wert einer Aktie / intrinsischer Wert / innerer Wert:** Der Wert eines Unternehmens / Wertpapieres aufgrund von objektiven Bewertungsansätzen (der angemessende Wert).
**Preis / Marktwert:** Dieser muss nicht zwingend dem inneren Wert entsprechen (**Wert ist nicht gleich Preis!**). Angebot und Nachfrage spielen bei der Preisbildung eine wesentliche Rolle. Darum werden auch die berechneten Aktienpreise durch diverse Modelle beinahe immer verschieden sein von den tatsächlich existierenden Preisen.`,
      },
      {
        feedback: 'Falsch!',
        value: '$5.28',
      },
    ],
  },
  {
    id: 107,
    name: 'Modul 4 Constant-Growth DDM',
    content: `Gegeben ist folgende Ausgangslage:
    Angenommen die Aktien der Sulzer AG werden heute zu ihrem intrinsischen Wert von CHF 89.05 ($$P_0$$) gehandelt. Im folgenden Jahr werden dann überraschend die erwarteten künftigen Dividendenzahlungen um g=5% p.a. höher geschätzt.
    Welchen Wert ($$P_1$$) hat die Sulzer AG unter Berücksichtigung der neuen Erwartungen?`,
    contentPlain: `Gegeben ist folgende Ausgangslage:
    Angenommen die Aktien der Sulzer AG werden heute zu ihrem intrinsischen Wert von CHF 89.05 (P0) gehandelt. Im folgenden Jahr werden dann überraschend die erwarteten künftigen Dividendenzahlungen um g=5% p.a. höher geschätzt.
    Welchen Wert (P1) hat die Sulzer AG unter Berücksichtigung der neuen Erwartungen?`,
    type: QuestionType.SC,
    choices: [
      {
        feedback: 'Korrekt! Eine der Implikationen des Constant-Growth DDM ist es, dass der Aktienkurs mit der gleichen erwarteten Wachstumsrate ansteigt, wie die Dividenden ($$89.05 CHF*1.05 = 93.50CHF$$).',
        correct: true,
        value:
        'CHF 93.50',
      },
      {
        feedback: 'Falsch!',
        value: 'CHF 92.14',
      },
      {
        feedback:
          'Falsch!',
        value: 'CHF 89.05',
      },
      {
        feedback: 'Falsch!',
        value:'CHF 84.60',
      },
      {
        feedback: 'Falsch!',
        value: 'Keine der genannten Aussagen ist korrekt.',
      },
    ],
  },
  {
    id: 108,
    name: 'Modul 4 P/E Ratio',
    content: 'Welche der folgenden Aussagen ist **falsch**?',
    contentPlain: 'Welche der folgenden Aussagen ist falsch?',
    type: QuestionType.SC,
    choices: [
      {
        feedback: 'Falsch! Diese Aussage ist korrekt. Das P/E Ratio wird unter anderem durch den Optimismus oder Pessimismus bezüglich des firmenspezifischen Wachstumspotentials bestimmt.',
        value:
        'Unterschiede im erwarteten Wachstumspotential einer Unternehmung zeigen sich auch im P/E Ratio.',
      },
      {
        feedback: 'Falsch! Diese Aussage ist korrekt. Dies ergibt sich aus: P/E=$${(1-b)}{(k-g)}',
        value: 'Ein höheres Risiko einer Unternehmung lässt das P/E Ratio ceteri paribus sinken.',
      },
      {
        feedback:
          'Korrekt! Bei hoher Inflationsrate befinden sich P/E Ratios relativ auf einem tiefen Niveau.',
        correct: true,
        value: 'Bei hoher Inflation befinden sich auch die P/E Ratios tendenziell auf einem höheren Niveau als dies bei tiefer Inflation der Fall ist.',
      },
      {
        feedback: `Falsch! Diese Aussage ist korrekt. P/E=$${(1-b)}{(k-[ROE*b])}.`,
        value:'Sowohl der ROE als auch die vom Markt erwartete Rendite (CAPM) sind Parameter des P/E Ratio.',
      },
      {
        feedback: 'Falsch! Diese Aussage ist korrekt. Dass das P/E Ratio der Wachstumsrate entspricht, ist eine beliebte Daumenregel an der Wall Street. Diese Relation zwischen P/E Ratio und Wachstumsrate wird oftmals auch PEG Ratio genannt, wobei obige Daumenregel dann ein PEG Ratio von genau 1 besitzt.',
        value: 'Das P/E Ratio wird oftmals mit der Wachstumsrate des Unternehmens gleichgesetzt, wonach eine Firma mit einem P/E Ratio von 12 auch eine Wachstumsrate von 12% besitzen soll.',
      },
    ],
  },
  {
    id: 109,
    name: 'Modul 4 P/E-Ratio mit wachsenden Dividenden',
    content: `Zur AIRESIS AG sind folgende Angaben gegeben:
    Die erzielte Rendite (ROE) des Unternehmens beträgt 12%, das Dividendenwachstum beträgt 1.5% und die vom Markt verlangte Rendite (CAPM) beträgt 7%.
    Wie hoch ist die P/E-Ratio der AIRESIS AG?`,
    contentPlain: `Zur AIRESIS AG sind folgende Angaben gegeben:
    Die erzielte Rendite (ROE) des Unternehmens beträgt 12%, das Dividendenwachstum beträgt 1.5% und die vom Markt verlangte Rendite (CAPM) beträgt 7%.
    Wie hoch ist die P/E-Ratio der AIRESIS AG?`,
    type: QuestionType.SC,
    choices: [
      {
        feedback: 'Korrekt! $$ \frac{P_0}{E_1}=\frac{(1-b)}{(k-b*ROE)} $$',
        correct: true,
        value:
        '15.91',
      },
      {
        feedback: 'Falsch!',
        value: '14.44',
      },
      {
        feedback:
          'Falsch!',
        value: '8.28',
      },
      {
        feedback: `Falsch!`,
        value:'7.87',
      },
      {
        feedback: 'Falsch!',
        value: 'Die Angaben reichen nicht aus, um das Kurs-Gewinn-Verhältnis auszurechnen.',
      },
    ],
  },
  {
    id: 110,
    name: 'Modul 4 Business Cycle I',
    content: 'Aktien von Unternehmen aus zyklischen Industriezweigen haben tendenziell Beta-Werte...',
    contentPlain: 'Aktien von Unternehmen aus zyklischen Industriezweigen haben tendenziell Beta-Werte...',
    type: QuestionType.SC,
    choices: [
      {
        feedback: 'Falsch!',
        value:
        '... zwischen 0.0 und 1.0.',
      },
      {
        feedback: 'Falsch!',
        value: '... von etwa 0.0',
      },
      {
        feedback:
          'Falsch!',
        value: '... von etwa 1.0.',
      },
      {
        feedback: 'Korrekt! Aktien aus zyklischen Industrien sind tendenziell volatiler als der Gesamtmarkt und besitzen dementsprechend einen Betawert über 1.0.',
        correct: true,
        value:'... über 1.0.',
      },
      {
        feedback: 'Falsch!',
        value: 'Keine der genannten Aussagen ist richtig.',
      },
    ],
  },
  {
    id: 111,
    name: 'Modul 4 Business Cycle II',
    content: 'Welche der folgenden Branchen gehört **nicht** zu den defensiven Industrien?',
    contentPlain: 'Welche der folgenden Branchen gehört nicht zu den defensiven Industrien?',
    type: QuestionType.SC,
    choices: [
      {
        feedback: 'Falsch!',
        value:
        'Nahrungsmittelbranche',
      },
      {
        feedback: 'Falsch!',
        value: 'Pharmabranche',
      },
      {
        feedback:
          'Korrekt! Zu den defensiven Industrien gehören jene Branchen, welche nur gering sensitiv auf Veränderungen der gesamtwirtschaftlichen Lage reagieren. Hierzu gehören besonders Industrien und Produkte, welche für das alltägliche Leben unabdingbar sind. Beispiele sind Nahrungsmittel, Elektrizität oder auch Medikamente.',
        correct: true,
        value: 'Automobilindustrie',
      },
      {
        feedback: 'Falsch!',
        value:'Tabakindustrie',
      },
      {
        feedback: 'Falsch!',
        value: 'Elektrizitätsbranche',
      },
    ],
  },
  {
    id: 112,
    name: 'Modul 4 Indikatoren',
    content: "",
    contentPlain: 'Beurteile folgende Aussagen auf ihre Richtigkeit.',
    type: QuestionType.KPRIM,
    choices: [
      {
        feedback:
          'Diese Aussage ist korrekt!',
        correct: true,
        value:
          'Unter vorauseilenden Indikatoren werden Indikatoren verstanden, welche die Wirtschaftsentwicklung voraussehen.',
      },
      {
        feedback: 'Diese Aussage ist nicht korrekt!',
        value:
          'Für einen Investitionsentscheid sind die nacheilenden Indikatoren von entscheidender Bedeutung.',
      },
      {
        feedback: 'Diese Aussage ist nicht korrekt!',
        value:
          'Ein Beispiel für einen vorauseilenden Indikatoren ist die Industrieproduktion.',
      },
      {
        feedback:
          'Diese Aussage ist korrekt!',
        correct: true,
        value:
          'Gleichlaufende Indikatoren zeigen an, in welchem Zyklus sich die Wirtschaft befindet.',
      },
    ],
  },
  {
    id: 113,
    name: 'Modul 4 Sektor-Rotation',
    content: `Welche der folgenden Aussagen ist **richtig**?
    Gemäss dem Ansatz der Sektor-Rotation...`,
    contentPlain: `Welche der folgenden Aussagen ist richtig?
    Gemäss dem Ansatz der Sektor-Rotation...`,
    type: QuestionType.SC,
    choices: [
      {
        feedback: 'Falsch! Finanztitel sollten gemäss dem Sektor-Rotations-Ansatz am Ende einer Kontraktion gekauft werden.',
        value:
        '... sollten Finanztitel am Ende einer Expansion gekauft werden.',
      },
      {
        feedback: 'Korrekt!',
        correct: true,
        value: '... sollte beim Beginn einer Kontraktion in die Pharmabranche investiert werden.',
      },
      {
        feedback:
          'Falsch! Industrietitel sollten gemäss dem Ansatz der Sektor-Rotation in mitten einer Expansionsphase gekauft werden.',
        value: '... sollten Industrietitel mitten in einer Kontraktionsphase gekauft werden.',
      },
      {
        feedback: 'Falsch! In Energietitel sollte gemäss dem Ansatz der Sektor-Rotation am Ende einer Expansion investiert werden.',
        value:'... sollte am Anfang einer Expansion in Energietitel investiert werden.',
      },
      {
        feedback: 'Falsch!',
        value: 'Keine der oben genannten Aussagen ist richtig.',
      },
    ],
  },
  {
    id: 114,
    name: 'Modul 4 Anlageinstrumente',
    content: "",
    contentPlain: 'Beurteile folgende Aussagen auf ihre Richtigkeit.',
    type: QuestionType.KPRIM,
    choices: [
      {
        feedback:
          'Diese Aussage ist korrekt!',
        correct: true,
        value:
          'Anlagefonds sind Anlageinstrumente, die es erlauben, aktiv anzulegen.',
      },
      {
        feedback: 'Diese Aussage ist nicht korrekt! Das Management versucht den Renditeverlauf der Benchmark exakt abzubilden, das heisst der Markt wird nicht geschlagen.',
        value:
          'Exchange Traded Funds (ETFs) sind passive Anlageinstrumente, bei denen der Hauptfokus darauf liegt, durch Kostenminimierung den Markt zu schlagen und so eine Überrendite zu generieren.',
      },
      {
        feedback: 'Diese Aussage ist korrekt! ',
        correct: true,
        value:
          'Die Total Expense Ratio (TER) entspricht der Gesamtkostenquote, welche die Summe der Kosten und Gebühren relativ zum durchschnittlichen Fondsvermögen misst.',
      },
      {
        feedback:
          'Diese Aussage ist nicht korrekt! Transaktionskosten sind nicht in der TER enthalten.',
        value:
          'Der Hauptvorteil der Total Expense Ratio (TER) ist, dass sie die Transaktionskosten enthält, die bei Portfolioumschichtungen anfallen. Dies ermöglicht der TER ein umfassendes Bild der Kostenstruktur auszuweisen.',
      },
    ],
  },
  {
    id: 115,
    name: 'Modul 4 Anlagefonds/Exchange Traded Funds',
    content: "",
    contentPlain: 'Beurteile folgende Aussagen auf ihre Richtigkeit.',
    type: QuestionType.KPRIM,
    choices: [
      {
        feedback:
          'Diese Aussage ist nicht korrekt! Das Ziel ist nicht eine Überrendite zu erhalten, sondern den Markt beinahe exakt abzubilden.',
        value:
          'Passive Anlageinstrumente wie Exchange Traded Funds (ETFs) werden aktiven Instrumenten besonders dann vorgezogen, wenn der Investor vermutet, mit einer professionellen Titelauswahl Übergewinne realisieren zu können.',
      },
      {
        feedback: 'Diese Aussage ist nicht korrekt! Bei ETFs sind kaum spezifische Anlagethemen verfügbar.',
        value:
          'Exchange Traded Funds (ETFs) eigenen sich besonders dafür, diverse Anlagethemen wie zum Beispiel "Nachhaltigkeit" gezielter abzudecken.',
      },
      {
        feedback: 'Diese Aussage ist nicht korrekt! Bei beiden Anlageinstrumenten ist Diversifikation möglich.',
        value:
          'Während Exchange Traded Funds (ETFs) durch ihre breite Streuung eine Diversifikation der Investitionen erlauben, ist eine Diversifikation durch den Kauf aktiver Anlageinstrumente wie Anlagefonds nicht möglich.',
      },
      {
        feedback:
          'Diese Aussage ist korrekt!',
        correct: true,
        value:
          'Die grössten Nachteile aktiver Anlageinstrumente wie Anlagefonds sind, dass Kosten für das Management anfallen und die Performance des Anlageinstrumentes stark von der Qualität des Managements abhängt.',
      },
    ],
  },
  {
    id: 116,
    name: 'Modul 4 Strukturierte Produkte I',
    content: "",
    contentPlain: 'Beurteile folgende Aussagen auf ihre Richtigkeit.',
    type: QuestionType.KPRIM,
    choices: [
      {
        feedback:
          'Diese Aussage ist korrekt!',
        correct: true,
        value:
          'Strukturierte Produkte können grundsätzlich in die drei Übergruppen "Kapitalschutz", "Renditeoptimierung" und "Partizipation" unterteilt werden.',
      },
      {
        feedback: 'Diese Aussage ist korrekt!',
        correct: true,
        value:
          'Beim Kauf von Strukturierten Produkten sollte immer abgeklärt werden, wer die Rückzahlung garantiert und wie hoch das Gegenparteirisiko des Emittenten ist.',
      },
      {
        feedback: 'Diese Aussage ist nicht korrekt!',
        value:
          'Strukturierte Produkte sind deshalb so beliebt, weil sie stets ermöglichen bei limitiertem down-side Risiko im up-side Bereich unlimitiert zu partizipieren.',
      },
      {
        feedback:
          'Diese Aussage ist korrekt!',
        correct: true,
        value:
          'Strukturierte Produkte erlauben es, das individuelle Risiko-Rendite-Profil des Portfolios eines Investors an seine Bedürfnisse anzupassen.',
      },
    ],
  },
  {
    id: 116,
    name: 'Modul 4 Anlagefonds/Exchange Traded Funds',
    content: "",
    contentPlain: 'Beurteile folgende Aussagen auf ihre Richtigkeit.',
    type: QuestionType.KPRIM,
    choices: [
      {
        feedback:
          'Diese Aussage ist korrekt!',
        correct: true,
        value:
          'Kapitalschutzprodukte zeichnen sich durch ein unlimitiertes up-side Potenzial aus und beschränken gleichzeitig das down-side Risiko.',
      },
      {
        feedback: 'Diese Aussage ist nicht korrekt! Renditeoptimierungsprodukte werden eingesetzt, wenn man von seitwärtstendierenden Märkten ausgeht.',
        value:
          'Kapitalschutzprodukte werden vor allem dann eingesetzt, wenn man von seitwärtstendierenden Märkten ausgeht.',
      },
      {
        feedback: 'Diese Aussage ist nicht korrekt! Das up-side Potential ist bei Discount-Zertifikaten limitiert.',
        value:
          'Discount-Zertifikate, die als Standardprodukt für die Renditeoptimierungskategorie gelten, sind deshalb so beliebt, weil sie zwar unlimitiertes down-side Risiko aufweisen, gleichzeitig aber auch unlimitiertes up-side Potenzial bieten.',
      },
      {
        feedback:
          'Diese Aussage ist korrekt!',
        correct: true,
        value:
          'Partizipationsprodukte haben oft den Nachteil, dass ihre Kostenstruktur unklar ist.',
      },
    ],
  },
=======
  {
    id: 48,
    name: 'Geldmarkt',
    content: 'Wie viel würdest du im Geldmarkt anlegen?',
    contentPlain: 'Wie viel würdest du im Geldmarkt anlegen?',
    type: QuestionType.NUMERICAL,
    options: {
      restrictions: {
        min: 0,
        max: 100,
      },
    },
  },
  {
    id: 49,
    name: 'Obligationen',
    content: 'Wie viel würdest du in Obligationen anlegen?',
    contentPlain: 'Wie viel würdest du in Obligationen anlegen?',
    type: QuestionType.NUMERICAL,
    options: {
      restrictions: {
        min: 0,
        max: 100,
      },
    },
  },
  {
    id: 50,
    name: 'Aktien',
    content: 'Wie viel würdest du in Aktien anlegen?',
    contentPlain: 'Wie viel würdest du in Aktien anlegen?',
    type: QuestionType.NUMERICAL,
    options: {
      restrictions: {
        min: 0,
        max: 100,
      },
    },
  },
  {
    id: 51,
    name: 'Alternative Anlagen',
    content:
      'Wie viel würdest du in Alternative Anlagen (z.B., Rohstoffe oder Edelmetalle) anlegen?',
    contentPlain:
      'Wie viel würdest du in Alternative Anlagen (z.B., Rohstoffe oder Edelmetalle) anlegen?',
    type: QuestionType.NUMERICAL,
    options: {
      restrictions: {
        min: 0,
        max: 100,
      },
    },
  },
  {
    id: 52,
    name: 'Rendite YTD Swiss Bond Index',
    content:
      'Welche Rendite hat der Swiss Bond Index year-to-date erzielt? (Angabe in ganzen Zahlen, ohne Prozentzeichen)',
    contentPlain:
      'Welche Rendite hat der Swiss Bond Index year-to-date erzielt? (Angabe in ganzen Zahlen, ohne Prozentzeichen)',
    type: QuestionType.NUMERICAL,
    options: {
      restrictions: {
        min: undefined,
        max: undefined,
      },
    },
  },
  {
    id: 53,
    name: 'Rendite YTD Swiss Performance Index',
    content:
      'Welche Rendite hat der Swiss Performance Index year-to-date erzielt? (Angabe in ganzen Zahlen, ohne Prozentzeichen)',
    contentPlain:
      'Welche Rendite hat der Swiss Performance Index year-to-date erzielt? (Angabe in ganzen Zahlen, ohne Prozentzeichen)',
    type: QuestionType.NUMERICAL,
    options: {
      restrictions: {
        min: undefined,
        max: undefined,
      },
    },
  },
  {
    id: 54,
    name: 'Rendite YTD S&P 500',
    content:
      'Welche Rendite hat der S&P 500 year-to-date erzielt? (Angabe in ganzen Zahlen, ohne Prozentzeichen)',
    contentPlain:
      'Welche Rendite hat der S&P 500 year-to-date erzielt? (Angabe in ganzen Zahlen, ohne Prozentzeichen)',
    type: QuestionType.NUMERICAL,
    options: {
      restrictions: {
        min: undefined,
        max: undefined,
      },
    },
  },
  {
    id: 55,
    name: 'Relevanz SAA',
    content:
      'Welche Relevanz hat die Strategische Asset Allocation auf die Rendite des Portfolios? Gib deine Antwort in %-Werten der erzielten Rendite an. 0% bedeutet, dass die Strategie keinen Einfluss auf die Rendite hat und 100%, dass die Rendite durch die Strategie getrieben wird.',
    contentPlain:
      'Welche Relevanz hat die Strategische Asset Allocation auf die Rendite des Portfolios? Gib deine Antwort in %-Werten der erzielten Rendite an. 0% bedeutet, dass die Strategie keinen Einfluss auf die Rendite hat und 100%, dass die Rendite durch die Strategie getrieben wird.',
    type: QuestionType.NUMERICAL,
    options: {
      restrictions: {
        min: undefined,
        max: undefined,
      },
    },
  },
  {
    id: 56,
    name: 'Rendite von Obligationen',
    content:
      'Wie hoch schätzt du die durchschnittliche, jährliche Rendite von Obligationen in der Schweiz seit 1926 ein? (Angabe in %)',
    contentPlain:
      'Wie hoch schätzt du die durchschnittliche, jährliche Rendite von Obligationen in der Schweiz seit 1926 ein? (Angabe in %)',
    type: QuestionType.NUMERICAL,
    options: {
      restrictions: {
        min: 0,
        max: 100,
      },
    },
  },
  {
    id: 57,
    name: 'Rendite von Aktien',
    content:
      'Wie hoch schätzt du die durchschnittliche, jährliche Rendite von Aktien in der Schweiz seit 1926 ein? (Angabe in %)',
    contentPlain:
      'Wie hoch schätzt du die durchschnittliche, jährliche Rendite von Aktien in der Schweiz seit 1926 ein? (Angabe in %)',
    type: QuestionType.NUMERICAL,
    options: {
      restrictions: {
        min: 0,
        max: 100,
      },
    },
  },
  {
    id: 58,
    name: 'Risiko von Obligationen',
    content:
      'Wie hoch schätzt du das Risiko (gemessen als Standardabweichung) von Obligationen in der Schweiz ein? (Angabe in %)',
    contentPlain:
      'Wie hoch schätzt du das Risiko (gemessen als Standardabweichung) von Obligationen in der Schweiz ein? (Angabe in %)',
    type: QuestionType.NUMERICAL,
    options: {
      restrictions: {
        min: 0,
        max: 100,
      },
    },
  },
  {
    id: 59,
    name: 'Risiko von Aktien',
    content:
      'Wie hoch schätzt du das Risiko (gemessen als Standardabweichung) von Aktien in der Schweiz ein? (Angabe in %)',
    contentPlain:
      'Wie hoch schätzt du das Risiko (gemessen als Standardabweichung) von Aktien in der Schweiz ein? (Angabe in %)',
    type: QuestionType.NUMERICAL,
    options: {
      restrictions: {
        min: 0,
        max: 100,
      },
    },
  },
>>>>>>> 1c7e6838943a8480f48e9e82e221c542999c4729
]

export const LEARNING_ELEMENTS = [
  {
    id: '3e588933-36ce-49b1-9fad-87481843f7c1',
    name: 'AMI MC 1',
    displayName: 'AMI Modul 1 - Lernfragen',
    questions: range(30, 48),
  },
  
]

export const SESSIONS = [
  {
    id: '02df291b-f4cd-46f2-8dbf-bea738aa7a7f',
    name: 'AMI VL Woche 01',
    displayName: 'AMI Vorlesung - Woche 01',
    status: SessionStatus.PREPARED,
    blocks: [
      {
        questions: range(48, 52),
      },
      {
        questions: range(52, 55),
      },
      {
        questions: [55],
      },
      {
        questions: range(56, 60),
      },
    ],
  },
]

export const MICRO_SESSIONS = []
