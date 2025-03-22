import { PrismaClient } from '@klicker-uzh/prisma'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
dayjs.extend(utc)

async function run() {
  const prisma = new PrismaClient()

  // count the number of element instances that are contained in the database
  const count = await prisma.elementInstance.count()

  // compute the number of batches of 100 instances
  const batches = Math.ceil(count / 100)

  // iterate over the batches of 100 instances and add the base points attribute with value true to the options
  for (let i = 0; i < batches; i++) {
    console.log(`Processing 100-instance batch ${i + 1}/${batches}`)

    const instances = await prisma.elementInstance.findMany({
      skip: i * 100,
      take: 100,
    })

    for (const instance of instances) {
      // skip the current instance, if the base points attribute is already set
      if ('basePoints' in instance.options) {
        continue
      }

      await prisma.elementInstance.update({
        where: {
          id: instance.id,
        },
        data: {
          options: {
            ...instance.options,
            basePoints: true,
          },
        },
      })
    }
  }

  console.log('Finished processing all instances')
}

await run()
