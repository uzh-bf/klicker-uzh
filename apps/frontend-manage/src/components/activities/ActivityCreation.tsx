import Loader from '@klicker-uzh/shared-components/src/Loader'
import { UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useMemo } from 'react'
import {
  ActivityType,
  Element,
  GroupActivity,
  MicroLearning,
  PracticeQuiz,
  PublicationStatus,
} from '../../lib/constants/activityEnums'
import { trpc, type RouterInputs } from '../../lib/trpc'
import GroupActivityWizard from './creation/groupActivity/GroupActivityWizard'
import LiveQuizWizard from './creation/liveQuiz/LiveQuizWizard'
import MicroLearningWizard from './creation/microLearning/MicroLearningWizard'
import PracticeQuizWizard from './creation/practiceQuiz/PracticeQuizWizard'

export type ElementSelectCourse = {
  label: string
  value: string
  isGamified: boolean
  isAssessmentEnabled: boolean
  isGroupCreationEnabled: boolean
  startDate: Date
  endDate: Date
  groupDeadline: Date
  isManager: boolean
  data?: { cy: string }
}

interface ActivityCreationProps {
  creationMode: ActivityType
  closeWizard: () => void
  activityId?: string
  editMode?: ActivityType
  duplicationMode?: ActivityType
  conversionMode?: string
  selection: Record<number, Element | undefined>
  resetSelection: () => void
}

function ActivityCreation({
  creationMode,
  closeWizard,
  activityId,
  editMode,
  duplicationMode,
  conversionMode,
  selection,
  resetSelection,
}: ActivityCreationProps) {
  const t = useTranslations()
  const loadLiveQuiz = Boolean(
    activityId &&
      (editMode === ActivityType.LiveQuiz ||
        duplicationMode === ActivityType.LiveQuiz) &&
      conversionMode !== 'microLearningToPracticeQuiz'
  )
  const loadMicroLearning = Boolean(
    activityId &&
      (editMode === ActivityType.MicroLearning ||
        duplicationMode === ActivityType.MicroLearning ||
        conversionMode === 'microLearningToPracticeQuiz')
  )
  const loadPracticeQuiz = Boolean(
    activityId &&
      (editMode === ActivityType.PracticeQuiz ||
        duplicationMode === ActivityType.PracticeQuiz) &&
      conversionMode !== 'microLearningToPracticeQuiz'
  )
  const loadGroupActivity = Boolean(
    activityId &&
      (editMode === ActivityType.GroupActivity ||
        duplicationMode === ActivityType.GroupActivity)
  )

  const {
    data: dataLiveQuiz,
    error: liveError,
    isLoading: liveLoading,
  } = trpc.activity.authoringLiveQuiz.useQuery(
    { activityId: activityId ?? '' },
    { enabled: loadLiveQuiz }
  )
  const {
    data: dataMicroLearning,
    error: microError,
    isLoading: microLoading,
  } = trpc.activity.authoringMicroLearning.useQuery(
    { activityId: activityId ?? '' },
    { enabled: loadMicroLearning }
  )
  const {
    data: dataPracticeQuiz,
    error: practiceError,
    isLoading: learningLoading,
  } = trpc.activity.authoringPracticeQuiz.useQuery(
    { activityId: activityId ?? '' },
    { enabled: loadPracticeQuiz }
  )
  const {
    data: dataGroupActivity,
    error: groupActivityError,
    isLoading: groupActivityLoading,
  } = trpc.activity.authoringGroupActivity.useQuery(
    { activityId: activityId ?? '' },
    { enabled: loadGroupActivity }
  )

  // fetch all courses available to the user and the one linked to this activity (if not included in the former)
  const {
    isLoading: loadingCourses,
    error: errorCourses,
    data: dataCourses,
  } = trpc.course.activeUserCourses.useQuery({
    activityId: typeof editMode !== 'undefined' ? activityId : undefined,
    activityType: editMode,
  } as RouterInputs['course']['activeUserCourses'])

  const courseSelection = useMemo(
    (): ElementSelectCourse[] =>
      dataCourses?.activeUserCourses?.map((course) => ({
        label: course.name,
        value: course.id,
        isGamified: course.isGamificationEnabled,
        isAssessmentEnabled: course.isAssessmentEnabled,
        isGroupCreationEnabled: course.isGroupCreationEnabled,
        startDate: course.startDate,
        endDate: course.endDate,
        groupDeadline: course.groupDeadlineDate,
        isManager: course.isManager ?? false,
      })) ?? [],
    [dataCourses]
  )

  const selectedElements = useMemo(() => {
    return Object.fromEntries(
      Object.entries(selection)
        .filter(([_, value]) => typeof value !== 'undefined')
        .map(([key, value]) => [key, { ...value! }])
    )
  }, [selection])
  const hasLoadError =
    Boolean(errorCourses) ||
    (loadLiveQuiz && Boolean(liveError)) ||
    (loadMicroLearning && Boolean(microError)) ||
    (loadPracticeQuiz && Boolean(practiceError)) ||
    (loadGroupActivity && Boolean(groupActivityError))

  if (
    (!errorCourses && loadingCourses) ||
    (activityId &&
      (editMode === ActivityType.LiveQuiz ||
        duplicationMode === ActivityType.LiveQuiz) &&
      liveLoading) ||
    (activityId &&
      (editMode === ActivityType.MicroLearning ||
        duplicationMode === ActivityType.MicroLearning) &&
      microLoading) ||
    (activityId &&
      (editMode === ActivityType.PracticeQuiz ||
        duplicationMode === ActivityType.PracticeQuiz) &&
      learningLoading) ||
    (activityId &&
      (editMode === ActivityType.GroupActivity ||
        duplicationMode === ActivityType.GroupActivity) &&
      groupActivityLoading) ||
    (activityId &&
      conversionMode === 'microLearningToPracticeQuiz' &&
      microLoading)
  ) {
    return <Loader />
  }

  if (hasLoadError) {
    return (
      <UserNotification
        className={{ root: 'm-auto w-max' }}
        type="error"
        message={t('shared.generic.systemError')}
      />
    )
  }

  // initialize practice quiz data from microlearning
  let initialDataPracticeQuiz:
    | (Pick<
        PracticeQuiz,
        | 'name'
        | 'displayName'
        | 'description'
        | 'stacks'
        | 'pointsMultiplier'
        | 'course'
      > & {
        id?: string
        orderType?: string
        status?: PublicationStatus
        resetTimeDays?: number
      })
    | undefined = undefined

  if (
    conversionMode === 'microLearningToPracticeQuiz' &&
    dataMicroLearning?.microLearning
  ) {
    const microData = dataMicroLearning.microLearning

    initialDataPracticeQuiz = {
      name: `${microData.name} (converted)`,
      displayName: microData.displayName,
      description: microData.description,
      stacks: microData.stacks as unknown as PracticeQuiz['stacks'],
      pointsMultiplier: microData.pointsMultiplier,
      course: microData.course as unknown as PracticeQuiz['course'],
    }
  }

  return (
    <div className="print-hidden md:h-73 md:min-h-73 mb-3 flex flex-col justify-center">
      <div className="h-full w-full">
        {creationMode === ActivityType.LiveQuiz && (
          <LiveQuizWizard
            title={t('shared.generic.liveQuiz')}
            closeWizard={closeWizard}
            courses={courseSelection ?? []}
            initialValues={
              dataLiveQuiz?.liveQuiz
                ? duplicationMode === ActivityType.LiveQuiz
                  ? ({
                      ...dataLiveQuiz.liveQuiz,
                      name: `${dataLiveQuiz.liveQuiz.name} (Copy)`,
                      // do not link previous course during duplication -> might not be available to user / not running anymore
                      course: { id: 'no-course-selected' },
                    } as unknown as Parameters<
                      typeof LiveQuizWizard
                    >[0]['initialValues'])
                  : (dataLiveQuiz.liveQuiz as unknown as Parameters<
                      typeof LiveQuizWizard
                    >[0]['initialValues'])
                : undefined
            }
            selection={selectedElements}
            resetSelection={resetSelection}
            editMode={editMode === ActivityType.LiveQuiz}
            duplicationMode={duplicationMode === ActivityType.LiveQuiz}
          />
        )}
        {creationMode === ActivityType.MicroLearning && (
          <MicroLearningWizard
            title={t('shared.generic.microlearning')}
            closeWizard={closeWizard}
            courses={courseSelection ?? []}
            initialValues={
              dataMicroLearning?.microLearning
                ? duplicationMode === ActivityType.MicroLearning
                  ? ({
                      ...dataMicroLearning.microLearning,
                      name: `${dataMicroLearning.microLearning.name} (Copy)`,
                      // do not link previous course during duplication -> might not be available to user / not running anymore
                      course: { id: '' },
                    } as unknown as MicroLearning)
                  : (dataMicroLearning.microLearning as unknown as MicroLearning)
                : undefined
            }
            selection={selectedElements}
            resetSelection={resetSelection}
            editMode={editMode === ActivityType.MicroLearning}
            duplicationMode={duplicationMode === ActivityType.MicroLearning}
          />
        )}
        {(creationMode === ActivityType.PracticeQuiz ||
          conversionMode == 'microLearningToPracticeQuiz') && (
          <PracticeQuizWizard
            title={t('shared.generic.practiceQuiz')}
            closeWizard={closeWizard}
            courses={courseSelection ?? []}
            initialValues={
              dataPracticeQuiz?.practiceQuiz
                ? duplicationMode === ActivityType.PracticeQuiz
                  ? ({
                      ...dataPracticeQuiz.practiceQuiz,
                      name: `${dataPracticeQuiz.practiceQuiz.name} (Copy)`,
                      // do not link previous course during duplication -> might not be available to user / not running anymore
                      course: { id: '' },
                    } as unknown as PracticeQuiz)
                  : (dataPracticeQuiz.practiceQuiz as unknown as PracticeQuiz)
                : initialDataPracticeQuiz
            }
            selection={selectedElements}
            resetSelection={resetSelection}
            conversion={conversionMode === 'microLearningToPracticeQuiz'}
            editMode={editMode === ActivityType.PracticeQuiz}
            duplicationMode={duplicationMode === ActivityType.PracticeQuiz}
          />
        )}
        {creationMode === ActivityType.GroupActivity && (
          <GroupActivityWizard
            title={t('shared.generic.groupActivity')}
            closeWizard={closeWizard}
            courses={courseSelection ?? []}
            selection={selectedElements}
            resetSelection={resetSelection}
            initialValues={
              (dataGroupActivity?.groupActivity as unknown as GroupActivity) ??
              undefined
            }
            editMode={editMode === ActivityType.GroupActivity}
            duplicationMode={duplicationMode === ActivityType.GroupActivity}
          />
        )}
      </div>
    </div>
  )
}

export default ActivityCreation
