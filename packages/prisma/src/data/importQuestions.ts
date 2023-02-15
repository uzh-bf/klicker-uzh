import Prisma, { QuestionType } from '@klicker-uzh/prisma'
import { readFile } from 'fs/promises'
// import { fromString } from 'uuidv4'

interface ImportedQuestion {
  id: string
  title: string
  type: 'SC' | 'MC' | 'NR' | 'FT'
  tags: string[]
  version: {
    content: string
    options: {
      SC?: any
      MC?: any
      NR?: any
      FT?: any
    }
  }
}

const QuestionTypeMap: Record<string, QuestionType> = {
  SC: 'SC',
  MC: 'MC',
  NR: 'NUMERICAL',
  FT: 'FREE_TEXT',
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

  const tags = [...new Set(questionData.flatMap((q) => q.tags))]

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
    questionData.map((question) => {
      console.log(question)

      let hasSampleSolution = false
      let options = {}
      if (['SC', 'MC'].includes(question.type)) {
        options = {
          choices: question.version.options[question.type].choices.map(
            (choice, ix) => {
              if (choice.correct) hasSampleSolution = true
              return {
                ix,
                value: choice.name,
                correct: choice.correct,
                feedback: '<br>',
              }
            }
          ),
        }
      } else if (question.type === 'NR') {
        // TODO
        throw new Error('Unsupported question type (NR)')
      } else if (question.type === 'FT') {
        // TODO
        throw new Error('Unsupported question type (FT)')
      } else {
        throw new Error('Unknown question type')
      }
      return prisma.question.create({
        data: {
          name: question.title,
          type: QuestionTypeMap[question.type],
          content: question.version.content,
          options,
          hasSampleSolution,
          tags: {
            connect: question.tags.map((tag) => ({
              ownerId_name: { ownerId: user.id, name: tag },
            })),
          },
          owner: {
            connect: { id: user.id },
          },
        },
      })
    })
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
