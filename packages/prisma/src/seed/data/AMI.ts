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
Die Nutzenfunktion des Investors beträgt U=E(r)-$$\frac{A}{2}*SD^2$$, wobei A=4.0 ist.
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
