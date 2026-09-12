import * as DB from '@klicker-uzh/prisma/client'
import { recomputeDerivedPermissions } from '@klicker-uzh/util'
import type { PrismaTransactionContextWithUser } from '../lib/context.js'

export async function seedDemoSelectionAndCaseStudyElements(
  ctx: PrismaTransactionContextWithUser
) {
  const answerCollection = await ctx.prisma.answerCollection.create({
    data: {
      name: 'Demo Teaching Activities',
      description:
        'Reusable teaching activities used by the demo selection and case study questions.',
      entries: {
        create: [
          'Live poll',
          'Think-pair-share',
          'Small-group case discussion',
          'One-minute paper',
          'Mini-lecture',
          'Instructor demonstration',
        ].map((value) => ({ value })),
      },
      owner: { connect: { id: ctx.user.sub } },
    },
    include: { entries: true },
  })

  const getEntryId = (value: string) => {
    const entry = answerCollection.entries.find(
      (candidate) => candidate.value === value
    )
    if (!entry) {
      throw new Error(`Demo answer collection entry missing: ${value}`)
    }
    return entry.id
  }

  const connectEntries = (...values: Array<string>) => ({
    connect: values.map((value) => ({ id: getEntryId(value) })),
  })
  const sharedElementData = {
    owner: { connect: { id: ctx.user.sub } },
    tags: {
      connect: {
        ownerId_name: { ownerId: ctx.user.sub, name: 'Demo Tag' },
      },
    },
    answerCollection: { connect: { id: answerCollection.id } },
  }
  const elementInclude = {
    answerCollection: { include: { entries: true } },
    answerCollectionItems: true,
  }
  const createRange = (criterionId: string, [min, max]: [number, number]) => ({
    criterionId,
    min,
    max,
  })
  const createCaseSolution = (
    value: string,
    engagement: [number, number],
    preparation: [number, number],
    time: [number, number]
  ) => ({
    itemId: getEntryId(value),
    criteriaSolutions: [
      createRange('demo-engagement', engagement),
      createRange('demo-preparation', preparation),
      createRange('demo-time', time),
    ],
  })

  const questionSE = await ctx.prisma.element.create({
    data: {
      name: 'Demoquestion SE',
      type: DB.ElementType.SELECTION,
      content:
        'You are teaching a large lecture and want to collect an individual response from every student. Select the two activities that meet this requirement.',
      explanation:
        'Live polls and one-minute papers collect an individual response from each student. Other activities can be highly interactive, but do not necessarily capture a response from everyone.',
      basePoints: true,
      pointsMultiplier: 1,
      options: {
        hasSampleSolution: true,
        numberOfInputs: 2,
      },
      ...sharedElementData,
      answerCollectionItems: connectEntries('Live poll', 'One-minute paper'),
    },
    include: elementInclude,
  })

  const questionCS = await ctx.prisma.element.create({
    data: {
      name: 'Demoquestion CS',
      type: DB.ElementType.CASE_STUDY,
      content:
        'Compare four teaching activities in two teaching settings. For each case, rate every activity by expected student engagement, preparation effort, and in-class time.',
      explanation:
        'The sample ranges are illustrative rather than universally correct. Appropriate ratings depend on how each activity is designed and facilitated.',
      basePoints: true,
      pointsMultiplier: 1,
      options: {
        hasSampleSolution: true,
        criteria: [
          {
            id: 'demo-engagement',
            name: 'Expected engagement',
            order: 0,
            min: 1,
            max: 5,
            step: 1,
          },
          {
            id: 'demo-preparation',
            name: 'Preparation effort',
            order: 1,
            min: 1,
            max: 5,
            step: 1,
          },
          {
            id: 'demo-time',
            name: 'In-class time',
            order: 2,
            min: 1,
            max: 20,
            step: 1,
            unit: 'min',
          },
        ],
        cases: [
          {
            id: 'demo-large-lecture',
            title: 'Large introductory lecture',
            description:
              'You are teaching an introductory lecture with 300 students in fixed seating. You have at most 20 minutes for an activity and need an approach that works at scale.',
            order: 0,
            solutions: [
              createCaseSolution('Live poll', [3, 5], [2, 3], [3, 7]),
              createCaseSolution('Think-pair-share', [4, 5], [1, 2], [6, 10]),
              createCaseSolution(
                'Small-group case discussion',
                [3, 4],
                [3, 5],
                [12, 20]
              ),
              createCaseSolution('Mini-lecture', [1, 2], [2, 4], [10, 20]),
            ],
          },
          {
            id: 'demo-small-seminar',
            title: 'Small advanced seminar',
            description:
              'You are teaching an advanced seminar with 20 students in a room with flexible seating. You can devote up to 20 minutes to an activity and want students to engage deeply with the material.',
            order: 1,
            solutions: [
              createCaseSolution('Live poll', [2, 4], [2, 3], [3, 7]),
              createCaseSolution('Think-pair-share', [4, 5], [1, 2], [6, 10]),
              createCaseSolution(
                'Small-group case discussion',
                [4, 5],
                [3, 5],
                [12, 20]
              ),
              createCaseSolution('Mini-lecture', [1, 3], [2, 4], [10, 20]),
            ],
          },
        ],
      },
      ...sharedElementData,
      answerCollectionItems: connectEntries(
        'Live poll',
        'Think-pair-share',
        'Small-group case discussion',
        'Mini-lecture'
      ),
    },
    include: elementInclude,
  })

  await recomputeDerivedPermissions(
    { answerCollectionId: answerCollection.id, userId: ctx.user.sub },
    ctx.prisma
  )
  await recomputeDerivedPermissions(
    { elementId: questionSE.id, userId: ctx.user.sub },
    ctx.prisma
  )
  await recomputeDerivedPermissions(
    { elementId: questionCS.id, userId: ctx.user.sub },
    ctx.prisma
  )

  return { questionSE, questionCS }
}
