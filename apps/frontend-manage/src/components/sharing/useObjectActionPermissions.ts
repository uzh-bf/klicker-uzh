import { ObjectType } from '@lib/constants/sharingEnums'
import { useTranslations } from 'next-intl'

function useObjectActionPermissions({
  objectType,
}: {
  objectType: ObjectType
}): { action: string; permissions: boolean[] }[] {
  const t = useTranslations()

  if (objectType === ObjectType.CatalogCollection) {
    return [
      {
        action: t('manage.catalog.browseCatalogCollection'),
        permissions: [true, true, true, true],
      },
      {
        action: t('manage.catalog.modifyContent'),
        permissions: [false, true, true, true],
      },
      {
        action: t(`manage.sharing.share${ObjectType.CatalogCollection}`),
        permissions: [false, false, true, true],
      },
      {
        action: t('manage.catalog.modifyPermissions'),
        permissions: [false, false, true, true],
      },
      {
        action: t('manage.catalog.revokeAccess'),
        permissions: [false, false, true, true],
      },
      {
        action: t('manage.catalog.deleteCollection'),
        permissions: [false, false, true, true],
      },
      {
        action: t('manage.sharing.transferOwnership'),
        permissions: [false, false, false, true],
      },
    ]
  } else if (objectType === ObjectType.AnswerCollection) {
    return [
      {
        action: t('manage.resources.viewUseCollectionContent'),
        permissions: [true, true, true, true],
      },
      {
        action: t('manage.resources.modifyContent'),
        permissions: [false, true, true, true],
      },
      {
        action: t('manage.resources.shareCollection'),
        permissions: [false, false, true, true],
      },
      {
        action: t('manage.resources.modifyCatalogAssignments'),
        permissions: [false, false, true, true],
      },
      {
        action: t('manage.resources.modifyPermissions'),
        permissions: [false, false, true, true],
      },
      {
        action: t('manage.resources.revokeAccess'),
        permissions: [false, false, true, true],
      },
      {
        action: t('manage.resources.deleteCollection'),
        permissions: [false, false, true, true],
      },
      {
        action: t('manage.sharing.transferOwnership'),
        permissions: [false, false, false, true],
      },
    ]
  } else if (objectType === ObjectType.Element) {
    return [
      {
        action: t('manage.elements.viewElement'),
        permissions: [true, true, true, true],
      },
      {
        action: t('manage.elements.DUPLICATETitle'),
        permissions: [true, true, true, true],
      },
      {
        action: t('manage.elements.modifyElement'),
        permissions: [false, true, true, true],
      },
      {
        action: t('manage.elements.useElementInActivities'),
        permissions: [false, false, true, true],
      },
      {
        action: t('manage.elements.shareElement'),
        permissions: [false, false, true, true],
      },
      {
        action: t('manage.resources.modifyCatalogAssignments'),
        permissions: [false, false, true, true],
      },
      {
        action: t('manage.resources.modifyPermissions'),
        permissions: [false, false, true, true],
      },
      {
        action: t('manage.resources.revokeAccess'),
        permissions: [false, false, true, true],
      },
      {
        action: t('manage.elements.deleteElement'),
        permissions: [false, false, true, true],
      },
      {
        action: t('manage.sharing.transferOwnership'),
        permissions: [false, false, false, true],
      },
    ]
  } else if (objectType === ObjectType.LiveQuiz) {
    return [
      {
        action: t('manage.liveQuizzes.viewLiveQuiz'),
        permissions: [true, true, true, true, true],
      },
      {
        action: t('manage.liveQuizzes.executeLiveQuiz'),
        permissions: [false, true, true, true, true],
      },
      {
        action: t('manage.liveQuizzes.manageFeedbacksExecution'),
        permissions: [false, true, true, true, true],
      },
      {
        action: t('manage.liveQuizzes.viewLiveQuizEvaluation'),
        permissions: [false, true, true, true, true],
      },
      {
        action: t('manage.liveQuizzes.modifyActivitySettings'),
        permissions: [false, false, true, true, true],
      },
      {
        action: t('manage.liveQuizzes.modifyContainedElements'),
        permissions: [false, false, true, true, true],
      },
      {
        action: t('manage.liveQuizzes.modifyCourseAssignment'),
        permissions: [false, false, true, true, true],
      },
      {
        action: t('manage.liveQuizzes.duplicateLiveQuiz'),
        permissions: [false, false, false, true, true],
      },
      {
        action: t('manage.liveQuizzes.shareLiveQuiz'),
        permissions: [false, false, false, true, true],
      },
      {
        action: t('manage.resources.modifyPermissions'),
        permissions: [false, false, false, true, true],
      },
      {
        action: t('manage.resources.revokeAccess'),
        permissions: [false, false, false, true, true],
      },
      {
        action: t('manage.liveQuizzes.deleteLiveQuiz'),
        permissions: [false, false, false, true, true],
      },
      {
        action: t('manage.sharing.transferOwnership'),
        permissions: [false, false, false, false, true],
      },
    ]
  } else if (objectType === ObjectType.PracticeQuiz) {
    return [
      {
        action: t('manage.practiceQuizzes.viewPracticeQuiz'),
        permissions: [true, true, true, true, true],
      },
      {
        action: t('manage.practiceQuizzes.publishUnpublishPracticeQuiz'),
        permissions: [false, true, true, true, true],
      },
      {
        action: t('manage.practiceQuizzes.viewPracticeQuizEvaluation'),
        permissions: [false, true, true, true, true],
      },
      {
        action: t('manage.practiceQuizzes.modifyActivitySettings'),
        permissions: [false, false, true, true, true],
      },
      {
        action: t('manage.practiceQuizzes.modifyContainedElements'),
        permissions: [false, false, true, true, true],
      },
      {
        action: t('manage.practiceQuizzes.modifyCourseAssignment'),
        permissions: [false, false, true, true, true],
      },
      {
        action: t('manage.practiceQuizzes.duplicatePracticeQuiz'),
        permissions: [false, false, false, true, true],
      },
      {
        action: t('manage.course.sharePracticeQuiz'),
        permissions: [false, false, false, true, true],
      },
      {
        action: t('manage.resources.modifyPermissions'),
        permissions: [false, false, false, true, true],
      },
      {
        action: t('manage.resources.revokeAccess'),
        permissions: [false, false, false, true, true],
      },
      {
        action: t('manage.course.deletePracticeQuiz'),
        permissions: [false, false, false, true, true],
      },
      {
        action: t('manage.sharing.transferOwnership'),
        permissions: [false, false, false, false, true],
      },
    ]
  } else if (objectType === ObjectType.MicroLearning) {
    return [
      {
        action: t('manage.microLearnings.viewMicroLearning'),
        permissions: [true, true, true, true, true],
      },
      {
        action: t('manage.microLearnings.publishUnpublishMicroLearning'),
        permissions: [false, true, true, true, true],
      },
      {
        action: t('manage.microLearnings.viewMicroLearningEvaluation'),
        permissions: [false, true, true, true, true],
      },
      {
        action: t('manage.microLearnings.modifyActivitySettings'),
        permissions: [false, false, true, true, true],
      },
      {
        action: t('manage.microLearnings.modifyContainedElements'),
        permissions: [false, false, true, true, true],
      },
      {
        action: t('manage.microLearnings.modifyCourseAssignment'),
        permissions: [false, false, true, true, true],
      },
      {
        action: t('manage.microLearnings.duplicateMicroLearning'),
        permissions: [false, false, false, true, true],
      },
      {
        action: t('manage.course.convertMicroLearningToPracticeQuiz'),
        permissions: [false, false, false, true, true],
      },
      {
        action: t('manage.course.shareMicroLearning'),
        permissions: [false, false, false, true, true],
      },
      {
        action: t('manage.resources.modifyPermissions'),
        permissions: [false, false, false, true, true],
      },
      {
        action: t('manage.resources.revokeAccess'),
        permissions: [false, false, false, true, true],
      },
      {
        action: t('manage.course.deleteMicroLearning'),
        permissions: [false, false, false, true, true],
      },
      {
        action: t('manage.sharing.transferOwnership'),
        permissions: [false, false, false, false, true],
      },
    ]
  } else if (objectType === ObjectType.GroupActivity) {
    return [
      {
        action: t('manage.groupActivities.viewGroupActivity'),
        permissions: [true, true, true, true, true],
      },
      {
        action: t('manage.groupActivities.publishUnpublishGroupActivity'),
        permissions: [false, true, true, true, true],
      },
      {
        action: t('manage.groupActivities.gradeGroupActivitySubmissions'),
        permissions: [false, true, true, true, true],
      },
      {
        action: t('manage.groupActivities.modifyActivitySettings'),
        permissions: [false, false, true, true, true],
      },
      {
        action: t('manage.groupActivities.modifyContainedElements'),
        permissions: [false, false, true, true, true],
      },
      {
        action: t('manage.groupActivities.modifyCourseAssignment'),
        permissions: [false, false, true, true, true],
      },
      {
        action: t('manage.groupActivities.duplicateGroupActivity'),
        permissions: [false, false, false, true, true],
      },
      {
        action: t('manage.course.shareGroupActivity'),
        permissions: [false, false, false, true, true],
      },
      {
        action: t('manage.resources.modifyPermissions'),
        permissions: [false, false, false, true, true],
      },
      {
        action: t('manage.resources.revokeAccess'),
        permissions: [false, false, false, true, true],
      },
      {
        action: t('manage.course.deleteGroupActivity'),
        permissions: [false, false, false, true, true],
      },
      {
        action: t('manage.sharing.transferOwnership'),
        permissions: [false, false, false, false, true],
      },
    ]
  } else if (objectType === ObjectType.Course) {
    return [
      {
        action: t('manage.course.viewCourse'),
        permissions: [true, true, true, true, true],
      },
      {
        action: t('manage.course.viewActivities'),
        permissions: [true, true, true, true, true],
      },
      {
        action: t('manage.course.executeActivities'),
        permissions: [false, true, true, true, true],
      },
      {
        action: t('manage.course.modifyCourseSettings'),
        permissions: [false, false, true, true, true],
      },
      {
        action: t('manage.course.modifyContainedActivities'),
        permissions: [false, false, true, true, true],
      },
      {
        action: t('manage.course.manageParticipantGroups'),
        permissions: [false, false, true, true, true],
      },
      {
        action: t('manage.course.shareCourse'),
        permissions: [false, false, false, true, true],
      },
      {
        action: t('manage.resources.modifyPermissions'),
        permissions: [false, false, false, true, true],
      },
      {
        action: t('manage.resources.revokeAccess'),
        permissions: [false, false, false, true, true],
      },
      {
        action: t('manage.course.deleteCourse'),
        permissions: [false, false, false, true, true],
      },
      {
        action: t('manage.sharing.transferOwnership'),
        permissions: [false, false, false, false, true],
      },
    ]
  }

  return []
}

export default useObjectActionPermissions
