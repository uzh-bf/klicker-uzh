import { ElementType, QuestionInstance } from 'dist'
import { PrismaClient } from '../client'

function prepareMicrolearningInstanceResults(
  questionInstance: QuestionInstance
) {
  if (
    questionInstance.questionData.type === ElementType.SC ||
    questionInstance.questionData.type === ElementType.MC ||
    questionInstance.questionData.type === ElementType.KPRIM
  ) {
    return {
      choices:
        questionInstance.results.choices ??
        questionInstance.questionData.options.choices.map(
          (_: any, ix: number) => ({
            [`${ix}`]: 0,
          })
        ),
      total: questionInstance.participants ?? 0,
    }
  }

  if (
    questionInstance.questionData.type === ElementType.NUMERICAL ||
    questionInstance.questionData.type === ElementType.FREE_TEXT
  ) {
    return {
      responses: questionInstance.results ?? {},
      total: questionInstance.participants ?? 0,
    }
  }

  if (questionInstance.questionData.type === ElementType.FLASHCARD) {
    return {
      CORRECT: questionInstance.results?.['2'] ?? 0,
      PARTIAL: questionInstance.results?.['1'] ?? 0,
      INCORRECT: questionInstance.results?.['0'] ?? 0,
      total: questionInstance.participants ?? 0,
    }
  }
}

async function migrate() {
  const prisma = new PrismaClient()

  const microLearningInstances = await prisma.elementInstance.findMany({
    where: {
      type: 'MICROLEARNING',
    },
  })

  let counter = 1

  for (const elem of microLearningInstances) {
    console.log(counter, elem.id, elem)

    const originalInstance = await prisma.questionInstance.findUnique({
      where: {
        id: Number(elem.migrationId),
      },
    })

    if (!originalInstance) continue

    await prisma.elementInstance.update({
      where: {
        id: elem.id,
      },
      data: {
        results: prepareMicrolearningInstanceResults(originalInstance),
      },
    })

    console.log(counter, elem)

    counter++
  }

  console.log(counter)
}

await migrate()
