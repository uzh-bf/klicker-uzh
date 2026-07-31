import type { Hatchet } from '@hatchet-dev/typescript-sdk'
import {
  ElementType,
  Locale,
  PermissionLevel,
  PrismaClient,
} from '@klicker-uzh/prisma/client'
import type {
  ElementOptionsCaseStudy,
  ElementOptionsSelection,
} from '@klicker-uzh/types'
import { EventEmitter } from 'events'
import type { ContextWithUser } from '../src/lib/context.js'
import { changeInitialSettings } from '../src/services/accounts.js'
import { initializePrisma, testCleanup, testInitialization } from './helpers.js'
import { userOne } from './userData.js'

const COLLECTION_ENTRIES = [
  'Live poll',
  'Think-pair-share',
  'Small-group case discussion',
  'One-minute paper',
  'Mini-lecture',
  'Instructor demonstration',
]

describe('Account demo element seeding', () => {
  let prisma: PrismaClient
  let hatchet: Hatchet
  let emitter: EventEmitter
  let userOneCtx: ContextWithUser

  beforeAll(async () => {
    const initialized = await initializePrisma()
    prisma = initialized.prisma
    hatchet = initialized.hatchet
    emitter = initialized.emitter
  })

  afterAll(async () => {
    await testCleanup(prisma)
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    const initialized = await testInitialization(prisma, hatchet, emitter)
    userOneCtx = initialized.userOneCtx
  })

  afterEach(async () => testCleanup(prisma))

  it('seeds selection and case study demos with one shared answer collection', async () => {
    await changeInitialSettings(
      {
        shortname: userOne.shortname,
        locale: Locale.en,
        sendUpdates: false,
        seedDemoElements: true,
      },
      userOneCtx
    )

    const collection = await prisma.answerCollection.findFirstOrThrow({
      where: {
        ownerId: userOne.id,
        name: 'Demo Teaching Activities',
      },
      include: { entries: true, permissions: true },
    })

    await expect(
      prisma.answerCollection.count({
        where: {
          ownerId: userOne.id,
          name: 'Demo Teaching Activities',
        },
      })
    ).resolves.toBe(1)

    expect(collection.description).toBe(
      'Reusable teaching activities used by the demo selection and case study questions.'
    )
    expect(collection.entries.map((entry) => entry.value).sort()).toEqual(
      [...COLLECTION_ENTRIES].sort()
    )
    expect(collection.permissions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          userId: userOne.id,
          permissionLevel: PermissionLevel.OWNER,
        }),
      ])
    )

    const entryId = (value: string) => {
      const entry = collection.entries.find(
        (candidate) => candidate.value === value
      )
      if (!entry)
        throw new Error(`Missing test answer collection entry: ${value}`)
      return entry.id
    }

    const elements = await prisma.element.findMany({
      where: {
        ownerId: userOne.id,
        name: { in: ['Demoquestion SE', 'Demoquestion CS'] },
      },
      include: {
        tags: true,
        answerCollection: { include: { entries: true } },
        answerCollectionItems: true,
        permissions: true,
      },
    })

    expect(elements).toHaveLength(2)
    const selection = elements.find(
      (element) => element.type === ElementType.SELECTION
    )
    const caseStudy = elements.find(
      (element) => element.type === ElementType.CASE_STUDY
    )
    expect(selection).toBeDefined()
    expect(caseStudy).toBeDefined()

    expect(selection).toMatchObject({
      name: 'Demoquestion SE',
      basePoints: true,
      pointsMultiplier: 1,
      answerCollectionId: collection.id,
    })
    expect(selection!.content).toBe(
      'You are teaching a large lecture and want to collect an individual response from every student. Select the two activities that meet this requirement.'
    )
    expect(selection!.explanation).toBe(
      'Live polls and one-minute papers collect an individual response from each student. Other activities can be highly interactive, but do not necessarily capture a response from everyone.'
    )
    expect(selection!.tags.map((tag) => tag.name)).toEqual(['Demo Tag'])
    expect(selection!.answerCollection?.id).toBe(collection.id)
    expect(selection!.options as ElementOptionsSelection).toEqual({
      hasSampleSolution: true,
      numberOfInputs: 2,
    })
    expect(
      selection!.answerCollectionItems.map((entry) => entry.id).sort()
    ).toEqual([entryId('Live poll'), entryId('One-minute paper')].sort())
    expect(selection!.permissions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          userId: userOne.id,
          permissionLevel: PermissionLevel.OWNER,
        }),
      ])
    )

    expect(caseStudy).toMatchObject({
      name: 'Demoquestion CS',
      basePoints: true,
      pointsMultiplier: 1,
      answerCollectionId: collection.id,
    })
    expect(caseStudy!.content).toBe(
      'Compare four teaching activities in two teaching settings. For each case, rate every activity by expected student engagement, preparation effort, and in-class time.'
    )
    expect(caseStudy!.explanation).toBe(
      'The sample ranges are illustrative rather than universally correct. Appropriate ratings depend on how each activity is designed and facilitated.'
    )
    expect(caseStudy!.tags.map((tag) => tag.name)).toEqual(['Demo Tag'])
    expect(caseStudy!.answerCollection?.id).toBe(collection.id)
    expect(
      caseStudy!.answerCollectionItems.map((entry) => entry.id).sort()
    ).toEqual(
      [
        entryId('Live poll'),
        entryId('Think-pair-share'),
        entryId('Small-group case discussion'),
        entryId('Mini-lecture'),
      ].sort()
    )
    expect(caseStudy!.permissions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          userId: userOne.id,
          permissionLevel: PermissionLevel.OWNER,
        }),
      ])
    )

    const caseStudyOptions = caseStudy!.options as ElementOptionsCaseStudy
    expect(caseStudyOptions).toEqual({
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
            {
              itemId: entryId('Live poll'),
              criteriaSolutions: [
                { criterionId: 'demo-engagement', min: 3, max: 5 },
                { criterionId: 'demo-preparation', min: 2, max: 3 },
                { criterionId: 'demo-time', min: 3, max: 7 },
              ],
            },
            {
              itemId: entryId('Think-pair-share'),
              criteriaSolutions: [
                { criterionId: 'demo-engagement', min: 4, max: 5 },
                { criterionId: 'demo-preparation', min: 1, max: 2 },
                { criterionId: 'demo-time', min: 6, max: 10 },
              ],
            },
            {
              itemId: entryId('Small-group case discussion'),
              criteriaSolutions: [
                { criterionId: 'demo-engagement', min: 3, max: 4 },
                { criterionId: 'demo-preparation', min: 3, max: 5 },
                { criterionId: 'demo-time', min: 12, max: 20 },
              ],
            },
            {
              itemId: entryId('Mini-lecture'),
              criteriaSolutions: [
                { criterionId: 'demo-engagement', min: 1, max: 2 },
                { criterionId: 'demo-preparation', min: 2, max: 4 },
                { criterionId: 'demo-time', min: 10, max: 20 },
              ],
            },
          ],
        },
        {
          id: 'demo-small-seminar',
          title: 'Small advanced seminar',
          description:
            'You are teaching an advanced seminar with 20 students in a room with flexible seating. You can devote up to 20 minutes to an activity and want students to engage deeply with the material.',
          order: 1,
          solutions: [
            {
              itemId: entryId('Live poll'),
              criteriaSolutions: [
                { criterionId: 'demo-engagement', min: 2, max: 4 },
                { criterionId: 'demo-preparation', min: 2, max: 3 },
                { criterionId: 'demo-time', min: 3, max: 7 },
              ],
            },
            {
              itemId: entryId('Think-pair-share'),
              criteriaSolutions: [
                { criterionId: 'demo-engagement', min: 4, max: 5 },
                { criterionId: 'demo-preparation', min: 1, max: 2 },
                { criterionId: 'demo-time', min: 6, max: 10 },
              ],
            },
            {
              itemId: entryId('Small-group case discussion'),
              criteriaSolutions: [
                { criterionId: 'demo-engagement', min: 4, max: 5 },
                { criterionId: 'demo-preparation', min: 3, max: 5 },
                { criterionId: 'demo-time', min: 12, max: 20 },
              ],
            },
            {
              itemId: entryId('Mini-lecture'),
              criteriaSolutions: [
                { criterionId: 'demo-engagement', min: 1, max: 3 },
                { criterionId: 'demo-preparation', min: 2, max: 4 },
                { criterionId: 'demo-time', min: 10, max: 20 },
              ],
            },
          ],
        },
      ],
    })
  })

  it('does not seed demo resources when the user opts out', async () => {
    await changeInitialSettings(
      {
        shortname: userOne.shortname,
        locale: Locale.en,
        sendUpdates: false,
        seedDemoElements: false,
      },
      userOneCtx
    )

    await expect(
      prisma.answerCollection.count({ where: { ownerId: userOne.id } })
    ).resolves.toBe(0)
    await expect(
      prisma.element.count({ where: { ownerId: userOne.id } })
    ).resolves.toBe(0)
    await expect(
      prisma.liveQuiz.count({ where: { ownerId: userOne.id } })
    ).resolves.toBe(0)
  })
})
