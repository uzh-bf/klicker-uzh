import type { Hatchet } from '@hatchet-dev/typescript-sdk'
import {
  ElementInstanceType,
  ElementStatus,
  ElementType,
  PrismaClient,
  PublicationStatus,
} from '@klicker-uzh/prisma/client'
import { isValidQrScanCode } from '@klicker-uzh/types'
import {
  generateQrScanCode,
  getInitialInstanceResults,
  processElementData,
  recomputeDerivedPermissions,
} from '@klicker-uzh/util'
import { EventEmitter } from 'events'
import type { ContextWithUser } from '../src/lib/context.js'
import {
  createLiveQuizFromTemplate,
  getActivityTemplate,
} from '../src/services/templates.js'
import { initializePrisma, testCleanup, testInitialization } from './helpers.js'

describe('Escape-room activity templates', () => {
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

  afterEach(async () => await testCleanup(prisma))

  it('preserves escape-room template settings and creates a fresh QR secret', async () => {
    const sourceCode = generateQrScanCode()
    const sourceElement = await prisma.element.create({
      data: {
        status: ElementStatus.READY,
        type: ElementType.QR_SCAN,
        name: 'Template QR scan',
        content: 'Scan the code',
        explanation: 'Template explanation',
        basePoints: true,
        pointsMultiplier: 1,
        options: {},
        qrScanCode: sourceCode,
        owner: { connect: { id: userOneCtx.user.sub } },
      },
    })
    const elementData = processElementData(sourceElement)
    const template = await prisma.activityTemplate.create({
      data: {
        description: 'Escape-room QR template',
        instructions: 'Instantiate the template',
        liveQuiz: {
          create: {
            name: 'Escape-room QR template',
            displayName: 'Escape-room QR template',
            status: PublicationStatus.TEMPLATE,
            owner: { connect: { id: userOneCtx.user.sub } },
            blocks: {
              create: {
                order: 0,
                escapeRoomConfig: {
                  create: {
                    timeLimit: 321,
                    hintPenalty: 17,
                    lockoutSeconds: 9,
                    introText: 'Find the hidden code',
                  },
                },
                elements: {
                  create: {
                    type: ElementInstanceType.LIVE_QUIZ,
                    elementData,
                    elementType: ElementType.QR_SCAN,
                    order: 0,
                    options: {
                      basePoints: true,
                      pointsMultiplier: 1,
                      escapeRoomHint: 'Look behind the poster',
                    },
                    results: getInitialInstanceResults(elementData),
                    anonymousResults: getInitialInstanceResults(elementData),
                    elementId: sourceElement.id,
                    ownerId: userOneCtx.user.sub,
                  },
                },
              },
            },
          },
        },
      },
      include: { liveQuiz: true },
    })
    await recomputeDerivedPermissions(
      {
        liveQuizId: template.liveQuiz!.id,
        userId: userOneCtx.user.sub,
      },
      prisma
    )

    const loaded = await getActivityTemplate(
      { templateId: template.id },
      userOneCtx
    )
    expect(loaded?.liveQuiz?.blocks[0]?.escapeRoomConfig).toMatchObject({
      timeLimit: 321,
      hintPenalty: 17,
      lockoutSeconds: 9,
      introText: 'Find the hidden code',
    })
    expect(loaded?.liveQuiz?.blocks[0]?.elements[0]).not.toHaveProperty(
      'escapeRoomHint'
    )

    const createdId = await createLiveQuizFromTemplate(
      {
        templateId: template.id,
        name: 'Instantiated escape room',
        displayName: 'Instantiated escape room',
        isGamificationEnabled: false,
        blocks: [
          {
            order: 0,
            isEscapeRoom: true,
            escapeRoomTimeLimit: 321,
            escapeRoomHintPenalty: 17,
            escapeRoomLockoutSeconds: 9,
            escapeRoomIntroText: 'Find the hidden code',
            elements: [
              {
                order: 0,
                useExistingElement: false,
                useNewElement: true,
                newElement: {
                  status: ElementStatus.READY,
                  type: ElementType.QR_SCAN,
                  name: sourceElement.name,
                  content: sourceElement.content,
                  explanation: sourceElement.explanation,
                  basePoints: sourceElement.basePoints,
                  pointsMultiplier: sourceElement.pointsMultiplier,
                  tags: [],
                },
              },
            ],
          },
        ],
      },
      userOneCtx
    )
    expect(createdId).toBeTruthy()

    const created = await prisma.liveQuiz.findUniqueOrThrow({
      where: { id: createdId! },
      include: {
        blocks: {
          include: {
            escapeRoomConfig: true,
            elements: { include: { element: true } },
          },
        },
      },
    })
    expect(created.blocks[0]?.escapeRoomConfig).toMatchObject({
      timeLimit: 321,
      hintPenalty: 17,
      lockoutSeconds: 9,
      introText: 'Find the hidden code',
    })
    expect(created.blocks[0]?.elements[0]?.options.escapeRoomHint).toBe(
      'Look behind the poster'
    )
    const createdCode = created.blocks[0]?.elements[0]?.element.qrScanCode
    expect(isValidQrScanCode(createdCode)).toBe(true)
    expect(createdCode).not.toBe(sourceCode)
  })
})
