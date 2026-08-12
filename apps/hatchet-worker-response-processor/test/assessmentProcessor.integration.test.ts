import type {
  DurableContext,
  UnknownInputType,
} from '@hatchet-dev/typescript-sdk'
import {
  dispatchAssessmentAuditOutbox,
  PrismaAuditOutboxRepository,
} from '@klicker-uzh/audit'
import { prisma } from '@klicker-uzh/prisma'
import type {
  AssessmentResponseCommand,
  LiveQuizResponseInput,
} from '@klicker-uzh/types'
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { processAssessmentResponse } from '../src/processors/assessmentProcessor.js'

const USER_ID = '10000000-0000-4000-8000-000000000001'
const COURSE_ID = '10000000-0000-4000-8000-000000000002'
const LIVE_QUIZ_ID = '10000000-0000-4000-8000-000000000003'
const PARTICIPANT_ID = '10000000-0000-4000-8000-000000000004'
const UNKNOWN_PARTICIPANT_ID = '10000000-0000-4000-8000-000000000099'
const BASELINE_ID = '10000000-0000-4000-8000-000000000005'
const SUBMISSION_ID = '10000000-0000-4000-8000-000000000006'
const HATCHET_EVENT_ID = 'hatchet-assessment-event-1'

type ProcessorContext = DurableContext<UnknownInputType, {}>

const runDatabaseTests = Boolean(process.env.DATABASE_URL)

describe.runIf(runDatabaseTests)(
  'assessment submission materialization',
  () => {
    let blockId: number
    let instanceId: number

    beforeAll(async () => {
      await prisma.assessmentAuditOutboxEvent.deleteMany({
        where: { liveQuizId: LIVE_QUIZ_ID },
      })
      await prisma.assessmentAuditScope.deleteMany({
        where: { liveQuizId: LIVE_QUIZ_ID },
      })
      await prisma.user.deleteMany({ where: { id: USER_ID } })
      await prisma.participant.deleteMany({ where: { id: PARTICIPANT_ID } })

      const user = await prisma.user.create({
        data: {
          id: USER_ID,
          email: 'assessment-audit-layer5@example.org',
          shortname: 'assessment-audit-layer5',
        },
      })
      await prisma.course.create({
        data: {
          id: COURSE_ID,
          name: 'Assessment audit Layer 5 fixture',
          displayName: 'Assessment audit Layer 5 fixture',
          startDate: new Date('2026-01-01T00:00:00.000Z'),
          endDate: new Date('2027-01-01T00:00:00.000Z'),
          groupDeadlineDate: new Date('2026-12-01T00:00:00.000Z'),
          authType: 'SSO',
          isAssessmentEnabled: true,
          ownerId: user.id,
        },
      })
      await prisma.participant.create({
        data: {
          id: PARTICIPANT_ID,
          username: 'assessment-audit-layer5-participant',
          password: 'test-only',
        },
      })
      await prisma.participation.create({
        data: {
          isActive: true,
          courseId: COURSE_ID,
          participantId: PARTICIPANT_ID,
        },
      })
      await prisma.liveQuiz.create({
        data: {
          id: LIVE_QUIZ_ID,
          name: 'Assessment audit Layer 5 quiz',
          displayName: 'Assessment audit Layer 5 quiz',
          status: 'PUBLISHED',
          pinCode: 'L5AUDIT',
          isAssessmentEnabled: true,
          ownerId: USER_ID,
          courseId: COURSE_ID,
        },
      })
      const element = await prisma.element.create({
        data: {
          name: 'Layer 5 single choice',
          content: 'Synthetic assessment question',
          type: 'SC',
          options: {},
          ownerId: USER_ID,
        },
      })
      const block = await prisma.elementBlock.create({
        data: {
          order: 0,
          execution: 1,
          status: 'ACTIVE',
          liveQuizId: LIVE_QUIZ_ID,
        },
      })
      blockId = block.id
      const instance = await prisma.elementInstance.create({
        data: {
          type: 'LIVE_QUIZ',
          elementType: 'SC',
          order: 0,
          options: {},
          elementData: {},
          results: {},
          anonymousResults: {},
          elementId: element.id,
          elementBlockId: block.id,
          ownerId: USER_ID,
        },
      })
      instanceId = instance.id
      await prisma.assessmentAuditScope.create({
        data: {
          liveQuizId: LIVE_QUIZ_ID,
          lifecycleEpoch: 1,
          coverageState: 'COVERED',
          baselineId: BASELINE_ID,
          baselineKind: 'CREATION',
          activatedAt: new Date('2026-08-12T11:00:00.000Z'),
        },
      })
    })

    beforeEach(async () => {
      await prisma.liveQuizResponse.deleteMany({
        where: { instanceId },
      })
      // The dispatcher intentionally claims from the global outbox. This
      // disposable integration database must therefore start each case empty,
      // including after another package's outbox tests ran in the same CI job.
      await prisma.assessmentAuditOutboxEvent.deleteMany()
    })

    afterAll(async () => {
      await prisma.assessmentAuditOutboxEvent.deleteMany({
        where: { liveQuizId: LIVE_QUIZ_ID },
      })
      await prisma.assessmentAuditScope.deleteMany({
        where: { liveQuizId: LIVE_QUIZ_ID },
      })
      await prisma.user.deleteMany({ where: { id: USER_ID } })
      await prisma.participant.deleteMany({ where: { id: PARTICIPANT_ID } })
      await prisma.$disconnect()
    })

    function command(
      overrides: Partial<AssessmentResponseCommand<LiveQuizResponseInput>> = {}
    ): AssessmentResponseCommand<LiveQuizResponseInput> {
      return {
        submissionId: SUBMISSION_ID,
        correlationId: SUBMISSION_ID,
        participantId: PARTICIPANT_ID,
        liveQuizId: LIVE_QUIZ_ID,
        instanceId: String(instanceId),
        response: { choices: [{ ix: 0, selected: true }] },
        responseTimestamp: Date.parse('2026-08-12T12:00:00.000Z'),
        receivedAt: '2026-08-12T12:00:00.000Z',
        transportAttemptedAt: '2026-08-12T12:00:00.100Z',
        ...overrides,
      }
    }

    function harness(hatchetEventId = HATCHET_EVENT_ID) {
      const push = vi.fn().mockResolvedValue({ eventId: 'aggregation-event' })
      const info = {
        type: 'SC',
        solutions: JSON.stringify([0]),
        sessionBlockId: String(blockId),
        courseId: COURSE_ID,
        choiceCount: '2',
        basePoints: 'true',
        defaultPoints: '10',
        pointsMultiplier: '1',
        blockExecution: '1',
        isGamificationEnabled: 'false',
      }
      const redis = {
        hgetall: vi.fn().mockResolvedValue(info),
        hset: vi.fn().mockResolvedValue(1),
        hsetnx: vi.fn().mockResolvedValue(1),
      }
      const context = {
        retryCount: () => 0,
        logger: {
          info: vi.fn(),
          error: vi.fn(),
        },
        v1: { events: { push } },
      } as unknown as ProcessorContext
      return {
        context,
        info,
        push,
        dependencies: {
          client: prisma,
          redis,
          now: () => new Date('2026-08-12T12:00:01.000Z'),
          resolveHatchetEventId: vi.fn().mockResolvedValue(hatchetEventId),
        },
      }
    }

    it('commits the response and authoritative evidence in one transaction', async () => {
      const testHarness = harness()

      const result = await processAssessmentResponse(
        command(),
        testHarness.context,
        testHarness.dependencies
      )

      expect(result.status).toBe(200)
      const response = await prisma.liveQuizResponse.findUniqueOrThrow({
        where: { submissionId: SUBMISSION_ID },
      })
      expect(response.basePoints).toBe(10)
      const events = await prisma.assessmentAuditOutboxEvent.findMany({
        where: { liveQuizId: LIVE_QUIZ_ID },
        orderBy: { eventType: 'asc' },
        select: { eventType: true, participantId: true },
      })
      expect(events.map(({ eventType }) => eventType)).toEqual([
        'SUBMISSION_PERSISTED',
        'SUBMISSION_SCORED',
        'SUBMISSION_SERVER_ACCEPTED',
        'SUBMISSION_VALIDATED',
      ])
      expect(
        events.every((event) => event.participantId === PARTICIPANT_ID)
      ).toBe(true)
    })

    it('preserves submission processing without audit provenance outside coverage', async () => {
      await prisma.assessmentAuditScope.delete({
        where: {
          liveQuizId_lifecycleEpoch: {
            liveQuizId: LIVE_QUIZ_ID,
            lifecycleEpoch: 1,
          },
        },
      })
      const testHarness = harness()

      try {
        const result = await processAssessmentResponse(
          command(),
          testHarness.context,
          testHarness.dependencies
        )

        expect(result.status).toBe(200)
        expect(
          testHarness.dependencies.resolveHatchetEventId
        ).not.toHaveBeenCalled()
        expect(
          await prisma.liveQuizResponse.count({
            where: { submissionId: SUBMISSION_ID },
          })
        ).toBe(1)
        expect(
          await prisma.assessmentAuditOutboxEvent.count({
            where: { liveQuizId: LIVE_QUIZ_ID },
          })
        ).toBe(0)
      } finally {
        await prisma.assessmentAuditScope.create({
          data: {
            liveQuizId: LIVE_QUIZ_ID,
            lifecycleEpoch: 1,
            coverageState: 'COVERED',
            baselineId: BASELINE_ID,
            baselineKind: 'CREATION',
            activatedAt: new Date('2026-08-12T11:00:00.000Z'),
          },
        })
      }
    })

    it('is idempotent for a Hatchet retry and records a second command as duplicate', async () => {
      const first = harness(HATCHET_EVENT_ID)
      await processAssessmentResponse(
        command(),
        first.context,
        first.dependencies
      )
      await processAssessmentResponse(
        command(),
        first.context,
        first.dependencies
      )

      expect(
        await prisma.liveQuizResponse.count({
          where: { submissionId: SUBMISSION_ID },
        })
      ).toBe(1)
      expect(
        await prisma.assessmentAuditOutboxEvent.count({
          where: { liveQuizId: LIVE_QUIZ_ID },
        })
      ).toBe(4)
      expect(
        await prisma.assessmentAuditOutboxEvent.count({
          where: {
            liveQuizId: LIVE_QUIZ_ID,
            correlationId: SUBMISSION_ID,
            eventType: {
              in: [
                'SUBMISSION_REJECTED',
                'SUBMISSION_DUPLICATE',
                'SUBMISSION_PERSISTED',
              ],
            },
          },
        })
      ).toBe(1)

      const resend = harness('hatchet-assessment-event-2')
      const duplicate = await processAssessmentResponse(
        command(),
        resend.context,
        resend.dependencies
      )
      expect(duplicate.status).toBe(208)
      expect(
        await prisma.assessmentAuditOutboxEvent.count({
          where: {
            liveQuizId: LIVE_QUIZ_ID,
            eventType: 'SUBMISSION_DUPLICATE',
          },
        })
      ).toBe(1)
    })

    it('rejects reuse of a submission ID with a different answer', async () => {
      const first = harness(HATCHET_EVENT_ID)
      await processAssessmentResponse(
        command(),
        first.context,
        first.dependencies
      )

      const changedAnswer = harness('hatchet-assessment-event-2')
      await expect(
        processAssessmentResponse(
          command({ response: { choices: [{ ix: 1, selected: true }] } }),
          changedAnswer.context,
          changedAnswer.dependencies
        )
      ).rejects.toThrow('SUBMISSION_ID_ANSWER_MISMATCH')

      expect(
        await prisma.liveQuizResponse.count({
          where: { submissionId: SUBMISSION_ID },
        })
      ).toBe(1)
      expect(
        await prisma.assessmentAuditOutboxEvent.count({
          where: {
            liveQuizId: LIVE_QUIZ_ID,
            eventType: 'SUBMISSION_REJECTED',
          },
        })
      ).toBe(1)
    })

    it('rolls back persistence and records a retryable processing failure', async () => {
      const testHarness = harness()

      await expect(
        processAssessmentResponse(
          command({ instanceId: '999999999' }),
          testHarness.context,
          testHarness.dependencies
        )
      ).rejects.toBeDefined()

      expect(
        await prisma.liveQuizResponse.count({
          where: { submissionId: SUBMISSION_ID },
        })
      ).toBe(0)
      expect(
        await prisma.assessmentAuditOutboxEvent.count({
          where: {
            liveQuizId: LIVE_QUIZ_ID,
            eventType: 'SUBMISSION_PROCESSING_FAILED',
          },
        })
      ).toBe(1)
      expect(
        await prisma.assessmentAuditOutboxEvent.count({
          where: {
            liveQuizId: LIVE_QUIZ_ID,
            eventType: 'SUBMISSION_PERSISTED',
          },
        })
      ).toBe(0)
    })

    it('rejects a response submitted after the block closed', async () => {
      const testHarness = harness()
      testHarness.dependencies.redis.hgetall.mockResolvedValue({
        ...testHarness.info,
        blockClosedAt: String(Date.parse('2026-08-12T11:59:59.000Z')),
      })

      await expect(
        processAssessmentResponse(
          command(),
          testHarness.context,
          testHarness.dependencies
        )
      ).rejects.toThrow('SUBMISSION_AFTER_BLOCK_CLOSE')

      expect(
        await prisma.liveQuizResponse.count({ where: { instanceId } })
      ).toBe(0)
      const rejection =
        await prisma.assessmentAuditOutboxEvent.findFirstOrThrow({
          where: {
            liveQuizId: LIVE_QUIZ_ID,
            eventType: 'SUBMISSION_REJECTED',
          },
          select: { canonicalEnvelope: true },
        })
      expect(rejection.canonicalEnvelope).toContain(
        'SUBMISSION_AFTER_BLOCK_CLOSE'
      )
    })

    it('rejects an unknown participant without persisting a response', async () => {
      const testHarness = harness()

      await expect(
        processAssessmentResponse(
          command({ participantId: UNKNOWN_PARTICIPANT_ID }),
          testHarness.context,
          testHarness.dependencies
        )
      ).rejects.toThrow('PARTICIPATION_NOT_FOUND')

      expect(
        await prisma.liveQuizResponse.count({ where: { instanceId } })
      ).toBe(0)
      expect(
        await prisma.assessmentAuditOutboxEvent.count({
          where: {
            liveQuizId: LIVE_QUIZ_ID,
            participantId: UNKNOWN_PARTICIPANT_ID,
            eventType: 'SUBMISSION_REJECTED',
          },
        })
      ).toBe(1)
    })

    it('records recovery when a retry succeeds after transient processing failure', async () => {
      const testHarness = harness()
      testHarness.dependencies.redis.hgetall
        .mockRejectedValueOnce(new Error('synthetic Redis outage'))
        .mockResolvedValue(testHarness.info)

      await expect(
        processAssessmentResponse(
          command(),
          testHarness.context,
          testHarness.dependencies
        )
      ).rejects.toThrow('synthetic Redis outage')

      const result = await processAssessmentResponse(
        command(),
        testHarness.context,
        testHarness.dependencies
      )

      expect(result.status).toBe(200)
      expect(
        await prisma.assessmentAuditOutboxEvent.count({
          where: {
            liveQuizId: LIVE_QUIZ_ID,
            eventType: 'SUBMISSION_PROCESSING_FAILED',
          },
        })
      ).toBe(1)
      expect(
        await prisma.assessmentAuditOutboxEvent.count({
          where: {
            liveQuizId: LIVE_QUIZ_ID,
            eventType: 'SUBMISSION_PROCESSING_RECOVERED',
          },
        })
      ).toBe(1)
    })

    it('rolls back response persistence when authoritative evidence cannot be created', async () => {
      const testHarness = harness()
      const validNow = new Date('2026-08-12T12:00:01.000Z')
      testHarness.dependencies.now = vi
        .fn()
        .mockReturnValueOnce(validNow)
        .mockReturnValueOnce(validNow)
        .mockReturnValueOnce(new Date('2026-08-12T11:59:59.000Z'))
        .mockReturnValue(validNow)

      await expect(
        processAssessmentResponse(
          command(),
          testHarness.context,
          testHarness.dependencies
        )
      ).rejects.toBeDefined()

      expect(
        await prisma.liveQuizResponse.count({ where: { instanceId } })
      ).toBe(0)
      expect(
        await prisma.assessmentAuditOutboxEvent.count({
          where: {
            liveQuizId: LIVE_QUIZ_ID,
            eventType: 'SUBMISSION_PERSISTED',
          },
        })
      ).toBe(0)
      expect(
        await prisma.assessmentAuditOutboxEvent.count({
          where: {
            liveQuizId: LIVE_QUIZ_ID,
            eventType: 'SUBMISSION_PROCESSING_FAILED',
          },
        })
      ).toBe(1)
    })

    it('keeps submission evidence pending during an append outage and drains it after recovery', async () => {
      const testHarness = harness()
      await processAssessmentResponse(
        command(),
        testHarness.context,
        testHarness.dependencies
      )

      const repository = new PrismaAuditOutboxRepository(prisma)
      const outage = await dispatchAssessmentAuditOutbox({
        repository,
        sink: {
          append: vi.fn().mockRejectedValue(new Error('synthetic outage')),
        },
        workerId: 'layer-5-outage-proof',
        now: () => new Date('2026-08-13T12:05:00.000Z'),
        random: () => 0,
        maxBatches: 1,
      })

      expect(outage).toMatchObject({ claimed: 4, delivered: 0, retried: 4 })
      expect(
        await prisma.assessmentAuditOutboxEvent.count({
          where: {
            liveQuizId: LIVE_QUIZ_ID,
            deliveryState: 'PENDING',
          },
        })
      ).toBe(4)

      const append = vi.fn().mockResolvedValue({
        outcome: 'CREATED',
        durableReceiptId: 'synthetic',
      })
      const recovery = await dispatchAssessmentAuditOutbox({
        repository,
        sink: { append },
        workerId: 'layer-5-recovery-proof',
        now: () => new Date('2026-08-13T12:10:00.000Z'),
        maxBatches: 1,
      })

      expect(recovery).toMatchObject({ claimed: 4, delivered: 4, retried: 0 })
      expect(append).toHaveBeenCalledTimes(4)
      expect(
        await prisma.assessmentAuditOutboxEvent.count({
          where: {
            liveQuizId: LIVE_QUIZ_ID,
            deliveryState: 'DELIVERED_UNSEALED',
          },
        })
      ).toBe(4)
    })
  }
)
