import { getPrisma } from '../../global-setup.js'

export async function getCoursePin(courseName: string) {
  const prisma = await getPrisma()
  const course = await prisma.course.findFirst({
    where: { name: courseName },
    select: { pinCode: true },
  })

  if (!course?.pinCode) {
    throw new Error(`Course with name ${courseName} has no pin code.`)
  }

  return course.pinCode
}
