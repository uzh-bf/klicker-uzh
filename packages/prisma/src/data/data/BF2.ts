import Prisma from '../../client/index.js'
const { ElementType, SessionStatus, OrderType } = Prisma

export const LEARNING_ELEMENTS = [
  //   {
  //     id: '01c623df-0e73-4812-bef5-e3eb6c2d860e',
  //     name: 'BFII Modul 2',
  //     displayName: 'BFII Modul 2 - Lernfragen',
  //     description: '',
  //     orderType: OrderType.LAST_RESPONSE,
  //     stacks: [
  //       {
  //         elements: [421],
  //       },
  //       {
  //         displayName: 'Modul 2 - Bondpreis',
  //         description: `
  // Gegeben ist folgende Ausgangslage:
  // ![](https://sos-ch-dk-2.exo.io/klicker-prod/excel/bf2/BF2_Modul2_Ausgangslage_Bondpreis.png)
  // [Excel-Vorlage herunterladen](https://sos-ch-dk-2.exo.io/klicker-prod/excel/bf2/BF2_Modul2_Bondpreis.xlsx)
  //         `,
  //         elements: [649],
  //       },
  //       {
  //         elements: [422],
  //       },
  //       {
  //         elements: [423],
  //       },
  //       {
  //         elements: [424],
  //       },
  //       {
  //         displayName: 'Modul 2 - Enterprise Value',
  //         description: `
  // Gegeben ist folgende Bilanz der Rason AG (in Mio. CHF):
  // ![](https://sos-ch-dk-2.exo.io/klicker-prod/excel/bf2/BF2_Modul2_Ausgangslage_EV.png)
  // Die Rason AG hat 10 Mio. ausstehende Aktien und eine Aktie wird zum Preis von CHF 10 gehandelt.
  // Der Umsatz der Rason AG beträgt 150 Mio. CHF und der EV/Sales Multiple von Unternehmen aus der gleichen Branche beträgt 1.1x.
  // [Excel-Vorlage herunterladen](https://sos-ch-dk-2.exo.io/klicker-prod/excel/bf2/BF2_Modul2_EV.xlsx)
  //         `,
  //         elements: [650, 651],
  //       },
  //       {
  //         displayName: 'Modul 2 - Dividendenwachstumsmodell',
  //         description: `
  // Gegeben ist folgende Ausgangslage:
  // ![](https://sos-ch-dk-2.exo.io/klicker-prod/excel/bf2/BF2_Modul2_Ausgangslage_Dividendenwachstumsmodell.png)
  // [Excel-Vorlage herunterladen](https://sos-ch-dk-2.exo.io/klicker-prod/excel/bf2/BF2_Modul2_Dividendenwachstumsmodell.xlsx)
  //         `,
  //         elements: [652],
  //       },
  //       {
  //         elements: [425],
  //       },
  //       {
  //         elements: [426],
  //       },
  //       {
  //         elements: [427],
  //       },
  //       {
  //         elements: [428],
  //       },
  //       {
  //         elements: [429],
  //       },
  //       {
  //         displayName: 'Modul 2 - Call-Option',
  //         description: `
  // Der Investor Felix kaufte vor einem Jahr europäische Call-Optionen auf die Schwyz-Aktie. Die Angaben dazu sind wie folgt:
  // ![](https://sos-ch-dk-2.exo.io/klicker-prod/excel/bf2/BF2_Modul2_Ausgangslage_CallOption.png)
  // [Excel-Vorlage herunterladen](https://sos-ch-dk-2.exo.io/klicker-prod/excel/bf2/BF2_Modul2_CallOption.xlsx)
  //         `,
  //         elements: [653],
  //       },
  //     ],
  //   },
  // {
  //   id: '4d1a25d0-1696-4094-a9b4-165006b54871',
  //   name: 'BFII Modul 3',
  //   displayName: 'BFII Modul 3 - Lernfragen',
  //   description: '',
  //   orderType: OrderType.LAST_RESPONSE,
  //   stacks: [
  //     {
  //       displayName: 'Modul 3 - Kapitalgewinn- und Dividendenrendite',
  //       description: `
  // Gegeben ist folgende Ausgangslage:
  // ![](https://sos-ch-dk-2.exo.io/klicker-prod/excel/bf2/BF2_Modul3_Ausgangslage_Kapitalgewinnrendite.png)
  // [Excel-Vorlage herunterladen](https://sos-ch-dk-2.exo.io/klicker-prod/excel/bf2/BF2_Modul3_Kapitalgewinnrendite.xlsx)
  //         `,
  //       elements: [732, 733],
  //     },
  //     {
  //       displayName:
  //         'Modul 3 - Arithmetisches und geometrisches Mittel von Renditen',
  //       description: `
  // Gegeben ist folgende Ausgangslage:
  // ![](https://sos-ch-dk-2.exo.io/klicker-prod/excel/bf2/BF2_Modul3_Ausgangslage_Renditen.png)
  // [Excel-Vorlage herunterladen](https://sos-ch-dk-2.exo.io/klicker-prod/excel/bf2/BF2_Modul3_Renditen.xlsx)
  //         `,
  //       elements: [734, 735, 736],
  //     },
  //     {
  //       elements: [558],
  //     },
  //     {
  //       elements: [753],
  //     },
  //     {
  //       displayName: 'Modul 3 - Statistische Grössen',
  //       description: `
  // Gegeben ist folgende Ausgangslage:
  // ![](https://sos-ch-dk-2.exo.io/klicker-prod/excel/bf2/BF2_Modul3_Ausgangslage_Statistik.png)
  // [Excel-Vorlage herunterladen](https://sos-ch-dk-2.exo.io/klicker-prod/excel/bf2/BF2_Modul3_Statistik.xlsx)
  //         `,
  //       elements: [737, 738, 739, 740],
  //     },
  //     {
  //       elements: [559],
  //     },
  //     {
  //       elements: [560],
  //     },
  //     {
  //       displayName: 'Modul 3 - Portfoliorendite und -standardabweichung',
  //       description: `
  // Gegeben ist folgende Ausgangslage:
  // ![](https://sos-ch-dk-2.exo.io/klicker-prod/excel/bf2/BF2_Modul3_Ausgangslage_Portfoliorendite.png)
  // [Excel-Vorlage herunterladen](https://sos-ch-dk-2.exo.io/klicker-prod/excel/bf2/BF2_Modul3_Portfoliorendite.xlsx)
  //         `,
  //       elements: [741, 742],
  //     },
  //     {
  //       elements: [561],
  //     },
  //     {
  //       displayName: 'Modul 3 - Tangentialportfolio',
  //       description: `
  // Gegeben ist folgende Ausgangslage:
  // ![](https://sos-ch-dk-2.exo.io/klicker-prod/excel/bf2/BF2_Modul3_Ausgangslage_Tangentialportfolio.png)
  // [Excel-Vorlage herunterladen](https://sos-ch-dk-2.exo.io/klicker-prod/excel/bf2/BF2_Modul3_Tangentialportfolio.xlsx)
  //         `,
  //       elements: [743, 744],
  //     },
  //   ],
  // },
  // {
  //   id: '1e9cd20e-6c64-4776-abb6-9f05c39a4556',
  //   name: 'BFII Modul 4',
  //   displayName: 'BFII Modul 4 - Lernfragen',
  //   description: '',
  //   orderType: OrderType.LAST_RESPONSE,
  //   stacks: [
  //     {
  //       elements: [562],
  //     },
  //     {
  //       elements: [563],
  //     },
  //     {
  //       displayName: 'Modul 4 - Present Value',
  //       description: `
  // Gegeben ist folgende Ausgangslage:
  // ![](https://sos-ch-dk-2.exo.io/klicker-prod/excel/bf2/BF2_Modul4_Ausgangslage_Present%20Value.png)
  // [Excel-Vorlage herunterladen](https://sos-ch-dk-2.exo.io/klicker-prod/excel/bf2/BF2_Modul4_Present%20Value.xlsx)
  //         `,
  //       elements: [801, 802, 803],
  //     },
  //     {
  //       displayName: 'Modul 4 - Future Value I',
  //       description: `
  // Gegeben ist folgende Ausgangslage:
  // ![](https://sos-ch-dk-2.exo.io/klicker-prod/excel/bf2/BF2_Modul4_Ausgangslage_Future%20Value%20I.png)
  // [Excel-Vorlage herunterladen](https://sos-ch-dk-2.exo.io/klicker-prod/excel/bf2/BF2_Modul4_Future%20Value%20I.xlsx)
  //         `,
  //       elements: [805, 806, 807],
  //     },
  //     {
  //       elements: [808],
  //     },
  //     {
  //       elements: [564],
  //     },
  //     {
  //       elements: [566],
  //     },
  //     {
  //       elements: [567],
  //     },
  //     {
  //       elements: [568],
  //     },
  //     {
  //       elements: [569],
  //     },
  //     {
  //       elements: [570],
  //     },
  //     {
  //       elements: [571],
  //     },
  //     {
  //       displayName: 'Modul 4 - Duration',
  //       description: `
  // Gegeben ist folgende Ausgangslage:
  // ![](https://sos-ch-dk-2.exo.io/klicker-prod/excel/bf2/BF2_Modul4_Ausgangslage_Duration.png)
  // [Excel-Vorlage herunterladen](https://sos-ch-dk-2.exo.io/klicker-prod/excel/bf2/BF2_Modul4_Duration.xlsx)
  //         `,
  //       elements: [809, 810],
  //     },
  //   ],
  // },
  //   {
  //     id: 'c74a161b-d7e3-44b0-acc2-475e27975f31',
  //     name: 'BFII Modul 5',
  //     displayName: 'BFII Modul 5 - Lernfragen',
  //     description: '',
  //     orderType: OrderType.LAST_RESPONSE,
  //     stacks: [
  //       {
  //         elements: [572],
  //       },
  //       {
  //         elements: [573],
  //       },
  //       {
  //         elements: [574],
  //       },
  //       {
  //         displayName: 'Modul 5 - Replikationsmethode',
  //         description: `
  // Gegeben ist folgende Ausgangslage:
  // ![](https://sos-ch-dk-2.exo.io/klicker-prod/excel/bf2/BF2_Modul5_Ausgangslage_Replikationsmethode.png)
  // [Excel-Vorlage herunterladen](https://sos-ch-dk-2.exo.io/klicker-prod/excel/bf2/BF2_Modul5_Replikationsmethode.xlsx)
  //           `,
  //         elements: [850, 851, 852],
  //       },
  //       {
  //         displayName: 'Modul 5 - Risikoneutrale Bewertung',
  //         description: `
  // Gegeben ist folgende Ausgangslage:
  // ![](https://sos-ch-dk-2.exo.io/klicker-prod/excel/bf2/BF2_Modul5_Ausgangslage_Optionspreis.png)
  // [Excel-Vorlage herunterladen](https://sos-ch-dk-2.exo.io/klicker-prod/excel/bf2/BF2_Modul5_Optionspreis.xlsx)
  //           `,
  //         elements: [853, 854],
  //       },
  //     ],
  //   },
  {
    id: '9b241aef-98be-4ea9-a528-76a93d080ac6',
    name: 'BFII Repetition MC',
    displayName: 'BFII Repetition MC',
    description: '',
    orderType: OrderType.LAST_RESPONSE,
    stacks: [
      {
        elements: [414],
      },
      {
        elements: [415],
      },
      {
        elements: [416],
      },
      {
        elements: [417],
      },
      {
        elements: [418],
      },
      {
        elements: [419],
      },
      {
        elements: [420],
      },
      {
        elements: [421],
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
        elements: [558],
      },
      {
        elements: [753],
      },
      {
        elements: [559],
      },
      {
        elements: [560],
      },
      {
        elements: [561],
      },
      {
        elements: [562],
      },
      {
        elements: [563],
      },
      {
        elements: [564],
      },
      {
        elements: [566],
      },
      {
        elements: [567],
      },
      {
        elements: [568],
      },
      {
        elements: [569],
      },
      {
        elements: [570],
      },
      {
        elements: [571],
      },
      {
        elements: [572],
      },
      {
        elements: [573],
      },
      {
        elements: [574],
      },
    ],
  },
  {
    id: 'cfeaa0ea-fb70-4954-afe8-43d574a6038e',
    name: 'BFII Repetition Excel',
    displayName: 'BFII Repetition Excel',
    description: '',
    orderType: OrderType.LAST_RESPONSE,
    stacks: [
      {
        elements: [584],
      },
      {
        elements: [585],
      },
      {
        elements: [586],
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
        displayName: 'Modul 2 - Call-Option',
        description: `
Der Investor Felix kaufte vor einem Jahr europäische Call-Optionen auf die Schwyz-Aktie. Die Angaben dazu sind wie folgt:
![](https://sos-ch-dk-2.exo.io/klicker-prod/excel/bf2/BF2_Modul2_Ausgangslage_CallOption.png)
[Excel-Vorlage herunterladen](https://sos-ch-dk-2.exo.io/klicker-prod/excel/bf2/BF2_Modul2_CallOption.xlsx)
                `,
        elements: [653],
      },
      {
        displayName: 'Modul 3 - Kapitalgewinn- und Dividendenrendite',
        description: `
Gegeben ist folgende Ausgangslage:
![](https://sos-ch-dk-2.exo.io/klicker-prod/excel/bf2/BF2_Modul3_Ausgangslage_Kapitalgewinnrendite.png)
[Excel-Vorlage herunterladen](https://sos-ch-dk-2.exo.io/klicker-prod/excel/bf2/BF2_Modul3_Kapitalgewinnrendite.xlsx)
                  `,
        elements: [732, 733],
      },
      {
        displayName:
          'Modul 3 - Arithmetisches und geometrisches Mittel von Renditen',
        description: `
Gegeben ist folgende Ausgangslage:
![](https://sos-ch-dk-2.exo.io/klicker-prod/excel/bf2/BF2_Modul3_Ausgangslage_Renditen.png)
[Excel-Vorlage herunterladen](https://sos-ch-dk-2.exo.io/klicker-prod/excel/bf2/BF2_Modul3_Renditen.xlsx)
                  `,
        elements: [734, 735, 736],
      },
      {
        displayName: 'Modul 3 - Statistische Grössen',
        description: `
Gegeben ist folgende Ausgangslage:
![](https://sos-ch-dk-2.exo.io/klicker-prod/excel/bf2/BF2_Modul3_Ausgangslage_Statistik.png)
[Excel-Vorlage herunterladen](https://sos-ch-dk-2.exo.io/klicker-prod/excel/bf2/BF2_Modul3_Statistik.xlsx)
                  `,
        elements: [737, 738, 739, 740],
      },
      {
        displayName: 'Modul 3 - Portfoliorendite und -standardabweichung',
        description: `
Gegeben ist folgende Ausgangslage:
![](https://sos-ch-dk-2.exo.io/klicker-prod/excel/bf2/BF2_Modul3_Ausgangslage_Portfoliorendite.png)
[Excel-Vorlage herunterladen](https://sos-ch-dk-2.exo.io/klicker-prod/excel/bf2/BF2_Modul3_Portfoliorendite.xlsx)
                  `,
        elements: [741, 742],
      },
      {
        displayName: 'Modul 3 - Tangentialportfolio',
        description: `
Gegeben ist folgende Ausgangslage:
![](https://sos-ch-dk-2.exo.io/klicker-prod/excel/bf2/BF2_Modul3_Ausgangslage_Tangentialportfolio.png)
[Excel-Vorlage herunterladen](https://sos-ch-dk-2.exo.io/klicker-prod/excel/bf2/BF2_Modul3_Tangentialportfolio.xlsx)
                  `,
        elements: [743, 744],
      },
      {
        displayName: 'Modul 4 - Present Value',
        description: `
Gegeben ist folgende Ausgangslage:
![](https://sos-ch-dk-2.exo.io/klicker-prod/excel/bf2/BF2_Modul4_Ausgangslage_Present%20Value.png)
[Excel-Vorlage herunterladen](https://sos-ch-dk-2.exo.io/klicker-prod/excel/bf2/BF2_Modul4_Present%20Value.xlsx)
                    `,
        elements: [801, 802, 803],
      },
      {
        displayName: 'Modul 4 - Future Value I',
        description: `
Gegeben ist folgende Ausgangslage:
![](https://sos-ch-dk-2.exo.io/klicker-prod/excel/bf2/BF2_Modul4_Ausgangslage_Future%20Value%20I.png)
[Excel-Vorlage herunterladen](https://sos-ch-dk-2.exo.io/klicker-prod/excel/bf2/BF2_Modul4_Future%20Value%20I.xlsx)
                    `,
        elements: [805, 806, 807],
      },
      {
        elements: [808],
      },
      {
        displayName: 'Modul 4 - Duration',
        description: `
Gegeben ist folgende Ausgangslage:
![](https://sos-ch-dk-2.exo.io/klicker-prod/excel/bf2/BF2_Modul4_Ausgangslage_Duration.png)
[Excel-Vorlage herunterladen](https://sos-ch-dk-2.exo.io/klicker-prod/excel/bf2/BF2_Modul4_Duration.xlsx)
                    `,
        elements: [809, 810],
      },
      {
        displayName: 'Modul 5 - Replikationsmethode',
        description: `
Gegeben ist folgende Ausgangslage:
![](https://sos-ch-dk-2.exo.io/klicker-prod/excel/bf2/BF2_Modul5_Ausgangslage_Replikationsmethode.png)
[Excel-Vorlage herunterladen](https://sos-ch-dk-2.exo.io/klicker-prod/excel/bf2/BF2_Modul5_Replikationsmethode.xlsx)
            `,
        elements: [850, 851, 852],
      },
      {
        displayName: 'Modul 5 - Risikoneutrale Bewertung',
        description: `
Gegeben ist folgende Ausgangslage:
![](https://sos-ch-dk-2.exo.io/klicker-prod/excel/bf2/BF2_Modul5_Ausgangslage_Optionspreis.png)
[Excel-Vorlage herunterladen](https://sos-ch-dk-2.exo.io/klicker-prod/excel/bf2/BF2_Modul5_Optionspreis.xlsx)
            `,
        elements: [853, 854],
      },
    ],
  },
]
