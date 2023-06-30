import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { AccessMode, PrismaClient, QuestionInstanceType, SessionBlockStatus, SessionStatus, Tag } from '../client';
import { QuestionType } from '@klicker-uzh/prisma'

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

const importTags = async (prisma: PrismaClient, tags: any, user) => {
    let mappedTags: Record<string, Record<string, string | number>> = {}
    try {
        await prisma.$transaction( async (prisma) => {
            for (const tag of tags) {
                const newTag = await prisma.tag.upsert({
                    where: {
                        ownerId_name: {
                            ownerId: user.id,
                            name: tag.name
                        }
                    },
                    update: {},
                    create: {
                        name: tag.name,
                        owner: {
                            connect: {
                                id: user.id
                        }
                    }
                }})
                console.log("new tag created: ", newTag)
                const extractedId = extractString(tag._id)
                console.log("tag._id: ", extractedId)
                mappedTags[extractedId] = {id: newTag.id, name: newTag.name}
            }
            console.log("mappedTagIds: ", mappedTags)
         })
    } catch (error) {
        console.log("Something went wrong while importing tags: ", error)
    }
    return mappedTags
}

const importQuestions = async (prisma: PrismaClient, importedQuestions: any, mappedTags: Record<string, Record<string, string | number>>, user) => {
    let mappedQuestionIds: Record<string, number> = {}
    try {
        await prisma.$transaction( async (prisma) => {
            for (const question of importedQuestions) {
                console.log("question to be imported: ", question)

                const result = {
                    data: {
                        name: question.title,
                        type: QuestionTypeMap[question.type],
                        content: question.versions.content,
                        options: {},
                        hasSampleSolution: false,
                        tags: {
                            connect: question.tags.map((oldTagId) => {
                                const tagName = mappedTags[extractString(oldTagId)].name;
                                return {
                                    ownerId_name: {
                                        ownerId: user.id,
                                        name: tagName
                                    }
                                };
                            })
                        },
                        owner: {
                            connect: {
                                id: user.id
                            },
                        }
                    }
                }

                if (['SC', 'MC'].includes(question.type)) {
                    result.data.options = {
                      choices: question.versions.options[question.type].choices.map(
                        (choice, ix) => {
                            console.log("SC/MC choice: ", choice)
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
                    console.log("FREE_RANGE question.FREE_RANGE: ", question.versions.options.FREE_RANGE)
                    result.data.options = {
                        restrictions: {
                        min: question.versions.options.FREE_RANGE?.restrictions.min ?? undefined,
                        max: question.versions.options.FREE_RANGE?.restrictions.max ?? undefined,
                        },
                        solutions: [],
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
                    data: result.data
                })
                mappedQuestionIds[extractString(question._id)] = newQuestion.id
                console.log("new question created: ", newQuestion)
            }
        })
    } catch (error) {
        console.log("Something went wrong while importing questions: ", error)
    }
    console.log("mappedQuestionIds: ", mappedQuestionIds)
    return mappedQuestionIds
}

const importQuestionInstances = async (prisma: PrismaClient, importedQuestionInstances: any, mappedQuestionIds: Record<string, number>, user) => {
    let mappedQuestionInstancesIds: Record<string, number> = {}
    try {
        await prisma.$transaction( async (prisma) => {
            for (const questionInstance of importedQuestionInstances) {
                console.log("questionInstance to be imported: ", questionInstance)

                let questionData = {}
                let questionId = null
                // TODO: import deleted questions as well and delete them at the end (needed for questionData) or think whether
                // there is another way, e.g., by including the deleted questions in exported json file and constructing questionData based on that question object
                // Questions that had 'isDeleted' set to true in v2 are currently not imported --> should I change that?
                if (mappedQuestionIds[extractString(questionInstance.question)]) {
                    const question = await prisma.question.findUnique({
                        where: { id: mappedQuestionIds[extractString(questionInstance.question)] }
                    })
                    console.log("importQuestionInstances question: ", question)
    
                    // TODO: move processQuestionData to shared-components and use it to create questionData
                    questionData = {
                        id: question?.id,
                        name: question?.name,
                        type: question?.type,
                        content: question?.content,
                        options: question?.options,
                        hasSampleSolution: question?.hasSampleSolution,
                        hasAnswerFeedbacks: question?.hasAnswerFeedbacks,
                        ownerId: question?.ownerId,
                        isDeleted: question?.isDeleted,
                        isArchived: question?.isArchived,
                        displayMode: question?.displayMode,
                        explanation: question?.explanation,
                        pointsMultiplier: question?.pointsMultiplier,
                    }
                    questionId = question?.id
                }
                console.log("importQuestionInstances mappedQuestionIds: ", mappedQuestionIds)
                console.log("importQuestionInstances questionInstance.question: ", extractString(questionInstance.question))
                
                console.log("importQuestionInstances questionData: ", questionData)

                const results = questionInstance.results && questionInstance.results.CHOICES
                    ? questionInstance.results.CHOICES.reduce((acc, choice, idx) => {
                        acc[idx.toString()] = choice;
                        return acc;
                    }, {})
                    : {};


                const result = {
                    data: {
                        type: QuestionInstanceType.SESSION,
                        questionData: questionData,
                        participants: questionInstance.results?.totalParticipants,
                        results: results,
                        owner: {
                            connect: {
                                id: user.id
                            }
                        },
                        question: questionId ? {
                            connect: {
                                id: questionId
                            }
                        } : undefined,
                        //TODO: 
                        // responses: only import aggregated results
                        // blockedParticipants
                        // dropped: not relevant for now (für die wahlen wichtig)
                    }
                }
                const newQuestionInstance = await prisma.questionInstance.create({
                    data: result.data
                })

                mappedQuestionInstancesIds[extractString(questionInstance._id)] = newQuestionInstance.id
                console.log("new questionInstance created: ", newQuestionInstance)

                if (questionId) {
                    await prisma.question.update({
                        where: {
                            id: questionId
                        },
                        data: {
                            instances: {
                                connect: {
                                    id: newQuestionInstance.id
                                }
                            }
                        }
                    })
                }
            }
        })
    }
    catch (error) {
        console.log("Something went wrong while importing question instances: ", error)
    }
    console.log("mappedQuestionInstancesIds: ", mappedQuestionInstancesIds)
    return mappedQuestionInstancesIds
}

const getSessionBlockStatus = (status: string) => {
    switch (status) {
        case "PLANNED":
            return SessionBlockStatus.SCHEDULED
        case "ACTIVE":
            return SessionBlockStatus.ACTIVE
        case "EXECUTED":
            return SessionBlockStatus.EXECUTED
    }
}

const getSessionStatus = (status: string) => {
    switch (status) {
        case "CREATED":
            return SessionStatus.PREPARED
        case "COMPLETED":
            return SessionStatus.COMPLETED
    }
}

const importSessions = async (prisma: PrismaClient, importedSessions: any, mappedQuestionInstanceIds: Record<string, number>, user) => {
    //new uuid is generated for each session -> string
    let mappedSessionIds: Record<string, string> = {}
    try {
        await prisma.$transaction(async (prisma) => {
            for (const session of importedSessions) {
                console.log("session to be imported: ", session);

                const newSession = await prisma.session.create({
                    data: {
                        namespace: session.namespace,
                        name: session.name,
                        displayName: session.name, // no displayName in v2
                        accessMode: session.settings.isParticipantAuthenticationEnabled ? AccessMode.RESTRICTED : AccessMode.PUBLIC ,
                        isConfusionFeedbackEnabled: session.settings.isConfusionBarometerActive,
                        isLiveQAEnabled: session.settings.isFeedbackChannelActive,
                        isModerationEnabled: !session.settings.isFeedbackChannelPublic,
                        // imported sessions will either be prepared or completed (no active or paused sessions)
                        status: getSessionStatus(session.status),
                        // participants: --> skip
                        createdAt: new Date(extractString(session.createdAt)),
                        updatedAt: new Date(extractString(session.updatedAt)),
                        startedAt: session.startedAt ? new Date(extractString(session.startedAt)) : null,
                        finishedAt: session.finishedAt ? new Date(extractString(session.finishedAt)) : null,
                        // activeBlock: difference 0 and -1? e.g., -1 == nicht gestartet and 0 is first element of list? -->!! null? da keine session "running" sein wird
                        // blocks: check SessionBlock -> activeInSession ??
                        // no activeSteps in v3 -> sessions will either be prepared or completed
                        // no activeInstances: QuestionInstance[] in v3 kein link da nichts mehr aktiv sein wird: sessions will either be prepared or completed
                        // activeInstances? only one possible in v3? kein link da nichts mehr aktiv sein wird: sessions will either be prepared or completed
                        owner: {
                            connect: {
                                id: user.id
                            }
                        },
                        // nested writes for entities that have not circular dependencies
                        feedbacks: {
                            create: session.feedbacks.map((feedback) => ({
                                isPublished: feedback.published,
                                isPinned: feedback.pinned,
                                isResolved: feedback.resolved,
                                votes: feedback.votes,
                                content: feedback.content,
                                responses: {
                                    create: feedback.responses.map((response) => ({
                                        content: response.content,
                                        positiveReactions: response.positiveReactions,
                                        negativeReactions: response.negativeReactions,
                                        createdAt: new Date(extractString(response.createdAt)),
                                        updatedAt: new Date(extractString(response.updatedAt))
                                    }))
                                },
                                createdAt: new Date(extractString(feedback.createdAt)),
                                updatedAt: new Date(extractString(feedback.updatedAt))
                            }))
                        },
                        confusionFeedbacks: {
                            create: session.confusionTS.map((confusionFeedback) => ({
                                difficulty: confusionFeedback.difficulty,
                                speed: confusionFeedback.speed,
                                createdAt: new Date(extractString(confusionFeedback.createdAt)),
                                updatedAt: new Date(extractString(confusionFeedback.updatedAt))
                            }))
                        },
                        blocks: {
                            create: session.blocks.map(
                              (sessionBlock, blockIx) => {
                                const instances = sessionBlock.instances.map((instanceId) => ({
                                    id: mappedQuestionInstanceIds[extractString(instanceId)]
                                }));
                     
                                return {
                                  order: blockIx,
                                  randomSelection: sessionBlock.randomSelection !== -1 ? sessionBlock.randomSelection : null, 
                                  timeLimit: sessionBlock.timeLimit !== -1 ? sessionBlock.timeLimit : null, 
                                  execution: sessionBlock.execution !== -1 ? sessionBlock.execution : null, 
                                  status: getSessionBlockStatus(sessionBlock.status), 
                                  instances: {
                                    connect: instances,
                                  },
                                  createdAt: new Date(extractString(sessionBlock.createdAt)),
                                  updatedAt: new Date(extractString(sessionBlock.updatedAt)),
                                }
                              }
                            ),
                          },
                    },
                    include: {
                        blocks: {
                            include: {
                                instances: true
                            }
                        }
                    }
                });
                mappedSessionIds[extractString(session._id)] = newSession.id;

                // Update sessionBlockId of each QuestionInstance connected to the newly created SessionBlock
                for (const block of newSession.blocks) {
                    for (const instance of block.instances) {
                        await prisma.questionInstance.update({
                            where: { id: instance.id },
                            data: { sessionBlockId: block.id }
                        });
                    }
                }
                console.log("new session created: ", newSession);
            }
        });
    } catch (error) {
        console.log("Something went wrong while importing sessions: ", error);
    }
    return mappedSessionIds;
}

const importV2Data = async () => {

    // Temporary code to retrieve exported data on local machine
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    // construct relative path to desired json file
    // __dirname provides the current directory name of the current file
    const dirPath = path.join(__dirname, '../../../../migration/export_v2_data/exported_json_files');
    const filePath = path.join(dirPath, 'exported_data_2023-06-30_13-19-01.json');

    let importData;
    if (fs.existsSync(dirPath)) {
        if (fs.existsSync(filePath)) {
            const fileContent = fs.readFileSync(filePath, 'utf8')
            importData = JSON.parse(fileContent)
            console.log("exportData: ", importData)
        } else {
            console.log("File does not exist: ", filePath)
        }
    } else {
        console.log("Directory does not exist: ", dirPath)
    }

    if (!importData) {
    console.log("No data to import")
    throw new Error("No data to import")
    }


    // START IMPORT
    try {
        const email = "lecturer@bf.uzh.ch"
        const prisma = new PrismaClient()
    
        const user = await prisma.user.findUnique({
            where: {
                email
            }
        })
    
        if (!user) {
            throw new Error('User not found')
        }
        
        console.log("user found: ", user)
    
        // keep information in memory for more efficient lookup
        let mappedTags: Record<string, Record<string, string | number>> = {}
        let mappedQuestionIds: Record<string, number> = {}
        let mappedQuestionInstancesIds: Record<string, number> = {}
        //new uuid is generated for each session -> string
        let mappedSessionIds: Record<string, string> = {}
    
        // import tags
        const tags = importData.tags
        mappedTags = await importTags(prisma, tags, user)
        
        const importedQuestions = importData.questions
        mappedQuestionIds = await importQuestions(prisma, importedQuestions, mappedTags, user)

        const importedQuestionInstances = importData.questioninstances
        mappedQuestionInstancesIds = await importQuestionInstances(prisma, importedQuestionInstances, mappedQuestionIds, user)
    
        const importedSessions = importData.sessions
        mappedSessionIds = await importSessions(prisma, importedSessions, mappedQuestionInstancesIds, user)
        
    } catch (error) {
        console.log("Something went wrong while importing data: ", error)
    }
}

importV2Data()