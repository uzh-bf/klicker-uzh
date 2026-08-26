import * as Prisma from '@klicker-uzh/prisma/client'
import { computeResponseExampleSetDigest } from '@klicker-uzh/util/response-example-digest'
import { USER_ID_TEST } from './constants.js'
import { CHATBOT_ID_TEST } from './seedChatbots.js'

// Development-only synthetic data for exercising the owner review UI.
const RESPONSE_EXAMPLE_SET_ID = '7f8f2d21-5b7e-4d6b-9c42-1c0e6e4d7a01'

const REVIEWED_AT = new Date('2026-08-21T12:00:00.000Z')

const SEEDED_RESPONSE_EXAMPLES = [
  {
    id: 'a1111111-1111-4111-8111-111111111111',
    chatMode: 'tutor',
    studentMessage:
      'Why does a higher discount rate reduce the present value of a future cash flow?',
    referenceAnswer: [
      'A higher discount rate reduces the present value because each future cash flow is discounted more heavily.',
      '',
      'The present value is calculated as **PV = FV / (1 + r)^t**. When the rate *r* increases, the denominator grows and the discounted amount shrinks.',
      '',
      'As a guided step, compare the same future payment at two rates:',
      '',
      '- At 5%, a payment of 100 in one year is worth about 95.24 today.',
      '- At 10%, it is only worth about 90.91 today.',
      '',
      'What does this tell you about long payment horizons? [1]',
    ].join('\n'),
    responseStyle: 'GUIDED_QUESTIONS',
    status: Prisma.ResponseExampleStatus.CANDIDATE,
    evidenceReferences: [
      {
        id: 'b1111111-1111-4111-8111-111111111111',
        sourceId: 'seed-source-finance-01',
        chunkId: 'seed-chunk-time-value-01',
        contentHash: 'seed-hash-time-value-01',
        citationIndex: 1,
        citationAnchor: 'Time value of money, section 2',
        evidenceEligible: true,
      },
    ],
  },
  {
    id: 'a2222222-2222-4222-8222-222222222222',
    chatMode: 'explainer',
    studentMessage: 'Was bedeutet der Zeitwert des Geldes?',
    referenceAnswer: [
      'Der Zeitwert des Geldes bedeutet, dass ein Franken heute mehr wert ist als ein Franken in der Zukunft, weil er zwischenzeitlich investiert werden kann.',
      '',
      '**Schritt 1:** Ein heute angelegter Franken erwirtschaftet Zinsen.',
      '**Schritt 2:** Deshalb muss ein zukuenftiger Betrag abgezinst werden, um seinen heutigen Wert zu bestimmen.',
      '',
      'Die Abzinsung macht diesen Unterschied rechnerisch sichtbar. [1]',
    ].join('\n'),
    responseStyle: 'STEP_BY_STEP_EXPLANATION',
    status: Prisma.ResponseExampleStatus.NEEDS_REVIEW,
    evidenceReferences: [
      {
        id: 'b2222222-2222-4222-8222-222222222222',
        sourceId: 'seed-source-finance-01',
        chunkId: 'seed-chunk-time-value-01',
        contentHash: 'seed-hash-time-value-changed',
        citationIndex: 1,
        citationAnchor: 'Zeitwert des Geldes, Abschnitt 2',
        evidenceEligible: false,
      },
    ],
  },
  {
    id: 'a3333333-3333-4333-8333-333333333333',
    chatMode: 'tutor',
    studentMessage:
      'Can you give me a hint for comparing two investments with different timing?',
    referenceAnswer: [
      'Before comparing the two options, put them on the same time basis.',
      '',
      'Two guiding questions help here:',
      '',
      '- Which cash flows occur at which point in time?',
      '- Which rate lets you compare their present values or net present values?',
      '',
      'Once both are stated as present values, the comparison becomes like-for-like. [1]',
    ].join('\n'),
    responseStyle: 'COMPARE_OPTIONS',
    status: Prisma.ResponseExampleStatus.APPROVED,
    evidenceReferences: [
      {
        id: 'b3333333-3333-4333-8333-333333333333',
        sourceId: 'seed-source-finance-01',
        chunkId: 'seed-chunk-time-value-01',
        contentHash: 'seed-hash-time-value-01',
        citationIndex: 1,
        citationAnchor: 'Time value of money, section 2',
        evidenceEligible: true,
      },
    ],
  },
  {
    id: 'a4444444-4444-4444-8444-444444444444',
    chatMode: 'explainer',
    studentMessage: 'What is a bond?',
    referenceAnswer: [
      'A bond is a debt instrument with two core promises from the issuer:',
      '',
      '- Regular interest payments on defined dates.',
      '- Repayment of the principal at maturity.',
      '',
      'The buyer therefore lends money to the issuer and receives a contractual repayment stream in return. [1]',
    ].join('\n'),
    responseStyle: 'CONCISE_ANSWER',
    status: Prisma.ResponseExampleStatus.REJECTED,
    evidenceReferences: [
      {
        id: 'b4444444-4444-4444-8444-444444444444',
        sourceId: 'seed-source-finance-01',
        chunkId: 'seed-chunk-time-value-01',
        contentHash: 'seed-hash-time-value-01',
        citationIndex: 1,
        citationAnchor: 'Time value of money, section 2',
        evidenceEligible: true,
      },
    ],
  },
] as const

function reviewMetadata(status: Prisma.ResponseExampleStatus) {
  const reviewed =
    status === Prisma.ResponseExampleStatus.APPROVED ||
    status === Prisma.ResponseExampleStatus.REJECTED

  return {
    reviewedById: reviewed ? USER_ID_TEST : null,
    reviewedAt: reviewed ? REVIEWED_AT : null,
  }
}

export async function seedResponseExamples(prisma: Prisma.PrismaClient) {
  const set = await prisma.responseExampleSet.upsert({
    where: { chatbotId: CHATBOT_ID_TEST },
    create: {
      id: RESPONSE_EXAMPLE_SET_ID,
      digest: '',
      chatbot: { connect: { id: CHATBOT_ID_TEST } },
    },
    update: { digest: '' },
  })

  for (const example of SEEDED_RESPONSE_EXAMPLES) {
    const metadata = reviewMetadata(example.status)

    await prisma.responseExample.upsert({
      where: { id: example.id },
      create: {
        id: example.id,
        setId: set.id,
        chatMode: example.chatMode,
        studentMessage: example.studentMessage,
        referenceAnswer: example.referenceAnswer,
        responseStyle: example.responseStyle,
        status: example.status,
        ...metadata,
      },
      update: {
        setId: set.id,
        chatMode: example.chatMode,
        studentMessage: example.studentMessage,
        referenceAnswer: example.referenceAnswer,
        responseStyle: example.responseStyle,
        status: example.status,
        ...metadata,
      },
    })

    for (const reference of example.evidenceReferences) {
      await prisma.responseExampleEvidenceReference.upsert({
        where: { id: reference.id },
        create: {
          id: reference.id,
          responseExampleId: example.id,
          sourceId: reference.sourceId,
          chunkId: reference.chunkId,
          contentHash: reference.contentHash,
          citationIndex: reference.citationIndex,
          citationAnchor: reference.citationAnchor,
          evidenceEligible: reference.evidenceEligible,
        },
        update: {
          responseExampleId: example.id,
          sourceId: reference.sourceId,
          chunkId: reference.chunkId,
          contentHash: reference.contentHash,
          citationIndex: reference.citationIndex,
          citationAnchor: reference.citationAnchor,
          evidenceEligible: reference.evidenceEligible,
        },
      })
    }
  }

  const seededSet = await prisma.responseExampleSet.findUnique({
    where: { id: set.id },
    include: { examples: { include: { evidenceReferences: true } } },
  })
  if (!seededSet) throw new Error('Response-example seed set was not found')

  await prisma.responseExampleSet.update({
    where: { id: seededSet.id },
    data: { digest: computeResponseExampleSetDigest(seededSet) },
  })
}
