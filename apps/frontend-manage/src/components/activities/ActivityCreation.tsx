import { useQuery } from '@apollo/client'
import {
  ActivityType,
  Course,
  Element,
  GetActiveUserCoursesDocument,
  GetGroupActivityDocument,
  GetSingleLiveQuizDocument,
  GetSingleMicroLearningDocument,
  GetSinglePracticeQuizDocument,
  GroupActivity,
  MicroLearning,
  PracticeQuiz,
  PublicationStatus,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { useTranslations } from 'next-intl'
import { useMemo } from 'react'
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
  const { data: dataLiveQuiz, loading: liveLoading } = useQuery(
    GetSingleLiveQuizDocument,
    {
      variables: { quizId: activityId || '' },
      skip:
        !activityId ||
        (editMode !== ActivityType.LiveQuiz &&
          duplicationMode !== ActivityType.LiveQuiz) ||
        conversionMode === 'microLearningToPracticeQuiz',
      fetchPolicy: 'network-only',
    }
  )
  const { data: dataMicroLearning, loading: microLoading } = useQuery(
    GetSingleMicroLearningDocument,
    {
      variables: { id: activityId || '' },
      skip:
        !activityId ||
        (editMode !== ActivityType.MicroLearning &&
          duplicationMode !== ActivityType.MicroLearning &&
          conversionMode !== 'microLearningToPracticeQuiz'),
      fetchPolicy: 'network-only',
    }
  )
  const { data: dataPracticeQuiz, loading: learningLoading } = useQuery(
    GetSinglePracticeQuizDocument,
    {
      variables: { id: activityId || '' },
      skip:
        !activityId ||
        (editMode !== ActivityType.PracticeQuiz &&
          duplicationMode !== ActivityType.PracticeQuiz) ||
        conversionMode === 'microLearningToPracticeQuiz',
      fetchPolicy: 'network-only',
    }
  )
  const { data: dataGroupActivity, loading: groupActivityLoading } = useQuery(
    GetGroupActivityDocument,
    {
      variables: { id: activityId || '' },
      skip:
        !activityId ||
        (editMode !== ActivityType.GroupActivity &&
          duplicationMode !== ActivityType.GroupActivity),
      fetchPolicy: 'network-only',
    }
  )

  // fetch all courses available to the user and the one linked to this activity (if not included in the former)
  const {
    loading: loadingCourses,
    error: errorCourses,
    data: dataCourses,
  } = useQuery(GetActiveUserCoursesDocument, {
    variables: {
      activityId: typeof editMode !== 'undefined' ? activityId : undefined,
      activityType: editMode,
    },
    fetchPolicy: 'cache-and-network',
  })

  const courseSelection = useMemo(
    (): ElementSelectCourse[] =>
      dataCourses?.getActiveUserCourses?.map(
        (
          course: Pick<
            Course,
            | 'id'
            | 'name'
            | 'isGamificationEnabled'
            | 'isAssessmentEnabled'
            | 'isGroupCreationEnabled'
            | 'startDate'
            | 'endDate'
            | 'groupDeadlineDate'
            | 'isManager'
          >
        ) => ({
          label: course.name,
          value: course.id,
          isGamified: course.isGamificationEnabled,
          isAssessmentEnabled: course.isAssessmentEnabled,
          isGroupCreationEnabled: course.isGroupCreationEnabled,
          startDate: course.startDate,
          endDate: course.endDate,
          groupDeadline: course.groupDeadlineDate,
          isManager: course.isManager ?? false,
        })
      ) ?? [],
    [dataCourses]
  )

  const selectedElements = useMemo(() => {
    return Object.fromEntries(
      Object.entries(selection)
        .filter(([_, value]) => typeof value !== 'undefined')
        .map(([key, value]) => [key, { ...value! }])
    )
  }, [selection])

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
    dataMicroLearning?.getSingleMicroLearning
  ) {
    const microData = dataMicroLearning.getSingleMicroLearning

    initialDataPracticeQuiz = {
      name: `${microData.name} (converted)`,
      displayName: microData.displayName,
      description: microData.description,
      stacks: microData.stacks,
      pointsMultiplier: microData.pointsMultiplier,
      course: microData.course as Course,
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
                  ? {
                      ...dataLiveQuiz.liveQuiz,
                      name: `${dataLiveQuiz.liveQuiz.name} (Copy)`,
                      // do not link previous course during duplication -> might not be available to user / not running anymore
                      course: { id: 'no-course-selected' },
                    }
                  : dataLiveQuiz.liveQuiz
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
              dataMicroLearning?.getSingleMicroLearning
                ? duplicationMode === ActivityType.MicroLearning
                  ? ({
                      ...dataMicroLearning.getSingleMicroLearning,
                      name: `${dataMicroLearning.getSingleMicroLearning.name} (Copy)`,
                      // do not link previous course during duplication -> might not be available to user / not running anymore
                      course: { id: '' },
                    } as MicroLearning)
                  : (dataMicroLearning.getSingleMicroLearning as MicroLearning)
                : undefined
            }
            selection={selectedElements}
            resetSelection={resetSelection}
            editMode={editMode === ActivityType.MicroLearning}
            duplicationMode={duplicationMode === ActivityType.MicroLearning}
          />
        )}
        {(creationMode === ActivityType.PracticeQuiz ||
          conversionMode === 'microLearningToPracticeQuiz') && (
          <PracticeQuizWizard
            title={t('shared.generic.practiceQuiz')}
            closeWizard={closeWizard}
            courses={courseSelection ?? []}
            initialValues={
              dataPracticeQuiz?.getSinglePracticeQuiz
                ? duplicationMode === ActivityType.PracticeQuiz
                  ? ({
                      ...dataPracticeQuiz.getSinglePracticeQuiz,
                      name: `${dataPracticeQuiz.getSinglePracticeQuiz.name} (Copy)`,
                      // do not link previous course during duplication -> might not be available to user / not running anymore
                      course: { id: '' },
                    } as PracticeQuiz)
                  : (dataPracticeQuiz.getSinglePracticeQuiz as PracticeQuiz)
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
              (dataGroupActivity?.groupActivity as GroupActivity) ?? undefined
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
