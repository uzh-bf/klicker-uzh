import { prisma } from '@klicker-uzh/prisma'

async function run() {
  const DEBUG = false
  // get all courses and the associated users
  const courses = await prisma.course.findMany({
    include: { owner: { select: { email: true } } },
  })

  // set the course language to the owner's locale
  let counter = 0
  for (const course of courses) {
    // if the notification email is already set, skip
    if (course.notificationEmail) {
      continue
    }

    console.log(
      `Processing course ${++counter}/${courses.length}: ${course.name} (${course.id})`
    )

    if (DEBUG) {
      console.log(
        `Setting course email for course: ${course.name} (${course.id}) to ${course.owner.email}`
      )
    }

    await prisma.course.update({
      where: { id: course.id },
      data: { notificationEmail: course.owner.email },
    })
  }
}

await run()
