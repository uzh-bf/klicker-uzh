import Prisma from '../../../dist/index.js'
import { AchievementType } from '../../prisma/client/index.js'
const { ElementType, PublicationStatus } = Prisma

export const ANSWER_COLLECTIONS = [
  {
    name: 'Collection 1 (Fruits)',
    description:
      'This collection contains questions about fruits. The description supports markdown syntax such as **bold** and *italic*.',
    entries: [
      {
        value: 'Apple',
      },
      {
        value: 'Banana',
      },
      {
        value: 'Cherry',
      },
      {
        value: 'Date',
      },
      {
        value: 'Elderberry',
      },
      {
        value: 'Fig',
      },
      {
        value: 'Grape',
      },
      {
        value: 'Honeydew',
      },
      {
        value: 'Kiwi',
      },
      {
        value: 'Lemon',
      },
      {
        value: 'Mango',
      },
      {
        value: 'Nectarine',
      },
      {
        value: 'Orange',
      },
      {
        value: 'Peach',
      },
      {
        value: 'Quince',
      },
      {
        value: 'Raspberry',
      },
      {
        value: 'Strawberry',
      },
      {
        value: 'Tangerine',
      },
      {
        value: 'Ugli',
      },
      {
        value: 'Vanilla',
      },
      {
        value: 'Watermelon',
      },
      {
        value: 'Ximenia',
      },
      {
        value: 'Yuzu',
      },
    ],
  },
  {
    name: 'Collection 2 (Vegetables)',
    description:
      'This collection contains questions about vegetables. The description supports markdown syntax such as **bold** and *italic*.',
    entries: [
      {
        value: 'Artichoke',
      },
      {
        value: 'Broccoli',
      },
      {
        value: 'Cabbage',
      },
      {
        value: 'Dill',
      },
      {
        value: 'Cucumber',
      },
      {
        value: 'Carrot',
      },
    ],
  },
  {
    name: 'Collection 3 (Animals)',
    description:
      'This collection contains questions about animals. The description supports markdown syntax such as **bold** and *italic*.',
    entries: [
      {
        value: 'Antelope',
      },
      {
        value: 'Bear',
      },
      {
        value: 'Cat',
      },
      {
        value: 'Dog',
      },
      {
        value: 'Elephant',
      },
      {
        value: 'Fox',
      },
    ],
  },
]

export const CATALOG_ASSIGNMENTS = [
  {
    answerCollectionName: ANSWER_COLLECTIONS[0]!.name,
    catalogCollectionName: undefined,
    access: Prisma.ObjectAccess.PUBLIC,
  },
  {
    answerCollectionName: ANSWER_COLLECTIONS[2]!.name,
    catalogCollectionName: undefined,
    access: Prisma.ObjectAccess.RESTRICTED,
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
]

export const LIVE_QUIZZES = [
  {
    id: '1ec093e0-b6b6-421f-98ac-98ab146505f7',
    name: 'Test mit Multiplier',
    displayName: 'Test mit Multiplier',
    description: 'Test description for test quiz with multiplier.',
    isGamificationEnabled: true,
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
    id: '20325ec6-0ce7-4e24-bd79-5c1a46f64c47',
    name: 'Test Live Quiz 2',
    displayName: 'Test Live Quiz 2',
    isModerationEnabled: false,
    isLiveQAEnabled: true,
    isConfusionFeedbackEnabled: true,
    isGamificationEnabled: true,
    status: PublicationStatus.SCHEDULED,
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
