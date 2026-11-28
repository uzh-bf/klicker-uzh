import { prisma } from '@klicker-uzh/prisma'
import * as DB from '@klicker-uzh/prisma/client'
import {
  startAdaptivePracticeQuizAttempt,
  submitAdaptivePracticeQuizResponse,
} from '../src/services/adaptivePracticeQuizzes.js'
import { itWithAdaptiveEngine } from './adaptiveEngineTestEnv.js'
import {
  contextFor,
  createRuntimeFixture,
} from './adaptivePracticeQuizRuntimeTestSupport.js'

// The reference engine computes at most four requests at once per instance
// and answers 503 beyond that. Eight participants therefore exercise both the
// database locking and the client's bounded overload retry.
const CLASS_SIZE = 8

// Settle every request before asserting so no transaction is still running
// when the next test truncates the fixture tables.
async function settleAll<T>(requests: Array<T | Promise<T>>): Promise<T[]> {
  const outcomes = await Promise.allSettled(requests)
  const failures = outcomes.flatMap((outcome) =>
    outcome.status === 'rejected'
      ? [
          (outcome.reason as { extensions?: { code?: string } }).extensions
            ?.code ?? String(outcome.reason),
        ]
      : []
  )
  expect(failures).toEqual([])
  return outcomes.map((outcome) => (outcome as PromiseFulfilledResult<T>).value)
}

async function enrollClass(
  fixture: Awaited<ReturnType<typeof createRuntimeFixture>>,
  size: number
) {
  const participantIds = [fixture.participantId]
  for (let index = 1; index < size; index++) {
    const participant = await prisma.participant.create({
      data: { username: `adaptive-concurrency-${index}`, password: 'test' },
    })
    await prisma.participation.create({
      data: { courseId: fixture.courseId, participantId: participant.id },
    })
    participantIds.push(participant.id)
  }
  return participantIds.map((id) => contextFor(id, DB.UserRole.PARTICIPANT))
}

export function registerAdaptivePracticeQuizConcurrencyTests() {
  itWithAdaptiveEngine.each([
    DB.AdaptiveMeasurementVersion.IRT_V1,
    DB.AdaptiveMeasurementVersion.IRT_V2_EAP_GRID_1,
  ])(
    'starts and answers attempts of different participants in parallel without conflicts (%s)',
    async (measurementVersion) => {
      const fixture = await createRuntimeFixture({ measurementVersion })
      const contexts = await enrollClass(fixture, CLASS_SIZE)

      // The whole class starts together, then answers in lockstep rounds so
      // every round has CLASS_SIZE submits racing on the same publication.
      let states = await settleAll(
        contexts.map((ctx) =>
          startAdaptivePracticeQuizAttempt(
            { practiceQuizId: fixture.quizId },
            ctx
          )
        )
      )
      while (
        states.some(
          ({ status }) =>
            status === DB.AdaptivePracticeQuizAttemptStatus.IN_PROGRESS
        )
      ) {
        states = await settleAll(
          states.map((state, index) =>
            state.status === DB.AdaptivePracticeQuizAttemptStatus.IN_PROGRESS
              ? submitAdaptivePracticeQuizResponse(
                  {
                    attemptId: state.attemptId,
                    servedItemId: state.servedItem!.poolItemId,
                    response: { choiceIndices: [index % 2] },
                  },
                  contexts[index]!
                )
              : state
          )
        )
      }

      const attempts = await prisma.adaptivePracticeQuizAttempt.findMany({
        where: { practiceQuizId: fixture.quizId },
        include: { responses: { orderBy: { order: 'asc' } } },
      })
      expect(attempts).toHaveLength(CLASS_SIZE)
      expect(
        new Set(attempts.map(({ participantId }) => participantId)).size
      ).toBe(CLASS_SIZE)
      for (const attempt of attempts) {
        expect(attempt.status).toBe(
          DB.AdaptivePracticeQuizAttemptStatus.COMPLETED
        )
        expect(attempt.responses.map(({ order }) => order)).toEqual(
          attempt.responses.map((_, index) => index + 1)
        )
      }

      if (
        measurementVersion === DB.AdaptiveMeasurementVersion.IRT_V2_EAP_GRID_1
      ) {
        // Exposure counters are shared by every attempt of the publication;
        // they must stay exact when the class answers concurrently.
        const exposures =
          await prisma.adaptivePracticeQuizItemExposure.findMany({
            where: { publicationId: fixture.publicationIdentity.publicationId },
          })
        const responseCount = BigInt(
          attempts.reduce((sum, { responses }) => sum + responses.length, 0)
        )
        expect(
          exposures.reduce((sum, { servedCount }) => sum + servedCount, 0n)
        ).toBe(responseCount)
        expect(
          exposures.reduce((sum, { answeredCount }) => sum + answeredCount, 0n)
        ).toBe(responseCount)
      }
    }
  )

  itWithAdaptiveEngine(
    'accepts exactly one of two parallel submits for the same served item',
    async () => {
      const fixture = await createRuntimeFixture()
      const participantCtx = contextFor(
        fixture.participantId,
        DB.UserRole.PARTICIPANT
      )
      const started = await startAdaptivePracticeQuizAttempt(
        { practiceQuizId: fixture.quizId },
        participantCtx
      )
      const submit = () =>
        submitAdaptivePracticeQuizResponse(
          {
            attemptId: started.attemptId,
            servedItemId: started.servedItem!.poolItemId,
            response: { choiceIndices: [0] },
          },
          participantCtx
        )

      const outcomes = await Promise.allSettled([submit(), submit(), submit()])

      const accepted = outcomes.filter(
        (outcome) => outcome.status === 'fulfilled'
      )
      const rejected = outcomes.flatMap((outcome) =>
        outcome.status === 'rejected' ? [outcome.reason] : []
      )
      expect(accepted).toHaveLength(1)
      expect(rejected).toHaveLength(2)
      for (const reason of rejected) {
        expect(reason).toMatchObject({
          extensions: {
            code: expect.stringMatching(
              /^ADAPTIVE_(RESPONSE_ALREADY_SUBMITTED|ITEM_NOT_SERVED)$/
            ),
          },
        })
      }
      const responses = await prisma.adaptivePracticeQuizResponse.findMany({
        where: { attemptId: started.attemptId },
      })
      expect(responses.map(({ order }) => order)).toEqual([1])
      expect(responses[0]!.poolItemId).toBe(started.servedItem!.poolItemId)
    }
  )
}
