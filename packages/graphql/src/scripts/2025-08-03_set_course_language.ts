import { prisma } from '@klicker-uzh/prisma'

async function run() {
  const DEBUG = false
  // get all courses and the associated users
  const courses = await prisma.course.findMany({
    include: { owner: { select: { locale: true } } },
  })

  // set the course language to the owner's locale
  let counter = 0
  for (const course of courses) {
    console.log(
      `Processing course ${++counter}/${courses.length}: ${course.name} (${course.id})`
    )

    if (DEBUG) {
      console.log(
        `Setting course language for course: ${course.name} (${course.id}) to ${course.owner.locale}`
      )
    }

    await prisma.course.update({
      where: { id: course.id },
      data: { language: course.owner.locale },
    })
  }
}

await run()
