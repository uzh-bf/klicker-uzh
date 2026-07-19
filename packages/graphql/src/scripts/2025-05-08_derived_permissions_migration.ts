import { prisma } from '@klicker-uzh/prisma'
import { PublicationStatus } from '@klicker-uzh/prisma/client'
import { ActivityType } from '@klicker-uzh/types'
import { recomputeDerivedPermissions } from '@klicker-uzh/util'
import * as cliProgress from 'cli-progress'
import { getActivityAnswerCollectionIds } from '../services/templates.js'

/**
 * This script is used to execute all necessary migrations for the app to be consistent
 * with the new permissions / derived permissions concept. In addition to the checks
 * that are already implemented in this script as assertions, the following things need
 * to be checked before applying the corresponding prisma database migrations and running
 * this script (assumption: derived permissions, etc. already exist):
 * ! - No requested permissions exist in the databse (-> otherwise, these would need to be migrated to the new access request format)
 * ! - Verify that no answer collection with a deconnected owner exists (-> migration makes owner required)
 */
async function run() {
  // ! 1. Reset the originalId value on answer collections and elements
  // --> this will allow to track imports from this point onwards
  // #region

  console.log('-----------------------  Step 1 -----------------------')
  console.log(
    'Reset originalId value on answer collections and elements to support new import functionality'
  )
  const ACs = await prisma.answerCollection.updateMany({
    where: { originalId: { not: null } },
    data: { originalId: null },
  })
  const ELs = await prisma.element.updateMany({
    where: { originalId: { not: null } },
    data: { originalId: null },
  })
  console.log(`Reset ${ACs.count} answer collections and ${ELs.count} elements`)
  console.log('-------------------------------------------------------\n\n')

  // #endregion

  // ! 2. Connect all live quiz templates not only to the answer collections, but also to any entries connected to elements
  // --> this change is required to guarantee that the "keeping an instance as is" option remains valid
  //     even in cases where the corresponding element and answer collection might have been modified
  // #region

  console.log('-----------------------  Step 2 -----------------------')
  console.log(
    'Connect all live quiz templates not only to the answer collections, but also to any entries connected to elements\n'
  )

  // fetch all live quiz templates alonside the corresponding template information
  const liveQuizTemplates = await prisma.liveQuiz.findMany({
    where: { status: PublicationStatus.TEMPLATE },
    include: { templateInfo: { include: { answerCollections: true } } },
  })

  // iterate over all live quiz templates and update the corresponding answer collections (entries)
  console.log(
    `Found ${liveQuizTemplates.length} live quiz templates, linking answer collection items...`
  )

  // create a progress bar to show the progress of the operation
  const templateProgress = new cliProgress.SingleBar(
    {},
    cliProgress.Presets.shades_classic
  )
  templateProgress.start(liveQuizTemplates.length, 0)

  for (const liveQuiz of liveQuizTemplates) {
    templateProgress.increment()

    // if the template info is not defined for a live quiz template, throw an error
    if (!liveQuiz.templateInfo) {
      throw new Error(
        `Live quiz template ${liveQuiz.id} does not have a template info`
      )
    }

    // get all answer collections and answer collection entries that should be connected to the live quiz template
    const { error, answerCollectionIds, answerCollectionEntryIds } =
      await getActivityAnswerCollectionIds(
        {
          activityId: liveQuiz.id,
          activityType: ActivityType.LIVE_QUIZ,
        },
        prisma
      )

    // if an error occurred, throw an error
    if (error) {
      throw new Error(
        `Error while getting answer collection ids for live quiz template ${liveQuiz.id}...`
      )
    }

    // verify that the answer collection ids are identical to the linked answer collections
    if (
      !(
        answerCollectionIds.length ===
        liveQuiz.templateInfo.answerCollections.length
      ) ||
      answerCollectionIds.some(
        (id) =>
          !liveQuiz
            .templateInfo!.answerCollections.map((ac) => ac.id)
            .includes(id)
      )
    ) {
      throw new Error(
        `Answer collection ids for live quiz template ${liveQuiz.id} are not identical to the linked answer collections`
      )
    }

    // verify that all the answer collection options that should be linked to the template still exist
    for (const entryId of answerCollectionEntryIds) {
      // try to fetch the entry
      const entry = await prisma.answerCollectionEntry.findUnique({
        where: { id: entryId },
      })

      // if the entry that should be linked does not exist anymore, throw an error
      if (!entry) {
        throw new Error(
          `Answer collection entry with id ${entryId} could not be found, but is required in template`
        )
      }
    }

    // connect the corresponding answer collection entries to the template information
    await prisma.activityTemplate.update({
      where: { id: liveQuiz.templateInfo.id },
      data: {
        answerCollectionItems: {
          connect: answerCollectionEntryIds.map((entryId) => ({ id: entryId })),
        },
      },
    })
  }

  templateProgress.stop()
  console.log(
    `Successfully executed all required updates of the activity templates`
  )
  console.log('-------------------------------------------------------\n\n')

  // #endregion

  // ! 3. In order for the new implemented views to work correctly, we need to recompute the derived permissions for all objects
  // --> since most objects / overviews are now generated based on the derived permissions only (including ownership permissions),
  //     these values need to be recomputed for all objects
  // --> to ensure consistency, we need to start with the recomputation of the derived permissions at the top
  // #region

  console.log('-----------------------  Step 3 -----------------------')
  console.log(
    'Compute all required derived permissions for direct permissions and object ownerships\n'
  )

  // fetch ids of all objects for which derived permissions should be granted
  const catalogCollections = await prisma.catalogCollection.findMany()
  const catalogCollectionIds = catalogCollections.map(
    (collection) => collection.id
  )

  const courses = await prisma.course.findMany()
  const courseIds = courses.map((course) => course.id)

  const liveQuizzes = await prisma.liveQuiz.findMany()
  const liveQuizIds = liveQuizzes.map((liveQuiz) => liveQuiz.id)

  const practiceQuizzes = await prisma.practiceQuiz.findMany()
  const practiceQuizIds = practiceQuizzes.map((practiceQuiz) => practiceQuiz.id)

  const microLearnings = await prisma.microLearning.findMany()
  const microLearningIds = microLearnings.map(
    (microLearning) => microLearning.id
  )

  const groupActivities = await prisma.groupActivity.findMany()
  const groupActivityIds = groupActivities.map(
    (groupActivity) => groupActivity.id
  )

  const elements = await prisma.element.findMany()
  const elementIds = elements.map((element) => element.id)

  const answerCollections = await prisma.answerCollection.findMany()
  const answerCollectionIds = answerCollections.map(
    (answerCollection) => answerCollection.id
  )

  // recompute derived permissions for all catalog collections
  console.log(
    `Found ${catalogCollectionIds.length} catalog collections, recomputing derived permissions...`
  )
  const catalogCollectionProgress = new cliProgress.SingleBar(
    {},
    cliProgress.Presets.shades_classic
  )
  catalogCollectionProgress.start(catalogCollectionIds.length, 0)
  for (const id of catalogCollectionIds) {
    catalogCollectionProgress.increment()
    await recomputeDerivedPermissions({ catalogCollectionId: id }, prisma)
  }
  catalogCollectionProgress.stop()
  console.log(
    'Successfully recomputed derived permissions for all catalog collections\n'
  )

  // recompute derived permissions for all courses
  console.log(
    `Found ${courseIds.length} courses, recomputing derived permissions...`
  )
  const courseProgress = new cliProgress.SingleBar(
    {},
    cliProgress.Presets.shades_classic
  )
  courseProgress.start(courseIds.length, 0)
  for (const id of courseIds) {
    courseProgress.increment()
    await recomputeDerivedPermissions({ courseId: id }, prisma)
  }
  courseProgress.stop()
  console.log('Successfully recomputed derived permissions for all courses\n')

  // recompute derived permissions for all live quizzes
  console.log(
    `Found ${liveQuizIds.length} live quizzes, recomputing derived permissions...`
  )
  const liveQuizProgress = new cliProgress.SingleBar(
    {},
    cliProgress.Presets.shades_classic
  )
  liveQuizProgress.start(liveQuizIds.length, 0)
  for (const id of liveQuizIds) {
    liveQuizProgress.increment()
    await recomputeDerivedPermissions({ liveQuizId: id }, prisma)
  }
  liveQuizProgress.stop()
  console.log(
    'Successfully recomputed derived permissions for all live quizzes\n'
  )

  // recompute derived permissions for all practice quizzes
  console.log(
    `Found ${practiceQuizIds.length} practice quizzes, recomputing derived permissions...`
  )
  const practiceQuizProgress = new cliProgress.SingleBar(
    {},
    cliProgress.Presets.shades_classic
  )
  practiceQuizProgress.start(practiceQuizIds.length, 0)
  for (const id of practiceQuizIds) {
    practiceQuizProgress.increment()
    await recomputeDerivedPermissions({ practiceQuizId: id }, prisma)
  }
  practiceQuizProgress.stop()
  console.log(
    'Successfully recomputed derived permissions for all practice quizzes\n'
  )

  // recompute derived permissions for all microlearnings
  console.log(
    `Found ${microLearningIds.length} microlearnings, recomputing derived permissions...`
  )
  const microLearningProgress = new cliProgress.SingleBar(
    {},
    cliProgress.Presets.shades_classic
  )
  microLearningProgress.start(microLearningIds.length, 0)
  for (const id of microLearningIds) {
    microLearningProgress.increment()
    await recomputeDerivedPermissions({ microLearningId: id }, prisma)
  }
  microLearningProgress.stop()
  console.log(
    'Successfully recomputed derived permissions for all micro learnings\n'
  )

  // recompute derived permissions for all group activities
  console.log(
    `Found ${groupActivityIds.length} group activities, recomputing derived permissions...`
  )
  const groupActivityProgress = new cliProgress.SingleBar(
    {},
    cliProgress.Presets.shades_classic
  )
  groupActivityProgress.start(groupActivityIds.length, 0)
  for (const id of groupActivityIds) {
    groupActivityProgress.increment()
    await recomputeDerivedPermissions({ groupActivityId: id }, prisma)
  }
  groupActivityProgress.stop()
  console.log(
    'Successfully recomputed derived permissions for all group activities\n'
  )

  // recompute derived permissions for all elements
  console.log(
    `Found ${elementIds.length} elements, recomputing derived permissions...`
  )
  const elementProgress = new cliProgress.SingleBar(
    {},
    cliProgress.Presets.shades_classic
  )
  elementProgress.start(elementIds.length, 0)
  for (const id of elementIds) {
    elementProgress.increment()
    await recomputeDerivedPermissions({ elementId: id }, prisma)
  }
  elementProgress.stop()
  console.log('Successfully recomputed derived permissions for all elements\n')

  // recompute derived permissions for all answer collections
  console.log(
    `Found ${answerCollectionIds.length} answer collections, recomputing derived permissions...`
  )
  const answerCollectionProgress = new cliProgress.SingleBar(
    {},
    cliProgress.Presets.shades_classic
  )
  answerCollectionProgress.start(answerCollectionIds.length, 0)
  for (const id of answerCollectionIds) {
    answerCollectionProgress.increment()
    await recomputeDerivedPermissions({ answerCollectionId: id }, prisma)
  }
  answerCollectionProgress.stop()
  console.log(
    'Successfully recomputed derived permissions for all answer collections\n'
  )
  console.log('-------------------------------------------------------\n\n')

  // #endregion

  // disconnect from the database
  prisma.$disconnect()
}

await run()
