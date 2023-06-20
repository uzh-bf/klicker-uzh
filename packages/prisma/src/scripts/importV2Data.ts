import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { PrismaClient, Tag } from '../client';
import { QuestionType } from '@klicker-uzh/prisma'

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// construct relative path to desired json file
// __dirname provides the current directory name of the current file
const dirPath = path.join(__dirname, '../../../../migration/export_v2_data/exported_json_files');
const filePath = path.join(dirPath, 'exported_data_2023-06-20_11-23-12.json');

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

const extractId = (id: string) => {
    const pattern = /"(.*)"/
    const match = id.match(pattern)

    return match ? match[1] : id
}

const QuestionTypeMap: Record<string, QuestionType> = {
    SC: 'SC',
    MC: 'MC',
    FREE_RANGE: 'NUMERICAL',
    FREE: 'FREE_TEXT',
  }

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

    // import tags
    const tags = importData.tags

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
                const extractedId = extractId(tag._id)
                console.log("tag._id: ", extractedId)
                mappedTags[extractedId] = {id: newTag.id, name: newTag.name}
            }
            console.log("mappedTagIds: ", mappedTags)
         })
    } catch (error) {
        console.log("Something went wrong while importing tags: ", error)
    }

    const importedQuestions = importData.questions

    try {
        await prisma.$transaction( async (prisma) => {
            for (const question of importedQuestions) {
                console.log("question: ", question)

                const result = {
                    data: {
                        name: question.title,
                        type: QuestionTypeMap[question.type],
                        content: question.versions.content,
                        options: {},
                        hasSampleSolution: false,
                        tags: {
                            connect: question.tags.map((oldTagId) => {
                                const tagName = mappedTags[extractId(oldTagId)].name;
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
                mappedQuestionIds[question._id] = newQuestion.id
            }
        })

    } catch (error) {
        console.log("Something went wrong while importing questions: ", error)
    }

    
} catch (error) {
    console.log("Something went wrong while importing data: ", error)
}
