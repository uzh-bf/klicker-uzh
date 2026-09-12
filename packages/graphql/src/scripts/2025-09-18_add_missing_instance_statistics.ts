import { prisma } from '@klicker-uzh/prisma'
import { getInitialInstanceStatistics } from '@klicker-uzh/util'

// ! IMPORTANT INFORMATION
// Find all element instances that do not have instance statistics assigned yet to make them properly required

const DRY_RUN = false

async function run() {
  // find all element instances that do not have instance statistics assigned yet
  const instancesWithoutStatistics = await prisma.elementInstance.count({
    where: { instanceStatistics: null },
  })
  console.log('Found instances without statistics:', instancesWithoutStatistics)

  if (DRY_RUN) {
    console.log('DRY RUN is enabled, not making any changes. Exiting now...')
    return
  }

  // loop over the instances in batches of 100 and add instance statistics to the ones with missing ones
  const batchSize = 100
  for (let i = 0; i < instancesWithoutStatistics; i += batchSize) {
    const instances = await prisma.elementInstance.findMany({
      where: { instanceStatistics: null },
      orderBy: { id: 'desc' },
      take: batchSize,
    })

    console.log(`Processing batch ${i / batchSize + 1}...`)

    for (const instance of instances) {
      await prisma.elementInstance.update({
        where: { id: instance.id, instanceStatistics: null },
        data: {
          instanceStatistics: {
            create: getInitialInstanceStatistics(instance.type),
          },
        },
      })

      console.log(
        `Added instance statistics for element instance with ID ${instance.id}`
      )
    }
  }

  console.log('Done adding missing instance statistics.')

  // return / exit the process
  return process.exit(0)
}

await run()
