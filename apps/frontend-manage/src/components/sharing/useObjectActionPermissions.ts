import { SharingObjectType } from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'

function useObjectActionPermissions({
  objectType,
}: {
  objectType: SharingObjectType
}): { action: string; permissions: boolean[] }[] {
  const t = useTranslations()

  if (objectType === SharingObjectType.CatalogCollection) {
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
        action: t(`manage.sharing.share${SharingObjectType.CatalogCollection}`),
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
  } else if (objectType === SharingObjectType.AnswerCollection) {
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
  } else if (objectType === SharingObjectType.Element) {
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
  } else if (objectType === SharingObjectType.LiveQuiz) {
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
  } else if (objectType === SharingObjectType.Course) {
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
