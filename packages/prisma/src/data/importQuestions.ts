import Prisma, { QuestionType } from '../../dist'
import { readFile } from 'fs/promises'
// import { fromString } from 'uuidv4'

// const ADDITIONAL_TAGS = ['From=Dogan']
const ADDITIONAL_TAGS: string[] = ['From=GianLuca']

interface ImportedQuestion {
  id: string
  title: string
  type: 'SC' | 'MC' | 'FREE_RANGE' | 'FREE'
  tags: string[]
  version: {
    content: string
    options: {
      SC?: any
      MC?: any
      FREE_RANGE?: any
      FREE?: any
    }
  }
}

const QuestionTypeMap: Record<string, QuestionType> = {
  SC: 'SC',
  MC: 'MC',
  FREE_RANGE: 'NUMERICAL',
  FREE: 'FREE_TEXT',
}

async function importQuestions(prisma: Prisma.PrismaClient) {
  const user = await prisma.user.findUnique({
    where: { email: process.env.DATABASE_IMPORT_USER },
  })

  if (!user) {
    throw new Error('User not found')
  }

  const questionData: ImportedQuestion[] = JSON.parse(
    await readFile(new URL('./exported_questions.json', import.meta.url))
  )

  const tags = [
    ...new Set(questionData.flatMap((q) => q.tags)),
    ...ADDITIONAL_TAGS,
  ]

  await prisma.$transaction(
    tags.map((tag) =>
      prisma.tag.upsert({
        where: { ownerId_name: { ownerId: user.id, name: tag } },
        create: { name: tag, owner: { connect: { id: user.id } } },
        update: {},
      })
    )
  )

  await prisma.$transaction(
    questionData
      .map((question) => {
        console.log(question)

        const result = {
          data: {
            name: question.title,
            type: QuestionTypeMap[question.type],
            content: question.version.content,
            options: {},
            hasSampleSolution: false,
            tags: {
              connect: [...question.tags, ...ADDITIONAL_TAGS].map((tag) => ({
                ownerId_name: { ownerId: user.id, name: tag },
              })),
            },
            owner: {
              connect: { id: user.id },
            },
          },
        }

        if (['SC', 'MC'].includes(question.type)) {
          result.data.options = {
            choices: question.version.options[question.type].choices.map(
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
          return result
        } else if (question.type === 'FREE_RANGE') {
          throw new Error('Unsupported question type NR')
          result.data.options = {
            restrictions: {
              min: question.version.options.FREE_RANGE?.min ?? undefined,
              max: question.version.options.FREE_RANGE?.max ?? undefined,
            },
            solutions: [],
          }
          return result
        } else if (question.type === 'FREE') {
          result.data.options = {
            restrictions: {},
            solutions: [],
          }
          return result
        } else {
          throw new Error('Unknown question type')
        }
      })
      .map(prisma.question.create)
  )
}

const prismaClient = new Prisma.PrismaClient()

importQuestions(prismaClient)
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prismaClient.$disconnect()
  })
