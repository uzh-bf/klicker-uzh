import Prisma from '@klicker-uzh/prisma'
const { AttachmentType, QuestionType, SessionStatus, OrderType } = Prisma

export const LEARNING_ELEMENTS = [
  {
    id: '01c623df-0e73-4812-bef5-e3eb6c2d860e',
    name: 'BFII Modul 2',
    displayName: 'BFII Modul 2 - Lernfragen',
    description: '',
    orderType: OrderType.LAST_RESPONSE,
    stacks: [
      {
        elements: [421],
      },
      {
        displayName: 'Modul 2 - Bondpreis',
        description: `
Gegeben ist folgende Ausgangslage:

![](https://sos-ch-dk-2.exo.io/klicker-prod/excel/bf2/BF2_Modul2_Ausgangslage_Bondpreis.png)

[Excel-Vorlage herunterladen](https://sos-ch-dk-2.exo.io/klicker-prod/excel/bf2/BF2_Modul2_Bondpreis.xlsx)
        `,
        elements: [649],
      },
      {
        elements: [422],
      },
      {
        elements: [423],
      },
      {
        elements: [424],
      },
      {
        displayName: 'Modul 2 - Enterprise Value',
        description: `
Gegeben ist folgende Bilanz der Rason AG (in Mio. CHF):

![](https://sos-ch-dk-2.exo.io/klicker-prod/excel/bf2/BF2_Modul2_Ausgangslage_EV.png)

Die Rason AG hat 10 Mio. ausstehende Aktien und eine Aktie wird zum Preis von CHF 10 gehandelt.

Der Umsatz der Rason AG beträgt 150 Mio. CHF und der EV/Sales Multiple von Unternehmen aus der gleichen Branche beträgt 1.1x.

[Excel-Vorlage herunterladen](https://sos-ch-dk-2.exo.io/klicker-prod/excel/bf2/BF2_Modul2_EV.xlsx)
        `,
        elements: [650, 651],
      },
      {
        displayName: 'Modul 2 - Dividendenwachstumsmodell',
        description: `
Gegeben ist folgende Ausgangslage:

![](https://sos-ch-dk-2.exo.io/klicker-prod/excel/bf2/BF2_Modul2_Ausgangslage_Dividendenwachstumsmodell.png)

[Excel-Vorlage herunterladen](https://sos-ch-dk-2.exo.io/klicker-prod/excel/bf2/BF2_Modul2_Dividendenwachstumsmodell.xlsx)
        `,
        elements: [652],
      },
      {
        elements: [425],
      },
      {
        elements: [426],
      },
      {
        elements: [427],
      },
      {
        elements: [428],
      },
      {
        elements: [429],
      },
      {
        displayName: 'Modul 2 - Call-Option',
        description: `
Der Investor Felix kaufte vor einem Jahr europäische Call-Optionen auf die Schwyz-Aktie. Die Angaben dazu sind wie folgt:

![](https://sos-ch-dk-2.exo.io/klicker-prod/excel/bf2/BF2_Modul2_Ausgangslage_CallOption.png)

[Excel-Vorlage herunterladen](https://sos-ch-dk-2.exo.io/klicker-prod/excel/bf2/BF2_Modul2_CallOption.xlsx)
        `,
        elements: [653],
      },
    ],
  },
]
