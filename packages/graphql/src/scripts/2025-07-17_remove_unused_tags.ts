import { prisma } from '@klicker-uzh/prisma'

async function run() {
  // find all tags that do not have any elements linked to them
  const unusedTags = await prisma.tag.findMany({
    where: { questions: { every: { isDeleted: true } } },
  })

  // log the unused tags
  console.log(`Found ${unusedTags.length} unused tags:`)
  unusedTags.forEach((tag) => {
    console.log(`- ${tag.name} (ID: ${tag.id})`)
  })

  // delete all unused tags
  let counter = 0
  for (const tag of unusedTags) {
    console.log(
      `Deleting tag: ${tag.name} (ID: ${tag.id}; ${counter++}/${unusedTags.length})`
    )

    await prisma.tag.delete({
      where: {
        id: tag.id,
        questions: { every: { isDeleted: true } },
      },
    })
  }
}

await run()
