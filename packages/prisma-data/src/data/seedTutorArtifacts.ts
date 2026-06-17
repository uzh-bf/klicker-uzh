import * as Prisma from '@klicker-uzh/prisma/client'

type SeedTutorArtifactOptions = {
  chatbotId: string
  courseId: string
  skillPackPrompt: string
}

const skillComponents = [
  {
    slug: 'wacc',
    title: 'Weighted Average Cost of Capital',
    description:
      'Estimate firm discount rates from market-value capital weights and component costs.',
    prerequisites: ['time-value-of-money', 'capital-structure'],
  },
  {
    slug: 'capm',
    title: 'Capital Asset Pricing Model',
    description:
      'Use beta, risk-free rates, and the market risk premium to estimate expected return.',
    prerequisites: ['expected-return', 'systematic-risk'],
  },
  {
    slug: 'npv',
    title: 'Net Present Value',
    description:
      'Discount incremental cash flows and decide whether a project creates value.',
    prerequisites: ['discounting', 'cash-flow-timing'],
  },
  {
    slug: 'duration',
    title: 'Bond Duration',
    description:
      'Interpret Macaulay and modified duration as weighted maturity and rate sensitivity.',
    prerequisites: ['bond-pricing', 'yield-to-maturity'],
  },
  {
    slug: 'risk-return',
    title: 'Risk And Return',
    description:
      'Reason about diversification, expected return, volatility, and covariance.',
    prerequisites: ['probability', 'variance'],
  },
  {
    slug: 'leverage',
    title: 'Financial Leverage',
    description:
      'Explain how debt changes equity risk, expected return, and firm value.',
    prerequisites: ['capital-structure', 'risk-return'],
  },
  {
    slug: 'option-pricing',
    title: 'Option Pricing',
    description:
      'Connect option payoffs, replication, no-arbitrage, and risk-neutral valuation.',
    prerequisites: ['no-arbitrage', 'state-contingent-payoffs'],
  },
] as const

const misconceptions = [
  {
    slug: 'wacc',
    label: 'wacc_book_value_weights',
    symptoms: [
      'Uses book-value debt/equity weights when market values are provided.',
      'Averages component costs without capital weights.',
    ],
    diagnosticQuestion:
      'Which weights should enter WACC when market values and book values differ?',
    correctiveMove:
      'Ask the student to identify market values first, then compute weights before plugging rates into WACC.',
  },
  {
    slug: 'capm',
    label: 'capm_beta_as_total_risk',
    symptoms: [
      'Treats beta as total volatility instead of systematic risk.',
      'Adds idiosyncratic risk directly to CAPM expected return.',
    ],
    diagnosticQuestion:
      'What risk does beta measure in CAPM, and what risk is diversified away?',
    correctiveMove:
      'Separate systematic from firm-specific risk before applying the CAPM formula.',
  },
  {
    slug: 'npv',
    label: 'npv_nominal_real_mismatch',
    symptoms: [
      'Discounts nominal cash flows with a real discount rate.',
      'Mixes inflation-adjusted and nominal quantities in one NPV calculation.',
    ],
    diagnosticQuestion:
      'Are the cash flows and discount rate expressed in the same inflation terms?',
    correctiveMove:
      'Have the student label cash flows and rate as nominal or real before discounting.',
  },
  {
    slug: 'duration',
    label: 'duration_maturity_confusion',
    symptoms: [
      'Equates duration with final maturity for coupon bonds.',
      'Misses that earlier coupon payments shorten Macaulay duration.',
    ],
    diagnosticQuestion:
      'How do coupons before maturity change the cash-flow weighted average time?',
    correctiveMove:
      'Prompt the student to weight each payment date by the present value share of that payment.',
  },
  {
    slug: 'risk-return',
    label: 'diversification_average_volatility',
    symptoms: [
      'Averages individual asset volatilities to get portfolio volatility.',
      'Ignores covariance or correlation.',
    ],
    diagnosticQuestion:
      'Where does covariance enter the portfolio variance formula?',
    correctiveMove:
      'Ask for the two-asset variance expression before calculating portfolio risk.',
  },
  {
    slug: 'leverage',
    label: 'leverage_value_without_tax_or_distress',
    symptoms: [
      'Claims leverage always increases firm value without mentioning assumptions.',
      'Confuses equity risk effects with total firm value effects.',
    ],
    diagnosticQuestion:
      'Which market frictions or tax effects are present in this leverage setting?',
    correctiveMove:
      'Distinguish MM without taxes, MM with taxes, and distress-cost tradeoffs.',
  },
  {
    slug: 'option-pricing',
    label: 'option_expected_payoff_discounting',
    symptoms: [
      'Discounts the physical expected payoff without risk adjustment.',
      'Skips replication or risk-neutral probabilities.',
    ],
    diagnosticQuestion:
      'Can you price the option by replication or by risk-neutral probabilities?',
    correctiveMove:
      'Guide the student to set up state payoffs and solve the replicating portfolio first.',
  },
] as const

function hintLevels(topic: string, diagnosticQuestion: string) {
  return {
    orientation: `Identify the finance concept first: ${topic}.`,
    cue: diagnosticQuestion,
    setup:
      'Write down the relevant formula and label every input before substituting numbers.',
    microStep:
      'Complete only the next missing algebra or classification step, then ask the student to continue.',
    bottomOut:
      'If the student is still stuck, show a minimal worked step but stop before the final answer.',
  }
}

export async function seedTutorArtifacts(
  prisma: Prisma.PrismaClient,
  { chatbotId, courseId, skillPackPrompt }: SeedTutorArtifactOptions
) {
  await prisma.tutorSkillPack.upsert({
    where: {
      chatbotId_baseMode_version: {
        chatbotId,
        baseMode: 'tutor',
        version: 'tutor-skills-v1',
      },
    },
    create: {
      chatbotId,
      courseId,
      version: 'tutor-skills-v1',
      name: 'Research-backed tutor skills v1',
      status: 'published',
      baseMode: 'tutor',
      prompt: skillPackPrompt,
      policy: {
        allowedMoves: [
          'ask',
          'hint',
          'simplify',
          'explain',
          'worked_micro_step',
          'self_explain',
          'reflect',
          'summarize',
        ],
        leakageDefault: false,
        maxQuestionsPerTurn: 1,
        citationPolicy: 'retrieved_evidence_only',
      },
      publishedAt: new Date('2026-06-17T00:00:00.000Z'),
    },
    update: {
      courseId,
      name: 'Research-backed tutor skills v1',
      status: 'published',
      prompt: skillPackPrompt,
      policy: {
        allowedMoves: [
          'ask',
          'hint',
          'simplify',
          'explain',
          'worked_micro_step',
          'self_explain',
          'reflect',
          'summarize',
        ],
        leakageDefault: false,
        maxQuestionsPerTurn: 1,
        citationPolicy: 'retrieved_evidence_only',
      },
      publishedAt: new Date('2026-06-17T00:00:00.000Z'),
    },
  })

  const componentsBySlug = new Map<string, { id: string; title: string }>()
  for (const component of skillComponents) {
    const record = await prisma.tutorKnowledgeComponent.upsert({
      where: {
        courseId_slug: {
          courseId,
          slug: component.slug,
        },
      },
      create: {
        courseId,
        slug: component.slug,
        title: component.title,
        description: component.description,
        prerequisites: [...component.prerequisites],
        metadata: {
          source: 'seeded_finance_tutor_artifacts',
        },
      },
      update: {
        title: component.title,
        description: component.description,
        prerequisites: [...component.prerequisites],
        metadata: {
          source: 'seeded_finance_tutor_artifacts',
        },
      },
      select: { id: true, title: true },
    })
    componentsBySlug.set(component.slug, record)
  }

  for (const misconception of misconceptions) {
    const component = componentsBySlug.get(misconception.slug)
    if (!component) continue

    const record = await prisma.tutorMisconception.upsert({
      where: {
        courseId_label: {
          courseId,
          label: misconception.label,
        },
      },
      create: {
        courseId,
        skillId: component.id,
        label: misconception.label,
        symptoms: {
          patterns: [...misconception.symptoms],
        },
        nearMisses: {
          examples: [],
        },
        diagnosticQuestion: misconception.diagnosticQuestion,
        correctiveMove: misconception.correctiveMove,
        evidenceLevel: 'seeded_example',
        status: 'lecturer_validated',
      },
      update: {
        skillId: component.id,
        symptoms: {
          patterns: [...misconception.symptoms],
        },
        nearMisses: {
          examples: [],
        },
        diagnosticQuestion: misconception.diagnosticQuestion,
        correctiveMove: misconception.correctiveMove,
        evidenceLevel: 'seeded_example',
        status: 'lecturer_validated',
      },
      select: { id: true },
    })

    await prisma.tutorHintLadder.upsert({
      where: {
        courseId_skillId_misconceptionId: {
          courseId,
          skillId: component.id,
          misconceptionId: record.id,
        },
      },
      create: {
        courseId,
        skillId: component.id,
        misconceptionId: record.id,
        levels: hintLevels(component.title, misconception.diagnosticQuestion),
        maxDepth: 4,
      },
      update: {
        levels: hintLevels(component.title, misconception.diagnosticQuestion),
        maxDepth: 4,
      },
    })
  }
}
