import {
  gradeQuestionFreeText,
  gradeQuestionNumerical,
} from '@klicker-uzh/grading'
import * as DB from '@klicker-uzh/prisma/client'
import {
  type CaseStudyCaseSolution,
  type ElementResultsCaseStudy,
  type ElementResultsChoices,
  type ElementResultsCode,
  type ElementResultsContent,
  type ElementResultsFlashcard,
  type ElementResultsOpen,
  type ElementResultsSelection,
} from '@klicker-uzh/types'
import { Redis } from 'ioredis'
import { omitBy } from 'remeda'
import { getInitialInstanceResults } from './elements.js'

export async function getCachedBlockResults({
  redisExec,
  activeBlock,
}: {
  redisExec: Redis
  activeBlock: DB.ElementBlock & { elements: DB.ElementInstance[] }
}) {
  const redisMultiLb = redisExec.multi()
  redisMultiLb.hgetall(`lq:${activeBlock.liveQuizId}:lb`)
  redisMultiLb.hgetall(`lq:${activeBlock.liveQuizId}:b:${activeBlock.id}:lb`)
  redisMultiLb.hgetall(`lq:${activeBlock.liveQuizId}:lbTemporary`)
  redisMultiLb.hgetall(
    `lq:${activeBlock.liveQuizId}:b:${activeBlock.id}:lbTemporary`
  )
  const cacheData = await redisMultiLb.exec()

  if (!cacheData) {
    return null
  }

  const mappedResults: any[] = cacheData.map(([_, result]) => result)

  const liveQuizLeaderboard: Record<string, string> = mappedResults[0]
  const blockLeaderboard: Record<string, string> = mappedResults[1]
  const liveQuizLeaderboardTemporary: Record<string, string> = mappedResults[2]
  const blockLeaderboardTemporary: Record<string, string> = mappedResults[3]

  const instanceResults: Record<
    string,
    {
      info: Record<string, string>
      responseHashes: Record<string, string>
      anonymousResults:
        | ElementResultsChoices
        | ElementResultsOpen
        | ElementResultsFlashcard
        | ElementResultsContent
        | ElementResultsCode
        | ElementResultsSelection
    }
  > = {}

  for (const instance of activeBlock.elements) {
    const redisMulti = redisExec.multi()
    redisMulti.hgetall(`lq:${activeBlock.liveQuizId}:i:${instance.id}:info`)
    redisMulti.hgetall(
      `lq:${activeBlock.liveQuizId}:i:${instance.id}:responseHashes`
    )
    redisMulti.hgetall(
      `lq:${activeBlock.liveQuizId}:i:${instance.id}:responses`
    )
    redisMulti.hgetall(`lq:${activeBlock.liveQuizId}:i:${instance.id}:results`)
    const cacheData = await redisMulti.exec()

    if (!cacheData) return
    const mappedResults: any[] = cacheData.map(([_, result]) => result)
    const [info, responseHashes, _, results] = mappedResults

    // TODO: if possible, split up results and anonymous results here (potentially the cache content needs to augmented)
    let anonymousResults:
      | ElementResultsChoices
      | ElementResultsOpen
      | ElementResultsFlashcard
      | ElementResultsContent
      | ElementResultsCode
      | ElementResultsSelection
      | ElementResultsCaseStudy
      | undefined

    if (
      instance.elementType === DB.ElementType.SC ||
      instance.elementType === DB.ElementType.MC ||
      instance.elementType === DB.ElementType.KPRIM
    ) {
      const choices = Object.entries(
        omitBy(results, (_, key) => key === 'participants')
      ).reduce<ElementResultsChoices['choices']>(
        (acc, [responseHash, count]) => {
          return {
            ...acc,
            [responseHash]: (acc[responseHash] ?? 0) + parseInt(count),
          }
        },
        {}
      )

      anonymousResults = {
        choices,
        total: parseInt(results.participants),
      } as ElementResultsChoices
    } else if (
      instance.elementType === DB.ElementType.NUMERICAL ||
      instance.elementType === DB.ElementType.FREE_TEXT
    ) {
      const responses = Object.entries(
        omitBy(results, (_, key) => key === 'participants')
      ).reduce<ElementResultsOpen['responses']>(
        (responses_acc, [responseHash, count]) => {
          let solutions = []
          try {
            solutions =
              'hasSampleSolution' in instance.elementData.options &&
              instance.elementData.options.hasSampleSolution
                ? JSON.parse(info.solutions)
                : []
          } catch (e) {
            console.log(
              'An error occured while parsing the solutions array from the cache:'
            )
            console.error(e)
          }

          const response = responseHashes[responseHash] ?? responseHash
          let grading: number | undefined
          if (solutions && solutions.length > 0) {
            if (instance.elementType === DB.ElementType.NUMERICAL) {
              const exactSolutionsDefined =
                typeof solutions[0] === 'number' ||
                typeof solutions[0] === 'string'
              grading =
                gradeQuestionNumerical({
                  response: parseFloat(String(response)),
                  solutionRanges: exactSolutionsDefined ? undefined : solutions,
                  exactSolutions: exactSolutionsDefined ? solutions : undefined,
                }) ?? undefined
            } else if (instance.elementType === DB.ElementType.FREE_TEXT) {
              grading =
                gradeQuestionFreeText({
                  response,
                  solutions,
                }) ?? undefined
            }
          }

          const updatedResponse = {
            value: responseHashes[responseHash] ?? responseHash,
            count: (responses_acc[responseHash]?.count ?? 0) + parseInt(count),
          }

          return {
            ...responses_acc,
            [responseHash]:
              typeof grading !== 'undefined'
                ? {
                    ...updatedResponse,
                    correct: grading === 1 ? true : false,
                  }
                : updatedResponse,
          }
        },
        {}
      )

      anonymousResults = {
        responses,
        total: parseInt(results.participants),
      } as ElementResultsOpen
    } else if (instance.elementType === DB.ElementType.SELECTION) {
      const initialResults = getInitialInstanceResults(
        instance.elementData
      ) as ElementResultsSelection
      const selections = Object.entries(
        omitBy(results, (_, key) => key === 'participants')
      ).reduce<Record<string, number>>((acc, [answerId, count]) => {
        acc[answerId] = (acc[answerId] ?? 0) + parseInt(count)
        return acc
      }, initialResults.selections)

      anonymousResults = {
        selections,
        total: parseInt(results.participants),
      } as ElementResultsSelection
    } else if (instance.elementType === DB.ElementType.CASE_STUDY) {
      const initialResults = getInitialInstanceResults(
        instance.elementData
      ) as ElementResultsCaseStudy
      const assessments = Object.entries(
        omitBy(results, (_, key) => key === 'participants')
      ).reduce<ElementResultsCaseStudy['assessments']>(
        (assessmentsAcc, [combinedHash, answerCount]) => {
          let solutions: {
            caseId: string
            itemSolutions: CaseStudyCaseSolution[]
          }[] = []
          try {
            solutions =
              'hasSampleSolution' in instance.elementData.options &&
              instance.elementData.options.hasSampleSolution
                ? JSON.parse(info.solutions)
                : []
          } catch (e) {
            console.log(
              'An error occured while parsing the solutions array from the cache:'
            )
            console.error(e)
          }

          const responseValue: number | undefined =
            responseHashes[combinedHash] ?? undefined

          if (responseValue === null || typeof responseValue === 'undefined') {
            console.log('An error occured while parsing the response value:')
            console.error('responseValue: ', responseValue)
            return assessmentsAcc
          }

          // split up combined hash into caseId, itemId, criterionId and responseHash
          const [caseId, itemId, criterionId, responseHash] =
            combinedHash.split(':')

          // if any of the ids or the hash are invalid, skip this response
          if (
            !caseId ||
            !itemId ||
            !criterionId ||
            !responseHash ||
            !responseValue
          ) {
            console.log('An error occured while parsing the combinedHash:')
            console.error('combinedHash: ', combinedHash)
            return assessmentsAcc
          }

          // verify that the corresponding case-item-criterion combination exists in the results
          if (
            typeof assessmentsAcc[caseId]?.[itemId]?.[criterionId] ===
            'undefined'
          ) {
            console.log(
              'An error occured while verifying the case-item-criterion combination:'
            )
            console.error('caseId', caseId)
            console.error('itemId', itemId)
            console.error('criterionId', criterionId)
            return assessmentsAcc
          }

          // only once and selecting all corresponding responses based on the combinedHash
          let grading: number | undefined
          if (solutions && solutions.length > 0) {
            const caseSolutions = solutions.find(
              (solution) => solution.caseId === caseId
            )
            if (caseSolutions) {
              const itemSolution = caseSolutions.itemSolutions.find(
                (itemSolution) => itemSolution.itemId === parseInt(itemId)
              )
              if (itemSolution) {
                const criterionSolution = itemSolution.criteriaSolutions.find(
                  (criterionSolution) =>
                    criterionSolution.criterionId === criterionId
                )
                if (criterionSolution) {
                  grading =
                    responseValue >= criterionSolution.min &&
                    responseValue <= criterionSolution.max
                      ? 1
                      : 0
                }
              }
            }
          }

          assessmentsAcc[caseId][itemId][criterionId] = {
            ...assessmentsAcc[caseId][itemId][criterionId],
            [responseHash]: {
              value: responseValue,
              count: parseInt(answerCount),
              correct:
                typeof grading !== 'undefined'
                  ? grading === 1
                    ? true
                    : false
                  : undefined,
            },
          }

          return assessmentsAcc
        },
        initialResults.assessments
      )

      anonymousResults = {
        assessments,
        total: parseInt(results.participants),
      } as ElementResultsCaseStudy
    } else if (instance.elementType === DB.ElementType.CONTENT) {
      anonymousResults = {
        total: parseInt(results.participants),
      } as ElementResultsChoices
    } else if (instance.elementType === DB.ElementType.CODE) {
      const initialResults = getInitialInstanceResults(
        instance.elementData
      ) as ElementResultsCode
      const tests = Object.fromEntries(
        Object.keys(initialResults.tests).map((id) => {
          const encodedId = encodeURIComponent(id)
          return [
            id,
            {
              passed: parseInt(results[`test:${encodedId}:passed`] ?? '0', 10),
              total: parseInt(results[`test:${encodedId}:total`] ?? '0', 10),
            },
          ]
        })
      )
      anonymousResults = {
        tests,
        total: parseInt(results.participants ?? '0', 10),
      }
    }

    instanceResults[instance.id] = {
      info,
      responseHashes,
      anonymousResults: anonymousResults ?? { total: 0 },
    }
  }

  return {
    liveQuizLeaderboard,
    liveQuizLeaderboardTemporary,
    blockLeaderboard,
    blockLeaderboardTemporary,
    instanceResults,
    activeInstanceIds: activeBlock.elements.map((instance) => instance.id),
  }
}

export async function updateLiveQuizBlockResultsFromCache({
  quizId,
  blockId,
  prisma,
  redisExec,
  redisAssessmentExec,
  updateResults,
  updateLeaderboards,
}: {
  quizId: string
  blockId: number
  prisma: DB.PrismaClient
  redisExec: Redis
  redisAssessmentExec: Redis
  updateResults: boolean
  updateLeaderboards: boolean
}) {
  const quiz = await prisma.liveQuiz.findUnique({
    where: { id: quizId },
    include: {
      course: true,
      activeBlock: { include: { elements: { orderBy: { order: 'asc' } } } },
      blocks: { orderBy: { id: 'asc' } },
    },
  })

  if (!quiz || !quiz.activeBlock) return null

  // if the block is not the active one, return early
  if (quiz.activeBlockId !== blockId) return null

  try {
    const cachedResults = await getCachedBlockResults({
      redisExec: quiz.isAssessmentEnabled ? redisAssessmentExec : redisExec,
      activeBlock: quiz.activeBlock,
    })

    if (!cachedResults) return null

    const {
      instanceResults,
      liveQuizLeaderboard,
      liveQuizLeaderboardTemporary,
      activeInstanceIds,
    } = cachedResults

    // initialize leaderboard variables, which will only be set conditionally
    let regularParticipantLeaderboard: {
      participantId: string
      score: number
    }[] = []
    let temporaryParticipantLeaderboard: {
      participantId: string
      participantUsername: string
      participantAvatar: string | null
      score: number
    }[] = []
    let existingTemporaryLB: {
      participantId: string
      participantUsername: undefined
      participantAvatar: undefined
      score: number
    }[] = []

    // compute all leaderboard related updates only if required
    if (updateLeaderboards) {
      // filter the leaderboard entries to only include those that have a valid participant id
      const {
        regularParticipantLeaderboard: newRegularParticipantLeaderboard,
        temporaryParticipantLeaderboard: newTemporaryParticipantLeaderboard,
      } = (
        await Promise.allSettled(
          Object.entries(liveQuizLeaderboard).map(async ([id, score]) => {
            const participant = await prisma.participant.findUnique({
              where: { id },
              include: {
                participations: quiz.courseId
                  ? { where: { courseId: quiz.courseId } }
                  : { take: 0 },
              },
            })

            if (!participant) return null
            return {
              participantId: id,
              participantUsername: participant.username,
              participantAvatar: participant.avatar,
              gamifiedCourseParticipation:
                !!quiz.courseId &&
                quiz.course?.isGamificationEnabled &&
                !!participant.participations?.[0],
              courseParticipationActive:
                !!quiz.courseId &&
                !!participant.participations?.[0] &&
                participant.participations?.[0].isActive,
              score,
            }
          })
        )
      ).reduce<{
        regularParticipantLeaderboard: {
          participantId: string
          score: number
        }[]
        temporaryParticipantLeaderboard: {
          participantId: string
          participantUsername: string
          participantAvatar: string | null
          score: number
        }[]
      }>(
        (acc, result) => {
          // filter out failed requests and those which have a valid gamified course participation,
          // which is not active -> active decision to not be on leaderboard
          if (
            result.status !== 'fulfilled' ||
            !result.value ||
            (result.value.gamifiedCourseParticipation &&
              !result.value.courseParticipationActive)
          ) {
            return acc
          }

          if (result.value.gamifiedCourseParticipation) {
            // active gamified course participation (inactive already filtered) -> regular leaderboard
            acc.regularParticipantLeaderboard.push({
              participantId: result.value.participantId,
              score: parseInt(result.value.score, 10),
            })
          } else {
            // no gamified course participation -> temporary leaderboard
            acc.temporaryParticipantLeaderboard.push({
              participantId: result.value.participantId,
              participantUsername: result.value.participantUsername,
              participantAvatar: result.value.participantAvatar,
              score: parseInt(result.value.score, 10),
            })
          }

          return acc
        },
        {
          regularParticipantLeaderboard: [],
          temporaryParticipantLeaderboard: [],
        }
      )
      regularParticipantLeaderboard = newRegularParticipantLeaderboard
      temporaryParticipantLeaderboard = newTemporaryParticipantLeaderboard

      // filter temporary leaderboard entries to only include those that have a valid temporary leaderboard entry for this live quiz
      // technically, this should not be required, since all ids should be valid, but it is a safety check
      existingTemporaryLB = (
        await Promise.allSettled(
          Object.entries(liveQuizLeaderboardTemporary).map(
            async ([id, score]) => {
              const tempLeadeboardEntry =
                await prisma.temporaryLeaderboardEntry.findUnique({
                  where: { id_quizId: { id, quizId } },
                })

              if (!tempLeadeboardEntry) return null
              return {
                participantId: id,
                participantUsername: undefined,
                participantAvatar: undefined,
                score: parseInt(score, 10),
              }
            }
          )
        )
      ).flatMap((result) => {
        if (result.status !== 'fulfilled' || !result.value) return []
        return [result.value]
      })
    }

    const updatedQuiz = await prisma.liveQuiz.update({
      where: { id: quizId },
      data: {
        activeBlock: { disconnect: true },
        blocks: {
          update: {
            where: { id: blockId },
            data: {
              status: DB.ElementBlockStatus.EXECUTED,
              closedAt: new Date(),
              ...(updateResults
                ? {
                    elements: {
                      update: Object.entries(instanceResults).map(
                        ([id, instanceResult]) => ({
                          where: { id: Number(id) },
                          // update the anonymous results for regular live quizzes and the normal results for assessment live quizzes
                          data: {
                            anonymousResults: quiz.isAssessmentEnabled
                              ? undefined
                              : instanceResult.anonymousResults,
                            results: quiz.isAssessmentEnabled
                              ? instanceResult.anonymousResults
                              : undefined,
                          },
                        })
                      ),
                    },
                  }
                : {}),
            },
          },
        },
        leaderboard:
          quiz.isGamificationEnabled && updateLeaderboards
            ? {
                upsert: regularParticipantLeaderboard.map(
                  ({ participantId, score }) => ({
                    where: {
                      type_participantId_liveQuizId: {
                        type: DB.LeaderboardType.SESSION,
                        participantId,
                        liveQuizId: quizId,
                      },
                    },
                    create: {
                      type: DB.LeaderboardType.SESSION,
                      participant: { connect: { id: participantId } },
                      score,
                      sessionParticipation: quiz.courseId
                        ? {
                            connectOrCreate: {
                              where: {
                                courseId_participantId: {
                                  courseId: quiz.courseId,
                                  participantId,
                                },
                              },
                              create: {
                                course: { connect: { id: quiz.courseId! } },
                                participant: { connect: { id: participantId } },
                              },
                            },
                          }
                        : undefined,
                    },
                    update: { score },
                  })
                ),
              }
            : undefined,
        temporaryLeaderboard:
          quiz.isGamificationEnabled && updateLeaderboards
            ? {
                upsert: [
                  ...temporaryParticipantLeaderboard,
                  ...existingTemporaryLB,
                ].map(
                  ({
                    participantId,
                    participantUsername,
                    participantAvatar,
                    score,
                  }) => ({
                    where: {
                      id_quizId: {
                        id: participantId,
                        quizId,
                      },
                    },
                    create: {
                      id: participantId,
                      username: participantUsername ?? '', // fallback should never be used
                      avatar: participantAvatar ?? undefined,
                      score,
                    },
                    update: { score },
                  })
                ),
              }
            : undefined,
      },
      include: {
        blocks: {
          include: { elements: { orderBy: { order: 'asc' } } },
          orderBy: { order: 'asc' },
        },
      },
    })

    return { updatedQuiz, activeInstanceIds }
  } catch (e) {
    throw e
  }
}
