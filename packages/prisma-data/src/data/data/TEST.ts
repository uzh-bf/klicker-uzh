import {
  AchievementType,
  ElementType,
  ObjectAccess,
  PublicationStatus,
} from '@klicker-uzh/prisma/client'
import { MISSING_CATALOG_COLLECTION_ID } from '@klicker-uzh/util'

export const PUBLIC_CATALOG_COLLECTION_ID =
  '64b6eb55-e76d-42bf-b382-5cff2f5bee74'
export const RESTRICTED_CATALOG_COLLECTION_ID =
  'a622e2fb-7e4c-4dca-83d1-f2f3e618029c'

export const ANSWER_COLLECTIONS = [
  {
    name: 'Collection 1 (Fruits)',
    description:
      'This collection contains questions about fruits. The description supports markdown syntax such as **bold** and *italic*.',
    entries: [
      { value: 'Apple' },
      { value: 'Banana' },
      { value: 'Cherry' },
      { value: 'Date' },
      { value: 'Elderberry' },
      { value: 'Fig' },
      { value: 'Grape' },
      { value: 'Honeydew' },
      { value: 'Kiwi' },
      { value: 'Lemon' },
      { value: 'Mango' },
      { value: 'Nectarine' },
      { value: 'Orange' },
      { value: 'Peach' },
      { value: 'Quince' },
      { value: 'Raspberry' },
      { value: 'Strawberry' },
      { value: 'Tangerine' },
      { value: 'Ugli' },
      { value: 'Vanilla' },
      { value: 'Watermelon' },
      { value: 'Ximenia' },
      { value: 'Yuzu' },
    ],
  },
  {
    name: 'Collection 2 (Vegetables)',
    description:
      'This collection contains questions about vegetables. The description supports markdown syntax such as **bold** and *italic*.',
    entries: [
      { value: 'Artichoke' },
      { value: 'Broccoli' },
      { value: 'Cabbage' },
      { value: 'Dill' },
      { value: 'Cucumber' },
      { value: 'Carrot' },
    ],
  },
  {
    name: 'Collection 3 (Animals)',
    description:
      'This collection contains questions about animals. The description supports markdown syntax such as **bold** and *italic*.',
    entries: [
      { value: 'Antelope' },
      { value: 'Bear' },
      { value: 'Cat' },
      { value: 'Dog' },
      { value: 'Elephant' },
      { value: 'Fox' },
    ],
  },
]

export const CATALOG_ASSIGNMENTS = [
  {
    answerCollectionName: ANSWER_COLLECTIONS[0]!.name,
    catalogCollectionId: MISSING_CATALOG_COLLECTION_ID,
    access: ObjectAccess.PUBLIC,
  },
  {
    answerCollectionName: ANSWER_COLLECTIONS[2]!.name,
    catalogCollectionId: MISSING_CATALOG_COLLECTION_ID,
    access: ObjectAccess.RESTRICTED,
  },
  {
    answerCollectionName: ANSWER_COLLECTIONS[0]!.name,
    catalogCollectionId: RESTRICTED_CATALOG_COLLECTION_ID,
    access: ObjectAccess.PUBLIC,
  },
  {
    answerCollectionName: ANSWER_COLLECTIONS[2]!.name,
    catalogCollectionId: RESTRICTED_CATALOG_COLLECTION_ID,
    access: ObjectAccess.RESTRICTED,
  },
  {
    answerCollectionName: ANSWER_COLLECTIONS[0]!.name,
    catalogCollectionId: PUBLIC_CATALOG_COLLECTION_ID,
    access: ObjectAccess.PUBLIC,
  },
  {
    answerCollectionName: ANSWER_COLLECTIONS[2]!.name,
    catalogCollectionId: PUBLIC_CATALOG_COLLECTION_ID,
    access: ObjectAccess.RESTRICTED,
  },
]

export const QUESTIONS = [
  {
    originalId: '0',
    name: 'Testfrage FREE_TEXT',
    content:
      'Beantworte mich korrekt, richtig, oder genau. Ansonsten bekommst du keine Punkte!',
    explanation: 'FT generische Erklärung, warum diese Frage richtig ist.',
    type: ElementType.FREE_TEXT,
    options: {
      hasSampleSolution: true,
      restrictions: {
        maxLength: 100,
      },
      solutions: ['korrekt', 'richtig', 'genau'],
    },
  },
  {
    originalId: '1',
    name: 'Testfrage MC',
    content: `## Understanding Financial Goals and Conflicts

In financial management, understanding the relationships between different financial goals is crucial for effective decision-making.

### The Financial Target Triangle
The classic financial target triangle consists of:
* **Profitability** - Generating returns on investments
* **Liquidity** - Ensuring sufficient cash flow
* **Security** - Minimizing financial risks

These goals often create conflicts that require careful balancing:

1. Higher profitability typically requires taking on more risk (reducing security)
2. Maintaining high liquidity usually reduces potential profitability
3. Increased security often comes at the cost of lower returns

The relationship between profitability and risk can be expressed as:

$$E(R_i) = R_f + \\beta_i [E(R_m) - R_f]$$

Where $E(R_i)$ represents the expected return, $R_f$ is the risk-free rate, and $\\beta_i$ is the asset's beta coefficient.

**Please select the correct statements about the financial target triangle below:**`,
    explanation: 'MC generische Erklärung, warum diese Frage richtig ist.',
    type: ElementType.MC,
    options: {
      hasSampleSolution: true,
      hasAnswerFeedbacks: true,
      displayMode: 'LIST',
    },
    choices: [
      {
        feedback:
          'Falsch! Zwischen den Zielsetzungen des klassischen finanziellen Zieldreiecks gibt es sowohl Zielkonflikte als auch Zielharmonien.',
        value:
          'Zwischen den Zielsetzungen des klassischen Zieldreiecks gibt es sowohl Zielkonflikte als auch Zielharmonien.',
      },
      {
        correct: true,
        feedback:
          'Korrekt! Je höher die angestrebte Sicherheit, desto weniger Risiko wird eingegangen, was wiederum die Rentabilität senkt.',
        value:
          'Das Ziel einer hohen Rentabilität erhöht auch die Sicherheit eines Unternehmens.',
      },
      {
        correct: true,
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
    originalId: '2',
    name: 'Testfrage NUMERICAL',
    content: 'Wie viel würdest du in Aktien anlegen? Beni mag 17%.',
    explanation: 'NR generische Erklärung, warum diese Frage richtig ist.',
    type: ElementType.NUMERICAL,
    options: {
      hasSampleSolution: true,
      accuracy: 2,
      unit: '%',
      restrictions: {
        min: -10,
        max: 100,
      },
      solutionRanges: [
        {
          min: undefined,
          max: 5,
        },
        {
          min: 10,
          max: 20,
        },
        {
          min: 95,
          max: undefined,
        },
      ],
    },
  },
  {
    originalId: '3',
    name: 'Multi-Faktor-Modell',
    content: `# Multi-Factor Models in Asset Pricing

## Background
Traditional asset pricing models like CAPM suggest that an asset's return can be explained by its correlation with the market. However, empirical evidence shows this is often insufficient.

### Evolution of Asset Pricing Models
Multi-factor models emerged to better explain asset returns by incorporating additional risk factors beyond market risk.

The most notable examples include:

1. **Fama-French Three-Factor Model**
   * Market risk premium
   * Size factor (SMB - Small Minus Big)
   * Value factor (HML - High Minus Low book-to-market ratio)

2. **Carhart Four-Factor Model**
   * Adds momentum factor to Fama-French model

The mathematical representation of the Fama-French model is:

$$R_i - R_f = \\alpha_i + \\beta_{i,m}(R_m - R_f) + \\beta_{i,s}SMB + \\beta_{i,h}HML + \\epsilon_i$$

Where $R_i$ is the return of asset i, $R_f$ is the risk-free rate, and the betas represent sensitivities to each factor.

**Select all correct statements about multi-factor models:**`,
    type: ElementType.KPRIM,
    options: {
      hasSampleSolution: true,
      hasAnswerFeedbacks: true,
      displayMode: 'LIST',
    },
    explanation: 'KPRIM generische Erklärung, warum diese Frage richtig ist.',
    choices: [
      {
        correct: true,
        feedback: 'Diese Aussage ist korrekt.',
        value:
          'HML- oder SMB-Faktoren messen möglicherweise Risiken, welche durch konjunkturelle Zyklen entstehen.',
      },
      {
        correct: true,
        feedback: 'Diese Aussage ist korrekt.',
        value:
          'Im Fama-French-Modell wird die Marktrisikoprämie um zwei weitere Faktoren, dem SMB-Faktor und dem HML-Faktor, ergänzt.',
      },
      {
        feedback:
          'Diese Aussage ist falsch. Das Carhart-Modell ist ein Vier-Faktoren-Modell. Zu den Fama-French Faktoren wird noch der Momentum-Faktor hinzugeführt.',
        value:
          'Das Carhart-Modell führt anstelle der Fama-French Faktoren den Momentum-Faktor hinzu.',
      },
      {
        correct: true,
        feedback: 'Diese Aussage ist korrekt.',
        value:
          'Zusätzliche Sensitivitätsfaktoren erklären die Schwankung der Aktienrenditen besser.',
      },
    ],
  },
  {
    originalId: '4',
    name: 'Modul 4 Business Cycle I',
    content:
      'Aktien von Unternehmen aus zyklischen Industriezweigen haben tendenziell Beta-Werte...',
    type: ElementType.SC,
    pointsMultiplier: 2,
    options: {
      hasSampleSolution: true,
      hasAnswerFeedbacks: true,
      displayMode: 'LIST',
    },
    explanation: 'SC generische Erklärung, warum diese Frage richtig ist.',
    choices: [
      {
        feedback: 'Falsch!',
        value: '... zwischen 0.0 und 1.0.',
      },
      {
        feedback: 'Falsch!',
        value: '... von etwa 0.0',
      },
      {
        feedback: 'Falsch!',
        value: '... von etwa 1.0.',
      },
      {
        feedback:
          'Korrekt! Aktien aus zyklischen Industrien sind tendenziell volatiler als der Gesamtmarkt und besitzen dementsprechend einen Betawert über 1.0.',
        correct: true,
        value: '... über 1.0.',
      },
      {
        feedback: 'Falsch!',
        value: 'Keine der genannten Aussagen ist richtig.',
      },
    ],
  },
  {
    originalId: '5',
    name: 'Testfrage NUMERICAL (Exact Solution)',
    content: `## Asset Allocation Strategy Decision

### Context
You are advising a client on their investment portfolio allocation. Based on their risk profile, time horizon, and financial goals, you need to recommend what percentage of their portfolio should be allocated to equities.

Consider the following factors:

* **Risk tolerance**: Your client is moderately risk-averse
* **Age**: The client is 45 years old
* **Investment horizon**: 20 years until retirement
* **Financial goals**: Growth with some stability

The traditional rule of thumb suggests:
$$ Equity\\_Percentage = 100 - Age $$

However, more sophisticated models consider additional factors and suggest specific allocation points.

According to research by our financial advisor Beni, the optimal allocation for this profile would be either:
* 0% (extremely conservative)
* 20% (moderately conservative)
* 100% (aggressive growth)

**What percentage would you recommend investing in equities?**`,
    explanation: 'Die korrekten Antworten sind 0%, 20% oder 100%.',
    type: ElementType.NUMERICAL,
    options: {
      hasSampleSolution: true,
      accuracy: 2,
      unit: '%',
      restrictions: {
        min: -10,
        max: 100,
      },
      exactSolutions: [0, 20, 100],
    },
  },
  {
    originalId: '6',
    name: 'Testfrage SELECTION',
    content: 'Which of the following animals are suited for a pet?',
    explanation: 'Bears, cats and dogs make sweet pets.',
    type: ElementType.SELECTION,
    options: {
      hasSampleSolution: true,
      numberOfInputs: 2,
    },
    collectionName: ANSWER_COLLECTIONS[2]!.name,
    answerCollectionItems: ['Bear', 'Cat', 'Dog'],
  },
  {
    originalId: '7',
    name: 'Testfrage CASE STUDY (without sample solution)',
    content:
      'Which fruits best mix into a fruit salad? You will be asked to assess different items based on tastiness and cost. The corresponding scenario, which should be considered during the assessment will be described in the separate cases',
    explanation:
      'All sample solutions should only be considered as subjective opinions, every taste is different.',
    type: ElementType.CASE_STUDY,
    options: {
      hasSampleSolution: false,
      cases: [
        {
          id: 'u6IgHeHsCzk00g1dXOTaI',
          order: 0,
          title: 'General Case',
          description:
            'In this case, you are asked to create the tastiest combination of available fruits. You do not have to consider any specific requirements.\n',
        },
        {
          id: 'WbUzlpHCxU2xnWfDrxhJ5',
          order: 1,
          title: 'Gourmet Case',
          description:
            'In addition to the previously described scenario, you are now asked to not only rate the elements, but also keep in mind how these assessments might be affected by being considered in a gourmet restaurant context.\n',
        },
      ],
      criteria: [
        {
          id: '2X4-oflktqmEw_XRezZzz',
          max: 10,
          min: 1,
          name: 'Tastiness',
          step: 1,
          order: 0,
        },
        {
          id: '7XQGlPsaizMq_CzBYmc54',
          max: 100,
          min: 1,
          name: 'Cost',
          step: 0.1,
          unit: 'CHF',
          order: 1,
        },
      ],
    },
    collectionName: ANSWER_COLLECTIONS[0]!.name,
    answerCollectionItems: ['Apple', 'Date', 'Grape', 'Mango'],
  },
  {
    originalId: '8',
    name: 'Testfrage CASE STUDY (with sample solution)',
    content: `# Fruit Salad Optimization Problem

## Introduction
Creating the perfect fruit salad requires balancing multiple factors including taste, cost, and compatibility between ingredients. Your task is to assess different fruits based on their properties to create an optimal fruit salad.

### Key Considerations
* **Tastiness** - How delicious is the fruit on its own?
* **Cost** - What is the price per unit?
* **Seasonal availability** - Is the fruit currently in season?
* **Texture combinations** - Do the textures complement each other?

## Assessment Criteria
For this exercise, you will focus on two primary metrics:
1. **Tastiness** - Rated on a scale from 1-10
2. **Cost** - Price in CHF, ranging from 1-100

The optimal combination will balance these factors differently depending on the specific case scenario.

$$Optimization = \\max\\left(\\frac{Tastiness}{Cost}\\right)$$

**Please assess each fruit according to the criteria for each scenario:**`,
    explanation:
      'All sample solutions should only be considered as subjective opinions, every taste is different.',
    type: ElementType.CASE_STUDY,
    options: {
      hasSampleSolution: true,
      cases: [
        {
          id: 'oNthfOWJfBbKGjU70MihG',
          order: 0,
          title: 'General Case',
          solutions: [
            {
              item: 'Apple', // to be replaced with itemId
              criteriaSolutions: [
                { max: 7, min: 3, criterionId: 'YDnUOgvbi_YhEkZ3MM2DY' },
                { max: 4, min: 2, criterionId: 'MBu5NrfoYZGD-DCMoaNwL' },
              ],
            },
            {
              item: 'Date', // to be replaced with itemId
              criteriaSolutions: [
                { max: 8, min: 6, criterionId: 'YDnUOgvbi_YhEkZ3MM2DY' },
                { max: 20, min: 5, criterionId: 'MBu5NrfoYZGD-DCMoaNwL' },
              ],
            },
            {
              item: 'Grape', // to be replaced with itemId
              criteriaSolutions: [
                { max: 7, min: 4, criterionId: 'YDnUOgvbi_YhEkZ3MM2DY' },
                { max: 7, min: 3, criterionId: 'MBu5NrfoYZGD-DCMoaNwL' },
              ],
            },
            {
              item: 'Mango', // to be replaced with itemId
              criteriaSolutions: [
                { max: 8, min: 4, criterionId: 'YDnUOgvbi_YhEkZ3MM2DY' },
                { max: 30, min: 5, criterionId: 'MBu5NrfoYZGD-DCMoaNwL' },
              ],
            },
          ],
          description: `## Standard Fruit Salad Context

### Background
You are preparing a fruit salad for a casual family gathering. The fruit salad should appeal to a wide range of tastes while being cost-effective.

### Considerations
* **Audience**: General family members of all ages
* **Budget**: Moderate, keeping costs reasonable
* **Preparation time**: Limited, simpler fruits are advantageous

The primary goal is to maximize enjoyment while maintaining reasonable costs. The tastiness-to-cost ratio can be modeled by:

$$Value = \\frac{Tastiness}{Cost}$$

For a typical family setting, a balanced approach is recommended where:
* Fruits with tastiness ratings of 5-7 are generally sufficient
* Cost should be kept below 50 CHF total

Please rate each fruit considering these everyday circumstances.`,
        },
        {
          id: 'FCnD8rvbi_CjEkEfMM2FP',
          order: 1,
          title: 'Gourmet Case',
          solutions: [
            {
              item: 'Apple', // to be replaced with itemId
              criteriaSolutions: [
                { max: 10, min: 5, criterionId: 'YDnUOgvbi_YhEkZ3MM2DY' },
                { max: 4, min: 2, criterionId: 'MBu5NrfoYZGD-DCMoaNwL' },
              ],
            },
            {
              item: 'Date', // to be replaced with itemId
              criteriaSolutions: [
                { max: 9, min: 8, criterionId: 'YDnUOgvbi_YhEkZ3MM2DY' },
                { max: 30, min: 10, criterionId: 'MBu5NrfoYZGD-DCMoaNwL' },
              ],
            },
            {
              item: 'Grape', // to be replaced with itemId
              criteriaSolutions: [
                { max: 4, min: 3, criterionId: 'YDnUOgvbi_YhEkZ3MM2DY' },
                { max: 7, min: 3, criterionId: 'MBu5NrfoYZGD-DCMoaNwL' },
              ],
            },
            {
              item: 'Mango', // to be replaced with itemId
              criteriaSolutions: [
                { max: 6, min: 2, criterionId: 'YDnUOgvbi_YhEkZ3MM2DY' },
                { max: 50, min: 25, criterionId: 'MBu5NrfoYZGD-DCMoaNwL' },
              ],
            },
          ],
          description: `# Gourmet Restaurant Context

## Culinary Excellence Requirements
In a high-end restaurant setting, fruit selection criteria shift dramatically toward exceptional quality and presentation. The ordinary becomes extraordinary through:

* **Visual appeal** - Color contrast and aesthetic arrangement
* **Textural harmony** - Complementary mouthfeel combinations
* **Flavor complexity** - Subtle notes and flavor development

### Restaurant Economics
Premium dining establishments operate under different economic constraints:
1. Higher price points allow for more expensive ingredients
2. Quality consistency is paramount
3. Uniqueness provides competitive advantage

The value equation in this context shifts to:

$$GourmetValue = Tastiness^2 \\times \\sqrt{Presentation} \\times (1+Uniqueness)$$

> "In fine dining, we don't merely serve food; we craft experiences that engage all senses."
> — *Chef Jean-Pierre Blanc*

**Your task**: Evaluate each fruit as if preparing a signature dessert for a Michelin-starred restaurant, where cost is less important than delivering an exceptional culinary experience.`,
        },
      ],
      criteria: [
        {
          id: 'YDnUOgvbi_YhEkZ3MM2DY',
          max: 10,
          min: 1,
          name: 'Tastiness',
          step: 1,
          order: 0,
        },
        {
          id: 'MBu5NrfoYZGD-DCMoaNwL',
          max: 100,
          min: 1,
          name: 'Cost',
          step: 0.1,
          unit: 'CHF',
          order: 1,
        },
      ],
    },
    collectionName: ANSWER_COLLECTIONS[0]!.name,
    answerCollectionItems: ['Apple', 'Date', 'Grape', 'Mango'],
  },
  {
    originalId: '9',
    name: 'Testfrage CASE STUDY (single criterion, 3 cases & sample solution)',
    content:
      'Which fruits best mix into a fruit salad? You will be asked to assess different items based on tastiness. The corresponding scenario, which should be considered during the assessment will be described in the separate cases.',
    explanation:
      'All sample solutions should only be considered as subjective opinions, every taste is different.',
    type: ElementType.CASE_STUDY,
    options: {
      hasSampleSolution: true,
      cases: [
        {
          id: 'ul0GA4e_00',
          order: 0,
          title: 'General Case',
          solutions: [
            {
              item: 'Apple', // to be replaced with itemId
              criteriaSolutions: [
                { max: 7, min: 3, criterionId: 'HHRO0raJuc' },
              ],
            },
            {
              item: 'Date', // to be replaced with itemId
              criteriaSolutions: [
                { max: 8, min: 6, criterionId: 'HHRO0raJuc' },
              ],
            },
            {
              item: 'Grape', // to be replaced with itemId
              criteriaSolutions: [
                { max: 7, min: 4, criterionId: 'HHRO0raJuc' },
              ],
            },
            {
              item: 'Mango', // to be replaced with itemId
              criteriaSolutions: [
                { max: 8, min: 4, criterionId: 'HHRO0raJuc' },
              ],
            },
          ],
          description:
            'In this case, you are asked to create the tastiest combination of available fruits. You do not have to consider any specific requirements.\n',
        },
        {
          id: 'LWhNmJskXb',
          order: 1,
          title: 'Gourmet Case',
          solutions: [
            {
              item: 'Apple', // to be replaced with itemId
              criteriaSolutions: [
                { max: 10, min: 5, criterionId: 'HHRO0raJuc' },
              ],
            },
            {
              item: 'Date', // to be replaced with itemId
              criteriaSolutions: [
                { max: 9, min: 8, criterionId: 'HHRO0raJuc' },
              ],
            },
            {
              item: 'Grape', // to be replaced with itemId
              criteriaSolutions: [
                { max: 4, min: 3, criterionId: 'HHRO0raJuc' },
              ],
            },
            {
              item: 'Mango', // to be replaced with itemId
              criteriaSolutions: [
                { max: 9, min: 5, criterionId: 'HHRO0raJuc' },
              ],
            },
          ],
          description:
            'In addition to the previously described scenario, you are now asked to not only rate the elements, but also keep in mind how these assessments might be affected by being considered in a gourmet restaurant context.\n',
        },
        {
          id: '7MrczE4ABS',
          order: 1,
          title: 'Connaisseur Case',
          solutions: [
            {
              item: 'Apple', // to be replaced with itemId
              criteriaSolutions: [
                { max: 10, min: 6, criterionId: 'HHRO0raJuc' },
              ],
            },
            {
              item: 'Date', // to be replaced with itemId
              criteriaSolutions: [
                { max: 8, min: 7, criterionId: 'HHRO0raJuc' },
              ],
            },
            {
              item: 'Grape', // to be replaced with itemId
              criteriaSolutions: [
                { max: 5, min: 4, criterionId: 'HHRO0raJuc' },
              ],
            },
            {
              item: 'Mango', // to be replaced with itemId
              criteriaSolutions: [
                { max: 7, min: 3, criterionId: 'HHRO0raJuc' },
              ],
            },
          ],
          description:
            'In this case, you are asked to create the tastiest combination of available fruits. You do not have to consider any specific requirements.\n',
        },
      ],
      criteria: [
        {
          id: 'HHRO0raJuc',
          max: 10,
          min: 1,
          name: 'Tastiness',
          step: 1,
          order: 0,
        },
      ],
    },
    collectionName: ANSWER_COLLECTIONS[0]!.name,
    answerCollectionItems: ['Apple', 'Date', 'Grape', 'Mango'],
  },
  {
    originalId: '10',
    name: 'Testfrage CASE STUDY (single criterion, single case & sample solution)',
    content:
      'Which fruits best mix into a fruit salad? You will be asked to assess different items based on tastiness. The corresponding scenario, which should be considered during the assessment will be described in the separate cases.',
    explanation:
      'All sample solutions should only be considered as subjective opinions, every taste is different.',
    type: ElementType.CASE_STUDY,
    options: {
      hasSampleSolution: true,
      cases: [
        {
          id: 'Vp1UJsdGbN',
          order: 0,
          title: 'General Case',
          solutions: [
            {
              item: 'Apple', // to be replaced with itemId
              criteriaSolutions: [
                { max: 7, min: 3, criterionId: 'F2lbLOXNyD' },
              ],
            },
            {
              item: 'Date', // to be replaced with itemId
              criteriaSolutions: [
                { max: 8, min: 6, criterionId: 'F2lbLOXNyD' },
              ],
            },
          ],
          description:
            'In this case, you are asked to create the tastiest combination of available fruits. You do not have to consider any specific requirements.\n',
        },
      ],
      criteria: [
        {
          id: 'F2lbLOXNyD',
          max: 10,
          min: 1,
          name: 'Tastiness',
          step: 1,
          order: 0,
        },
      ],
    },
    collectionName: ANSWER_COLLECTIONS[0]!.name,
    answerCollectionItems: ['Apple', 'Date'],
  },
  {
    originalId: '11',
    name: 'Testfrage FREE_TEXT (Finance)',
    content:
      'Describe the role of portfolio diversification in your own words.',
    explanation: 'FT generische Erklärung, warum diese Frage richtig ist.',
    type: ElementType.FREE_TEXT,
    options: {
      hasSampleSolution: true,
      restrictions: {
        maxLength: 500,
      },
      solutions: [
        'diversification',
        'portfolio risk',
        'asset allocation',
        'correlation',
        'expected return',
        'volatility',
        'systematic risk',
        'idiosyncratic risk',
        'risk-adjusted return',
        'rebalancing',
      ],
    },
  },
]

// uncomment question ids with anonymous responses
export type QUESTION_ID_TYPE =
  // | '1'
  // | '2'
  // | '3'
  // | '4'
  | '5'
  // | '6'
  // | '7'
  // | '8'
  // | '9'
  // | '10'
  | '11'

export const LIVE_QUIZZES = [
  {
    id: '1ec093e0-b6b6-421f-98ac-98ab146505f7',
    name: 'Test mit Multiplier',
    displayName: 'Test mit Multiplier',
    description: 'Test description for test quiz with multiplier.',
    isGamificationEnabled: true,
    isAssessmentEnabled: false,
    pointsMultiplier: 2,
    blocks: [
      {
        questions: [2, 4],
        timeLimit: undefined,
      },
      {
        questions: [4, 2],
        timeLimit: undefined,
      },
    ],
  },
  {
    id: '35aad5d9-285d-4dda-9e19-7507ee16e9e1',
    name: 'Test Live Quiz',
    displayName: 'Test Live Quiz',
    isModerationEnabled: false,
    isLiveQAEnabled: true,
    isConfusionFeedbackEnabled: true,
    isGamificationEnabled: true,
    isAssessmentEnabled: false,
    status: PublicationStatus.DRAFT,
    defaultPoints: 50,
    defaultCorrectPoints: 100,
    maxBonusPoints: 100,
    timeToZeroBonus: 200,
    blocks: [
      {
        questions: [0, 1, 2, 3, 4, 5, 6, 7, 8],
        timeLimit: undefined,
      },
      {
        questions: [0, 1, 2, 3, 4, 5, 6, 7, 8],
        timeLimit: undefined,
      },
    ],
  },
  {
    id: 'ef1b2304-6b61-4eb0-98e0-b3fb8105ba2a',
    name: 'Live Quiz Template',
    displayName: 'Live Quiz Template',
    isModerationEnabled: false,
    isLiveQAEnabled: true,
    isConfusionFeedbackEnabled: true,
    isGamificationEnabled: true,
    isAssessmentEnabled: false,
    status: PublicationStatus.TEMPLATE,
    defaultPoints: 50,
    defaultCorrectPoints: 100,
    maxBonusPoints: 100,
    timeToZeroBonus: 200,
    blocks: [
      {
        questions: [0, 1, 2, 3, 4, 5, 6, 7, 8],
        timeLimit: undefined,
      },
      {
        questions: [0, 1, 2, 3, 4, 5, 6, 7, 8],
        timeLimit: 200,
      },
    ],
    template: {
      description:
        'General description of the template, that can be shown as an information to the user.',
      instructions:
        'General instructions of the template, how to use it and what reasoning is behind the composition.',
      answerCollections: QUESTIONS.reduce<string[]>((acc, question) => {
        if (question.collectionName && !acc.includes(question.collectionName)) {
          acc.push(question.collectionName)
        }
        return acc
      }, []),
      answerCollectionItems: QUESTIONS.reduce<string[]>((acc, question) => {
        if (question.answerCollectionItems) {
          question.answerCollectionItems.forEach((item) => {
            if (!acc.includes(item)) {
              acc.push(item)
            }
          })
        }
        return acc
      }, []),
    },
  },
  {
    id: '20325ec6-0ce7-4e24-bd79-5c1a46f64c47',
    name: 'Test Live Quiz 2',
    displayName: 'Test Live Quiz 2',
    isModerationEnabled: false,
    isLiveQAEnabled: true,
    isConfusionFeedbackEnabled: true,
    isGamificationEnabled: true,
    isAssessmentEnabled: false,
    status: PublicationStatus.SCHEDULED,
    availableFrom: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days in the future
    blocks: [
      {
        questions: [0, 1, 2, 3, 4, 5, 6, 7, 8],
        timeLimit: undefined,
      },
      {
        questions: [0, 1, 2, 3, 4, 5, 6, 7, 8],
        timeLimit: 30,
      },
    ],
  },
  {
    id: '166608f3-10b6-4e62-9842-ab8b774fae58',
    name: 'Test Live Quiz 3',
    displayName: 'Test Live Quiz 3',
    isModerationEnabled: false,
    isLiveQAEnabled: true,
    isConfusionFeedbackEnabled: true,
    isGamificationEnabled: true,
    isAssessmentEnabled: false,
    status: PublicationStatus.DRAFT,
    blocks: [
      {
        questions: [4],
        timeLimit: 30,
      },
      {
        questions: [4],
        timeLimit: 30,
      },
      {
        questions: [4],
        timeLimit: 30,
      },
      {
        questions: [4],
        timeLimit: 30,
      },
      {
        questions: [4],
        timeLimit: 30,
      },
    ],
  },
  {
    id: 'a9e6f3c1-2d1e-4f0b-8f4b-5c6e7d8f9a0b',
    name: 'Test Live Quiz (Wordcloud)',
    displayName: 'Test Live Quiz (Wordcloud)',
    isModerationEnabled: true,
    isLiveQAEnabled: true,
    isConfusionFeedbackEnabled: true,
    isGamificationEnabled: true,
    isAssessmentEnabled: false,
    status: PublicationStatus.ENDED,
    blocks: [
      {
        questions: [5, 11],
        timeLimit: undefined,
      },
    ],
    anonymousResults: {
      '11': {
        total: 30,
        responses: {
          // topic related texts (mostly correct)
          '8b4fc0755c2c002245255d951e6ff742': {
            count: 1,
            value:
              'Portfolio diversification means spreading investments across different assets, sectors, or regions to reduce exposure to any single source of risk. It can lower idiosyncratic risk because losses in one holding may be offset by gains in another. The benefit depends strongly on correlations between assets.',
            correct: true,
          },
          c4ca4238a0b923820dcc509a6f75849b: {
            count: 1,
            value:
              'Diversification does not guarantee a profit, but it helps manage portfolio volatility. Combining equities, bonds, cash, and alternative assets can produce a smoother return path than holding only one security. Investors still remain exposed to broad market or systematic risk.',
            correct: true,
          },
          c81e728d9d4c2f636f067f89cc14862c: {
            count: 1,
            value:
              'Diversification means putting all available capital into the stock with the highest recent return. Concentrating in one winner removes risk because strong past performance reliably predicts future gains. Rebalancing is unnecessary once the best asset has been selected.',
            correct: false,
          },
          eccbc87e4b5ce2fe28308fd9f2a7baf3: {
            count: 1,
            value:
              'The key idea is that assets with imperfect correlation do not move exactly together. A portfolio can therefore achieve a better risk-return tradeoff than its individual components alone. This is why asset allocation is central to modern portfolio theory.',
            correct: true,
          },
          a87ff679a2f3e71d9181a67b7542122c: {
            count: 1,
            value:
              'Investors diversify by holding instruments with different risk drivers, such as government bonds, corporate credit, broad equity indexes, and foreign assets. The portfolio should be reviewed over time because market movements change target weights. Rebalancing can restore the intended risk profile.',
            correct: true,
          },
          e4da3b7fbbce3765c8a6f2cfa1b3f3: {
            count: 1,
            value:
              'Diversification eliminates every type of financial risk, including inflation, recession, interest-rate shocks, and market crashes. A diversified portfolio therefore cannot lose money. The expected return is always higher than the return of every individual asset.',
            correct: false,
          },
          '1679091c5a880faf6fb5e6087eb1b2dc': {
            count: 1,
            value:
              'A well-diversified portfolio reduces company-specific or sector-specific shocks. For example, a decline in one industry may have less impact when the investor also holds assets from other industries and regions. The remaining risk is mainly the market-wide component that cannot be diversified away.',
            correct: true,
          },
          '8f14e45fceea167a5a36dedd4bea2543': {
            count: 1,
            value:
              'Diversification should be connected to the investor goals, horizon, liquidity needs, and risk tolerance. A short-term investor may hold more cash or bonds, while a long-term investor may accept more equity volatility. The right mix is therefore context dependent.',
            correct: true,
          },
          c9f0f895fb98ab9159f51fd0297e236d: {
            count: 1,
            value:
              'Portfolio diversification is mainly an accounting rule for calculating taxes on dividends. It is unrelated to risk, correlation, or asset allocation. Investors use it only to decide which brokerage statement should be filed first.',
            correct: false,
          },
          d3d9446802a44259755d38e6d163e820: {
            count: 1,
            value:
              'Diversification can be implemented with individual securities, mutual funds, or exchange-traded funds. Broad index funds are a simple way to gain exposure to many firms at low cost. However, investors should still monitor fees, concentration, and currency exposure.',
            correct: true,
          },
          // random texts (all incorrect)
          b1d9446802a44259755d38e6d163e820: {
            count: 1,
            value:
              'The curious fox jumped quickly over silent hills before dawn.',
            correct: false,
          },
          a87ff679a2f3e7b1d9446802a4425975: {
            count: 1,
            value:
              'Bright stars shimmered softly above the calm sea at midnight.',
            correct: false,
          },
          e4da3b7fbbce3765c8a6f2cfa1b3f3a3: {
            count: 1,
            value:
              'A gentle breeze carried laughter through the quiet summer evening.',
            correct: false,
          },
          '7c6a180b36896a0a8c02787eeafb0e4c': {
            count: 1,
            value:
              'Children built sandcastles while waves danced along the golden shore.',
            correct: false,
          },
          '45c48cce2e2d7fbdea1afc51c7c6ad26': {
            count: 1,
            value:
              'An old clock ticked steadily inside the dimly lit wooden cabin.',
            correct: false,
          },
          '6512bd43d9caa6e02c990b0a82652dca': {
            count: 1,
            value:
              'Raindrops tapped gently against the windowpane as thunder rolled faintly.',
            correct: false,
          },
          '98f13708210194c475687be6106a3b84': {
            count: 1,
            value:
              'A paper airplane drifted across the room and landed perfectly upright.',
            correct: false,
          },
          '8277e0910d750195b448797616e091ad': {
            count: 1,
            value:
              'Snowflakes settled quietly on the railing outside the old mountain house.',
            correct: false,
          },
          e1671797c52e15f763380b45e841ec32: {
            count: 1,
            value:
              'Lanterns illuminated the narrow street as music echoed from afar.',
            correct: false,
          },
          aab3238922bcc25a6f606eb525ffdc56: {
            count: 1,
            value:
              'The cat watched carefully while the candle flame flickered in silence.',
            correct: false,
          },
          '9bf31c7ff062936a96d3c8bd1f8f2ff3': {
            count: 1,
            value:
              'Fog wrapped the forest trees in silver mist and muted sound.',
            correct: false,
          },
          c20ad4d76fe97759aa27a0c99bff6710: {
            count: 1,
            value:
              'Morning sunlight spilled softly through the curtains onto the wooden floor.',
            correct: false,
          },
          c51ce410c124a10e0db5e4b97fc2af39: {
            count: 1,
            value:
              'An artist painted dreams with colors borrowed from twilight and dawn.',
            correct: false,
          },
          aab3b5de3de36c9e1b1a0afcbbcbf0a1: {
            count: 1,
            value:
              'Travelers rested beside the campfire as stars shimmered high above.',
            correct: false,
          },
          '7b61d2313db5cbe1c59ab9c29d8b6aaf': {
            count: 1,
            value:
              'The library smelled of old paper, ink, and whispered forgotten stories.',
            correct: false,
          },
          c0cb5f0fcf2c30b28e08c706f52f8d85: {
            count: 1,
            value:
              'A silver key glinted under the moonlight near the quiet garden gate.',
            correct: false,
          },
          '70efdf2ec9b086079795c442636b55fb': {
            count: 1,
            value:
              'Birds gathered on telephone wires waiting for the morning sun to rise.',
            correct: false,
          },
          '6f4922f45568161a8cdf4ad2299f6d23': {
            count: 1,
            value:
              'The violinist played softly while raindrops pattered gently on cobblestones.',
            correct: false,
          },
          '1f0e3dad99908345f7439f8ffabdffc4': {
            count: 1,
            value:
              'Candles flickered beside photographs that told stories of distant travels.',
            correct: false,
          },
          '92debb6b5e70c378336763e26db8590c': {
            count: 1,
            value:
              'Leaves rustled quietly as twilight descended upon the sleeping village.',
            correct: false,
          },
        },
      },
      '5': {
        total: 8,
        responses: {
          '98f13708210194c475687be6106a3b84': {
            count: 2,
            value: '20',
            correct: true,
          },
          c4ca4238a0b923820dcc509a6f75849b: {
            count: 1,
            value: '1',
            correct: false,
          },
          d3d9446802a44259755d38e6d163e820: {
            count: 1,
            value: '10',
            correct: false,
          },
          '8e296a067a37563370ded05f5a3bf3ec': {
            count: 1,
            value: '25',
            correct: false,
          },
          a5bfc9e07964f8dddeb95fc584cd965d: {
            count: 1,
            value: '37',
            correct: false,
          },
          cf3e481a44141cabd4e9d46cfbb1f899: {
            count: 1,
            value: '12.5',
            correct: false,
          },
          f899139df5e1059396431415e770c6dd: {
            count: 1,
            value: '100',
            correct: true,
          },
        },
      },
    },
  },
]

export enum AchievementIds {
  Explorer = 2,
  'Busy Bee' = 3,
  Champion = 5,
  'Vice-Champion' = 6,
  'Vice-Vice-Champion' = 7,
  'Dream Team' = 8,
  'Team Spirit' = 9,
  'Fearless' = 10,
  'Creative Mastermind' = 11,
  Entertainer = 12,
  'Future Proof' = 13,
  Happiness = 14,
  'Presentation Wizard' = 15,
  'Shooting Star' = 16,
  Speedy = 17,
}

// import the questions from below and add them to the array
export const Achievements: {
  id: number
  nameDE: string
  nameEN: string
  descriptionDE: string
  descriptionEN: string
  icon: string
  type: AchievementType
  rewardedPoints?: number
  rewardedXP?: number
}[] = [
  // pilot achievement
  {
    id: AchievementIds.Explorer,
    nameDE: 'Explorer',
    nameEN: 'Explorer',
    descriptionDE:
      'Du warst Teil des KlickerUZH im ersten Semester. Dankeschön!',
    descriptionEN:
      'You were part of KlickerUZH in the first semester. Thank you!',
    icon: '/achievements/Erkunden.svg',
    type: 'PARTICIPANT',
  },
  // solved everything achievement
  {
    id: AchievementIds['Busy Bee'],
    nameDE: 'Busy Bee',
    nameEN: 'Busy Bee',
    descriptionDE:
      'Du hast alle verfügbaren Microlearnings und Übungs-Quizzes gelöst.',
    descriptionEN:
      'You have solved all available microlearnings and practice quizzes.',
    icon: '/achievements/Fleisspreis.svg',
    type: 'PARTICIPANT',
  },
  // gold medal achievement
  {
    id: AchievementIds.Champion,
    nameDE: 'Champion',
    nameEN: 'Champion',
    descriptionDE: 'Du hast einen ersten Platz in einer Live Quiz erreicht.',
    descriptionEN: 'You have reached first place in a live quiz.',
    icon: '/achievements/Champ.svg',
    rewardedPoints: 100,
    rewardedXP: 200,
    type: 'PARTICIPANT',
  },
  // silver medal achievement
  {
    id: AchievementIds['Vice-Champion'],
    nameDE: 'Vize-Champion',
    nameEN: 'Vice-Champion',
    descriptionDE: 'Du hast einen zweiten Platz in einer Live Quiz erreicht.',
    descriptionEN: 'You have reached second place in a live quiz.',
    icon: '/achievements/VizeChamp.svg',
    rewardedPoints: 50,
    rewardedXP: 100,
    type: 'PARTICIPANT',
  },
  // bronze medal achievement
  {
    id: AchievementIds['Vice-Vice-Champion'],
    nameDE: 'Vize-Vize-Champion',
    nameEN: 'Vice-Vice-Champion',
    descriptionDE: 'Du hast einen dritten Platz in einer Live Quiz erreicht.',
    descriptionEN: 'You have reached third place in a live quiz.',
    icon: '/achievements/VizevizeChamp.svg',
    rewardedPoints: 25,
    rewardedXP: 50,
    type: 'PARTICIPANT',
  },
  // TODO: re-introduce this price
  // last place achievement
  // {
  //   id: 4,
  //   nameDE: 'Trostpreis',
  //   nameEN: 'Consolation Prize',
  //   descriptionDE: 'Dabei sein ist alles (letzer Platz in einer Live Quiz).',
  //   descriptionEN: 'Being there is everything (last place in a live quiz).',
  //   icon: '/achievements/Trostpreis.svg',
  //   type: 'PARTICIPANT',
  // },
  // group task passed achievement
  {
    id: AchievementIds['Dream Team'],
    nameDE: 'Dream Team',
    nameEN: 'Dream Team',
    descriptionDE:
      'Du hast im Gruppentask über die Hälfte der Punkte erreicht.',
    descriptionEN:
      'You have reached more than half of the points in the group task.',
    icon: '/achievements/Dreamteam.svg',
    rewardedPoints: 500,
    rewardedXP: 500,
    type: 'PARTICIPANT',
  },
  // group task done achievement
  {
    id: AchievementIds['Team Spirit'],
    nameDE: 'Teamgeist',
    nameEN: 'Team Spirit',
    descriptionDE: 'Du hast einen Gruppentask absolviert.',
    descriptionEN: 'You have completed a group task.',
    icon: '/achievements/Teamgeist.svg',
    rewardedPoints: 0,
    rewardedXP: 100,
    type: 'PARTICIPANT',
  },
  // few questions achievement
  {
    id: AchievementIds.Fearless,
    nameDE: 'Unerschrocken',
    nameEN: 'Fearless',
    descriptionDE:
      'Du hast eine Woche vor Ende der Vorlesung noch keine 6 Fragen beantwortet.',
    descriptionEN:
      'You have not answered 6 questions yet one week before the end of the lecture.',
    icon: '/achievements/Unerschrocken.svg',
    type: 'PARTICIPANT',
  },
  // creative achievement
  {
    id: AchievementIds['Creative Mastermind'],
    nameDE: 'Creative Mastermind',
    nameEN: 'Creative Mastermind',
    descriptionDE: 'Du hast ein eigenes Übungs-Quizzes erstellt.',
    descriptionEN: 'You have created your own practice quiz.',
    icon: '/achievements/CreativeMastermind.svg',
    type: 'PARTICIPANT',
  },
  // entertainer achievement
  {
    id: AchievementIds.Entertainer,
    nameDE: 'Entertainer',
    nameEN: 'Entertainer',
    descriptionDE: '',
    descriptionEN: '',
    icon: '/achievements/Entertainer.svg',
    type: 'PARTICIPANT',
  },
  // future proof achievement
  {
    id: AchievementIds['Future Proof'],
    nameDE: 'Future Proof',
    nameEN: 'Future Proof',
    descriptionDE: '',
    descriptionEN: '',
    icon: '/achievements/FutureProof.svg',
    type: 'PARTICIPANT',
  },
  // happiness achievement
  {
    id: AchievementIds.Happiness,
    nameDE: 'Happiness',
    nameEN: 'Happiness',
    descriptionDE: '',
    descriptionEN: '',
    icon: '/achievements/Happiness.svg',
    type: 'PARTICIPANT',
  },
  // presentation achievement
  {
    id: AchievementIds['Presentation Wizard'],
    nameDE: 'Presentation Wizard',
    nameEN: 'Presentation Wizard',
    descriptionDE: '',
    descriptionEN: '',
    icon: '/achievements/PresentationWizard.svg',
    type: 'PARTICIPANT',
  },
  // shooting star achievement
  {
    id: AchievementIds['Shooting Star'],
    nameDE: 'Shooting Star',
    nameEN: 'Shooting Star',
    descriptionDE: '',
    descriptionEN: '',
    icon: '/achievements/Shootingstar.svg',
    type: 'PARTICIPANT',
  },
  // speedy achievement
  {
    id: AchievementIds.Speedy,
    nameDE: 'Speedy',
    nameEN: 'Speedy',
    descriptionDE: '',
    descriptionEN: '',
    icon: '/achievements/Speedy.svg',
    type: 'PARTICIPANT',
  },
]
