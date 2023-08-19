import { BlobServiceClient } from '@azure/storage-blob'
import {
  AccessMode,
  PrismaClient,
  QuestionInstanceType,
  QuestionType,
  SessionBlockStatus,
  SessionStatus,
} from '@klicker-uzh/prisma'
import axios from 'axios'
import fs from 'fs'
import path from 'path'
import { closeLegacyConnection, getLegacyResults } from './getLegacyResults'

// TODOs:
// - Test UI after import
// - Compare DB with DIFF tools

// used to extract the string (e.g., objectId, createdAt, etc.) inside "\"...\""
const extractString = (stringItem: string) => {
  const pattern = /"(.*)"/
  const match = stringItem.match(pattern)

  return match ? match[1] : stringItem
}

const QuestionTypeMap: Record<string, QuestionType> = {
  SC: 'SC',
  MC: 'MC',
  FREE_RANGE: 'NUMERICAL',
  FREE: 'FREE_TEXT',
}

function sliceIntoChunks(array: any[], chunkSize: number) {
  const result = []
  let index = 0
  while (index < array.length) {
    result.push(array.slice(index, index + chunkSize))
    index += chunkSize
  }
  return result
}

//TODO: test and finish implementation
const migrateFiles = async (files: any) => {
  let mappedFileURLs: Record<string, Record<string, string>> = {}
  try {
    // setup Azure Blob Storage client
    const account = process.env.NEXT_PUBLIC_AZURE_STORAGE_ACCOUNT_NAME
    const containerName = process.env.NEXT_PUBLIC_AZURE_CONTAINER_NAME
    const sasToken = process.env.AZURE_SAS_TOKEN
    console.log('containerName: ', containerName)
    console.log('sasToken.length: ', sasToken?.length)
    const blobServiceClient = new BlobServiceClient(
      `https://${account}.blob.core.windows.net?${sasToken}`
    )

    const containerClient = blobServiceClient.getContainerClient(containerName)

    for (const file of files) {
      // download file with public link
      const response = await axios.get(
        `https://tc-klicker-prod.s3.amazonaws.com/images/${file.name}`,
        { responseType: 'arraybuffer' }
      )

      // upload file to azure blob storage
      // TODO: discuss if we want to use the original file name or the uuid --> original file name overwrites if not unique
      const blockBlobClient = containerClient.getBlockBlobClient(file.name)

      await blockBlobClient.uploadData(response.data, {
        blockSize: 4 * 1024 * 1024, // 4MB block size
      })

      const publicUrl = blockBlobClient.url.split('?')[0]
      console.log('publicUrl for file.name: ', file.name, ' is: ', publicUrl)
      mappedFileURLs[extractString(file._id)] = {
        url: publicUrl,
        originalName: file.originalName,
      }
    }
  } catch (error) {
    console.log('Something went wrong while importing files: ', error)
  }

  return mappedFileURLs
}

const importTags = async (
  prisma: PrismaClient,
  tags: any,
  user,
  batchSize: number
) => {
  let mappedTags: Record<string, Record<string, string | number>> = {}
  const tagsInDb = await prisma.tag.findMany()
  const tagsDict: Record<string, any> = tagsInDb.reduce((acc, t) => {
    if (t.originalId != null) {
      acc[t.originalId] = t
    }
    return acc
  }, {})
  const batches = sliceIntoChunks(tags, batchSize)
  try {
    for (const batch of batches) {
      await prisma.$transaction(async (prisma) => {
        for (const tag of batch) {
          const tagExists = tagsDict[extractString(tag._id)]

          if (tagExists) {
            console.log('tag already exists: ', tagExists)
            mappedTags[extractString(tag._id)] = {
              id: tagExists.id,
              name: tagExists.name,
            }
            continue
          }

          const newTag = await prisma.tag.upsert({
            where: {
              ownerId_name: {
                ownerId: user.id,
                name: tag.name,
              },
            },
            update: {},
            create: {
              name: tag.name,
              originalId: extractString(tag._id),
              owner: {
                connect: {
                  id: user.id,
                },
              },
            },
          })
          // console.log("new tag created: ", newTag)
          const extractedId = extractString(tag._id)
          // console.log("tag._id: ", extractedId)
          mappedTags[extractedId] = { id: newTag.id, name: newTag.name }
        }
        // console.log("mappedTagIds: ", mappedTags)
      })
    }
  } catch (error) {
    console.log('Something went wrong while importing tags: ', error)
  }
  return mappedTags
}

const importQuestions = async (
  prisma: PrismaClient,
  importedQuestions: any,
  mappedTags: Record<string, Record<string, string | number>>,
  user,
  batchSize: number,
  mappedFileURLs: Record<string, Record<string, string>>
) => {
  let mappedQuestionIds: Record<string, number> = {}
  const questionsInDb = await prisma.question.findMany()

  const questionsDict: Record<string, any> = questionsInDb.reduce(
    (acc, cur) => {
      if (cur.originalId != null) {
        acc[cur.originalId] = cur
      }
      return acc
    },
    {}
  )

  const batches = sliceIntoChunks(importedQuestions, batchSize)
  try {
    for (const batch of batches) {
      await prisma.$transaction(async (prisma) => {
        for (const question of batch) {
          // console.log("question to be imported: ", question)
          const questionExists = questionsDict[extractString(question._id)]

          if (questionExists) {
            console.log('question already exists: ', questionExists)
            mappedQuestionIds[extractString(question._id)] = questionExists.id
            continue
          }

          const result = {
            data: {
              originalId: extractString(question._id),
              name: question.title,
              type: QuestionTypeMap[question.type],
              content:
                question.versions.content +
                (question.versions.files?.length > 0
                  ? '\n' +
                    question.versions.files
                      .map(
                        (fileId: string) =>
                          `![${
                            mappedFileURLs[extractString(fileId)].originalName
                          }](${mappedFileURLs[extractString(fileId)].url})`
                      )
                      .join('\n\n') +
                    '\n'
                  : ''),
              options: {},
              hasSampleSolution: false,
              isDeleted: question.isDeleted,
              isArchived: question.isArchived,
              tags: {
                connect: question.tags.map((oldTagId) => {
                  const tagName = mappedTags[extractString(oldTagId)].name
                  return {
                    ownerId_name: {
                      ownerId: user.id,
                      name: tagName,
                    },
                  }
                }),
              },
              owner: {
                connect: {
                  id: user.id,
                },
              },
            },
          }

          if (['SC', 'MC'].includes(question.type)) {
            result.data.options = {
              choices: question.versions.options[question.type].choices.map(
                (choice, ix) => {
                  // console.log("SC/MC choice: ", choice)
                  if (choice.correct) result.data.hasSampleSolution = true
                  return {
                    ix,
                    value: choice.name,
                    correct: choice.correct,
                    feedback: '',
                  }
                }
              ),
            }
            // return result
          } else if (question.type === 'FREE_RANGE') {
            // throw new Error('Unsupported question type NR')
            // console.log("FREE_RANGE question.FREE_RANGE: ", question.versions.options.FREE_RANGE)
            const restrictions =
              question.versions.options.FREE_RANGE?.restrictions
            // console.log("restrictions: ", restrictions)
            if (!restrictions) {
              result.data.options = {
                restrictions: undefined,
                solutions: [],
                solutionRanges: [],
              }
            } else {
              result.data.options = {
                restrictions: {
                  min: restrictions.min !== null ? restrictions.min : undefined,
                  max: restrictions.max !== null ? restrictions.max : undefined,
                },
                solutions: [],
                solutionRanges: [],
              }
            }
            // return result
          } else if (question.type === 'FREE') {
            result.data.options = {
              restrictions: {},
              solutions: [],
            }
            // return result
          } else {
            throw new Error('Unknown question type')
          }

          const newQuestion = await prisma.question.create({
            data: result.data,
          })
          mappedQuestionIds[extractString(question._id)] = newQuestion.id
          // console.log("new question created: ", newQuestion)
        }
      })
    }
  } catch (error) {
    console.log('Something went wrong while importing questions: ', error)
  }
  // console.log("mappedQuestionIds: ", mappedQuestionIds)
  return mappedQuestionIds
}

const importQuestionInstances = async (
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

const getSessionBlockStatus = (status: string) => {
  switch (status) {
    case 'PLANNED':
      return SessionBlockStatus.SCHEDULED
    case 'ACTIVE':
      return SessionBlockStatus.ACTIVE
    case 'EXECUTED':
      return SessionBlockStatus.EXECUTED
  }
}

const getSessionStatus = (status: string) => {
  switch (status) {
    case 'CREATED':
      return SessionStatus.PREPARED
    case 'COMPLETED':
      return SessionStatus.COMPLETED
  }
}

const importSessions = async (
  prisma: PrismaClient,
  importedSessions: any,
  mappedQuestionInstanceIds: Record<string, number>,
  user,
  batchSize: number
) => {
  //new uuid is generated for each session -> string
  let mappedSessionIds: Record<string, string> = {}
  const sessionsInDb = await prisma.liveSession.findMany()
  console.log('#sessionsInDb: ', sessionsInDb.length)
  const sessionsDict: Record<string, any> = sessionsInDb.reduce((acc, s) => {
    if (s.originalId != null) {
      acc[s.originalId] = s
    }
    return acc
  }, {})
  const batches = sliceIntoChunks(importedSessions, batchSize)
  try {
    for (const batch of batches) {
      await prisma.$transaction(async (prisma) => {
        for (const session of batch) {
          // console.log("session to be imported: ", session);
          // console.log("session isBeta: ", !!session.isBeta)

          const sessionExists = sessionsDict[extractString(session._id)]

          if (sessionExists) {
            console.log('session already exists: ', sessionExists)
            mappedSessionIds[extractString(session._id)] = sessionExists.id
            continue
          }

          const newSession = await prisma.liveSession.create({
            data: {
              originalId: extractString(session._id),
              namespace: session.namespace,
              name: session.name,
              displayName: session.name, // no displayName in v2
              accessMode: session.settings.isParticipantAuthenticationEnabled
                ? AccessMode.RESTRICTED
                : AccessMode.PUBLIC,
              isConfusionFeedbackEnabled:
                session.settings.isConfusionBarometerActive,
              isLiveQAEnabled: session.settings.isFeedbackChannelActive,
              isModerationEnabled: !session.settings.isFeedbackChannelPublic,
              status: getSessionStatus(session.status), // imported sessions will either be prepared or completed (no active or paused sessions)
              createdAt: new Date(extractString(session.createdAt)),
              updatedAt: new Date(extractString(session.updatedAt)),
              startedAt: session.startedAt
                ? new Date(extractString(session.startedAt))
                : null,
              finishedAt: session.finishedAt
                ? new Date(extractString(session.finishedAt))
                : null,
              // activeBlock: difference 0 and -1? e.g., -1 == nicht gestartet and 0 is first element of list? -->!! null? da keine session "running" sein wird
              // blocks: check SessionBlock -> activeInSession ?? --> NO active sessions will be imported!
              // no activeSteps in v3 -> sessions will either be prepared or completed
              // no activeInstances: QuestionInstance[] in v3 kein link da nichts mehr aktiv sein wird: sessions will either be prepared or completed
              // activeInstances? only one possible in v3? kein link da nichts mehr aktiv sein wird: sessions will either be prepared or completed
              owner: {
                connect: {
                  id: user.id,
                },
              },
              // nested writes for entities that have not circular dependencies
              feedbacks: !!session.isBeta
                ? {
                    create: session.feedbacks.map((feedback) => ({
                      content: feedback.content,
                      votes: feedback.votes,
                      createdAt: new Date(extractString(feedback.createdAt)),
                    })),
                  }
                : {
                    create: session.feedbacks.map((feedback) => ({
                      isPublished: feedback.published,
                      isPinned: feedback.pinned,
                      isResolved: feedback.resolved,
                      votes: feedback.votes,
                      content: feedback.content,
                      responses: {
                        create: feedback.responses?.map((response) => ({
                          content: response.content,
                          positiveReactions: response.positiveReactions,
                          negativeReactions: response.negativeReactions,
                          createdAt: new Date(
                            extractString(response.createdAt)
                          ),
                          updatedAt: new Date(
                            extractString(response.updatedAt)
                          ),
                        })),
                      },
                      createdAt: new Date(extractString(feedback.createdAt)),
                      updatedAt: new Date(extractString(feedback.updatedAt)),
                    })),
                  },
              confusionFeedbacks: {
                create: session.confusionTS.map((confusionFeedback) => ({
                  difficulty: confusionFeedback.difficulty,
                  speed: confusionFeedback.speed,
                  createdAt: new Date(
                    extractString(confusionFeedback.createdAt)
                  ),
                })),
              },
              blocks: {
                create: session.blocks.map((sessionBlock, blockIx) => {
                  const instances = sessionBlock.instances.map(
                    (instanceId) => ({
                      id: mappedQuestionInstanceIds[extractString(instanceId)],
                    })
                  )

                  return {
                    order: blockIx,
                    randomSelection:
                      sessionBlock.randomSelection !== -1
                        ? sessionBlock.randomSelection
                        : null,
                    timeLimit:
                      sessionBlock.timeLimit !== -1
                        ? sessionBlock.timeLimit
                        : null,
                    execution:
                      sessionBlock.execution !== -1
                        ? sessionBlock.execution
                        : 0,
                    status: getSessionBlockStatus(sessionBlock.status),
                    instances: {
                      connect: instances,
                    },
                    createdAt: new Date(extractString(sessionBlock.createdAt)),
                    updatedAt: new Date(extractString(sessionBlock.updatedAt)),
                  }
                }),
              },
            },
            include: {
              blocks: {
                include: {
                  instances: true,
                },
              },
            },
          })
          mappedSessionIds[extractString(session._id)] = newSession.id

          // Update sessionBlockId of each QuestionInstance connected to the newly created SessionBlock
          for (const block of newSession.blocks) {
            for (const instance of block.instances) {
              await prisma.questionInstance.update({
                where: { id: instance.id },
                data: { sessionBlockId: block.id },
              })
            }
          }
          // console.log("new session created: ", newSession);
        }
      })
    }
  } catch (error) {
    console.log('Something went wrong while importing sessions: ', error)
  }
  return mappedSessionIds
}

const importV2Data = async () => {
  // construct relative path to desired json file
  // __dirname provides the current directory name of the current file
  const dirPath = path.join(
    __dirname,
    '../../migration-v2-export/exported_json_files'
  )

  // const filePath = path.join(dirPath, 'exported_data_2023-07-06_17-10-52.json');
  // const filePath = path.join(dirPath, 'exported_data_2023-07-14_10-03-00.json');
  // const filePath = path.join(dirPath, "exported_data_no_questioninstances_results.json");

  // ask the user for a file name on the command line
  const filePath = path.join(
    dirPath,
    process.argv[2] ?? 'exported_data_latest.json'
  )

  let importData
  if (fs.existsSync(dirPath)) {
    if (fs.existsSync(filePath)) {
      const fileContent = fs.readFileSync(filePath, 'utf8')
      importData = JSON.parse(fileContent)
      console.log('exportData: ', importData)
    } else {
      console.log('File does not exist: ', filePath)
    }
  } else {
    console.log('Directory does not exist: ', dirPath)
  }

  if (!importData) {
    console.log('No data to import')
    throw new Error('No data to import')
  }

  // START IMPORT
  try {
    const email = 'lecturer@bf.uzh.ch'
    const prisma = new PrismaClient()

    const user = await prisma.user.findUnique({
      where: {
        email,
      },
    })

    if (!user) {
      throw new Error('User not found')
    }

    console.log('user found: ', user)

    // keep information in memory for more efficient lookup
    let mappedTags: Record<string, Record<string, string | number>> = {}
    let mappedQuestionIds: Record<string, number> = {}
    let mappedQuestionInstancesIds: Record<string, number> = {}
    //new uuid is generated for each session -> string
    let mappedSessionIds: Record<string, string> = {}
    let mappedFileURLs: Record<string, Record<string, string>> = {}

    const batchSize = 50
    mappedFileURLs = await migrateFiles(importData.files)
    console.log('mappedFileURLs: ', mappedFileURLs)
    // import tags
    const tags = importData.tags
    mappedTags = await importTags(prisma, tags, user, batchSize)

    const importedQuestions = importData.questions
    mappedQuestionIds = await importQuestions(
      prisma,
      importedQuestions,
      mappedTags,
      user,
      batchSize,
      mappedFileURLs
    )

    const importedQuestionInstances = importData.questioninstances
    mappedQuestionInstancesIds = await importQuestionInstances(
      prisma,
      importedQuestionInstances,
      mappedQuestionIds,
      user,
      batchSize
    )

    const importedSessions = importData.sessions
    mappedSessionIds = await importSessions(
      prisma,
      importedSessions,
      mappedQuestionInstancesIds,
      user,
      batchSize
    )
    console.log('Successfully imported data')

    closeLegacyConnection()
  } catch (error) {
    console.log('Something went wrong while importing data: ', error)
  }
}

importV2Data()
