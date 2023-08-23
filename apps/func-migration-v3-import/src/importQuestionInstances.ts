import { PrismaClient, QuestionInstanceType } from "@klicker-uzh/prisma"
import { QuestionTypeMap, extractString, sliceIntoChunks } from "./utils"
import { getLegacyResults } from "./getLegacyResults"

export const importQuestionInstances = async (
    prisma: PrismaClient,
    importedQuestionInstances: any,
    mappedQuestionIds: Record<string, number>,
    user,
    batchSize: number
  ) => {
    let mappedQuestionInstancesIds: Record<string, number> = {}
    // console.log("questionId: ", Object.values(mappedQuestionIds))
    // TODO: check if it works in azure functions, had to extract it out of the transaction since the multiple read operations caused a deadlock
    const questions = await Promise.all(
      Object.values(mappedQuestionIds).map((questionId) =>
        prisma.question.findUnique({ where: { id: questionId } })
      )
    )
    const questionInstancesInDb = await prisma.questionInstance.findMany()
    const questionInstancesDict: Record<string, any> =
      questionInstancesInDb.reduce((acc, qi) => {
        if (qi.originalId != null) {
          acc[qi.originalId] = qi
        }
        return acc
      }, {})
    // console.log("questions: ", questions)
    const batches = sliceIntoChunks(importedQuestionInstances, batchSize)
    let lostResults: any[] = []
    try {
      for (const batch of batches) {
        await prisma.$transaction(async (prisma) => {
          for (const questionInstance of batch) {
            // console.log("questionInstance to be imported: ", questionInstance)
  
            const questionInstanceExists =
              questionInstancesDict[extractString(questionInstance._id)]
  
            if (questionInstanceExists) {
              console.log(
                'questionInstance already exists: ',
                questionInstanceExists
              )
              mappedQuestionInstancesIds[extractString(questionInstance._id)] =
                questionInstanceExists.id
              continue
            }
  
            let questionData = {}
            let questionId = null
            const question = questions.find(
              (question) =>
                question.id ===
                mappedQuestionIds[extractString(questionInstance.question)]
            )
            // console.log("importQuestionInstances question: ", question)
  
            // TODO: move processQuestionData to shared-components and use it to create questionData
            // TODO: add 'attachments' to relevant questionData types
            if (question) {
              questionData = {
                ...question,
              }
              questionId = question?.id
            }
  
            if (questionInstance.results == null) {
              // lostResults.push(questionInstance)
              // TODO: restore results from legacy db
              questionInstance.results = await getLegacyResults(
                extractString(questionInstance._id)
              )
              console.log(
                'Fetched questionInstanceResults: ',
                questionInstance.results
              )
              if (questionInstance.results == null) {
                lostResults.push(questionInstance)
              }
              console.log(
                'importQuestionInstances restored results: ',
                questionInstance.results
              )
            }
  
            let results = {}
  
            if (questionInstance.results) {
              // console.log("importQuestionInstances questionData.type: ", questionData.type)
              if (questionData.type === 'SC' || questionData.type === 'MC') {
                // console.log("SC/MC questionInstance.results: ", questionInstance.results)
                if (questionInstance.results.CHOICES) {
                  results = questionInstance.results.CHOICES.reduce(
                    (acc, choice, idx) => {
                      acc[idx.toString()] = {
                        count: choice,
                        value: idx.toString(),
                      }
                      return acc
                    },
                    {}
                  )
                }
              } else if (
                questionData.type === QuestionTypeMap['FREE'] ||
                questionData.type === QuestionTypeMap['FREE_RANGE']
              ) {
                // console.log("FREE/FREE_RANGE questionInstance: ", questionInstance)
                if (questionInstance.results.FREE) {
                  let newResults = Object.keys(
                    questionInstance.results.FREE
                  ).reduce((acc, hash) => {
                    acc[extractString(hash)] = questionInstance.results.FREE[hash]
                    return acc
                  }, {})
                  results = { ...results, ...newResults }
                } else if (questionInstance.results.FREE_RANGE) {
                  let newResults = Object.keys(
                    questionInstance.results.FREE_RANGE
                  ).reduce((acc, hash) => {
                    acc[extractString(hash)] =
                      questionInstance.results.FREE_RANGE[hash]
                    return acc
                  }, {})
                  results = { ...results, ...newResults }
                }
              }
            }
            // console.log("importQuestionInstances transformed results: ", results)
  
            const result = {
              data: {
                originalId: extractString(questionInstance._id),
                type: QuestionInstanceType.SESSION,
                questionData: questionData,
                participants: questionInstance.results?.totalParticipants,
                results: results,
                owner: {
                  connect: {
                    id: user.id,
                  },
                },
                question: questionId
                  ? {
                      connect: {
                        id: questionId,
                      },
                    }
                  : undefined,
                //TODO:
                // responses: only import aggregated results
                // blockedParticipants
                // dropped: not relevant for now (für die wahlen wichtig)
              },
            }
            const newQuestionInstance = await prisma.questionInstance.create({
              data: result.data,
            })
  
            mappedQuestionInstancesIds[extractString(questionInstance._id)] =
              newQuestionInstance.id
            // console.log("new questionInstance created: ", newQuestionInstance)
  
            if (questionId) {
              await prisma.question.update({
                where: {
                  id: questionId,
                },
                data: {
                  instances: {
                    connect: {
                      id: newQuestionInstance.id,
                    },
                  },
                },
              })
            }
          }
        })
      }
    } catch (error) {
      console.log(
        'Something went wrong while importing question instances: ',
        error
      )
    }
    // console.log("mappedQuestionInstancesIds: ", mappedQuestionInstancesIds)
    console.log('lostResults: ', lostResults)
    console.log('lostResults.length: ', lostResults.length)
    return mappedQuestionInstancesIds
}