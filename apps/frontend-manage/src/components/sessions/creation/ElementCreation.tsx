import { useQuery } from '@apollo/client'
import {
  Course,
  Element,
  GetActiveUserCoursesDocument,
  GetGroupActivityDocument,
  GetSingleLiveSessionDocument,
  GetSingleMicroLearningDocument,
  GetSinglePracticeQuizDocument,
  GroupActivity,
  MicroLearning,
  PracticeQuiz,
  Session,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { useTranslations } from 'next-intl'
import { useMemo } from 'react'
import GroupActivityWizard from './groupActivity/GroupActivityWizard'
import LiveSessionWizard from './liveQuiz/LiveSessionWizard'
import MicroLearningWizard from './microLearning/MicroLearningWizard'
import PracticeQuizWizard from './practiceQuiz/PracticeQuizWizard'

export enum WizardMode {
  LiveQuiz = 'liveQuiz',
  Microlearning = 'microlearning',
  PracticeQuiz = 'practiceQuiz',
  GroupActivity = 'groupActivity',
}

export type ElementSelectCourse = {
  label: string
  value: string
  isGamified: boolean
  isGroupCreationEnabled: boolean
  data?: { cy: string }
}

interface ElementCreationProps {
  creationMode: WizardMode
  closeWizard: () => void
  elementId?: string
  editMode?: string
  duplicationMode?: WizardMode
  conversionMode?: string
  selection: Record<number, Element>
  resetSelection: () => void
}

function ElementCreation({
  creationMode,
  closeWizard,
  elementId,
  editMode,
  duplicationMode,
  conversionMode,
  selection,
  resetSelection,
}: ElementCreationProps) {
  const t = useTranslations()
  const { data: dataLiveSession, loading: liveLoading } = useQuery(
    GetSingleLiveSessionDocument,
    {
      variables: { sessionId: elementId || '' },
      skip:
        !elementId ||
        (editMode !== WizardMode.LiveQuiz &&
          duplicationMode !== WizardMode.LiveQuiz) ||
        conversionMode === 'microLearningToPracticeQuiz',
    }
  )
  const { data: dataMicroLearning, loading: microLoading } = useQuery(
    GetSingleMicroLearningDocument,
    {
      variables: { id: elementId || '' },
      skip:
        !elementId ||
        (editMode !== WizardMode.Microlearning &&
          duplicationMode !== WizardMode.Microlearning &&
          conversionMode !== 'microLearningToPracticeQuiz'),
    }
  )
  const { data: dataPracticeQuiz, loading: learningLoading } = useQuery(
    GetSinglePracticeQuizDocument,
    {
      variables: { id: elementId || '' },
      skip:
        !elementId ||
        (editMode !== WizardMode.PracticeQuiz &&
          duplicationMode !== WizardMode.PracticeQuiz) ||
        conversionMode === 'microLearningToPracticeQuiz',
    }
  )
  const { data: dataGroupActivity, loading: groupActivityLoading } = useQuery(
    GetGroupActivityDocument,
    {
      variables: { id: elementId || '' },
      skip:
        !elementId ||
        (editMode !== WizardMode.GroupActivity &&
          duplicationMode !== WizardMode.GroupActivity),
    }
  )

  const {
    loading: loadingCourses,
    error: errorCourses,
    data: dataCourses,
  } = useQuery(GetActiveUserCoursesDocument)

  const courseSelection = useMemo(
    () =>
      dataCourses?.getActiveUserCourses?.map(
        (
          course: Pick<
            Course,
            'id' | 'name' | 'isGamificationEnabled' | 'isGroupCreationEnabled'
          >
        ) => ({
          label: course.name,
          value: course.id,
          isGamified: course.isGamificationEnabled,
          isGroupCreationEnabled: course.isGroupCreationEnabled,
        })
      ),
    [dataCourses]
  )

  if (
    (!errorCourses && loadingCourses) ||
    (elementId &&
      (editMode === WizardMode.LiveQuiz ||
        duplicationMode === WizardMode.LiveQuiz) &&
      liveLoading) ||
    (elementId &&
      (editMode === WizardMode.Microlearning ||
        duplicationMode === WizardMode.Microlearning) &&
      microLoading) ||
    (elementId &&
      (editMode === WizardMode.PracticeQuiz ||
        duplicationMode === WizardMode.PracticeQuiz) &&
      learningLoading) ||
    (elementId &&
      (editMode === WizardMode.GroupActivity ||
        duplicationMode === WizardMode.GroupActivity) &&
      groupActivityLoading) ||
    (elementId &&
      conversionMode === 'microLearningToPracticeQuiz' &&
      microLoading)
  ) {
    return <Loader />
  }

  // initialize practice quiz data from microlearning
  let initialDataPracticeQuiz: PracticeQuiz | undefined = undefined
  if (conversionMode === 'microLearningToPracticeQuiz' && dataMicroLearning) {
    initialDataPracticeQuiz = {
      name: `${dataMicroLearning.getSingleMicroLearning?.name} (converted)`,
      displayName: dataMicroLearning.getSingleMicroLearning?.displayName,
      description: dataMicroLearning.getSingleMicroLearning?.description,
      stacks: dataMicroLearning.getSingleMicroLearning?.stacks,
      pointsMultiplier:
        dataMicroLearning.getSingleMicroLearning?.pointsMultiplier,
      course: dataMicroLearning.getSingleMicroLearning?.course,
    } as PracticeQuiz
  }

  return (
    <div className="print-hidden mb-3 flex flex-col justify-center md:h-[18.25rem] md:min-h-[18.25rem]">
      <div className="h-full w-full">
        {creationMode === WizardMode.LiveQuiz && (
          <LiveSessionWizard
            title={t('shared.generic.liveQuiz')}
            closeWizard={closeWizard}
            courses={courseSelection ?? []}
            initialValues={
              dataLiveSession?.liveSession
                ? duplicationMode === WizardMode.LiveQuiz
                  ? ({
                      ...dataLiveSession.liveSession,
                      name: `${dataLiveSession.liveSession.name} (Copy)`,
                    } as Session)
                  : (dataLiveSession.liveSession as Session)
                : undefined
            }
            selection={selection}
            resetSelection={resetSelection}
            editMode={editMode === WizardMode.LiveQuiz}
          />
        )}
        {creationMode === WizardMode.Microlearning && (
          <MicroLearningWizard
            title={t('shared.generic.microlearning')}
            closeWizard={closeWizard}
            courses={courseSelection ?? []}
            initialValues={
              dataMicroLearning?.getSingleMicroLearning
                ? duplicationMode === WizardMode.Microlearning
                  ? ({
                      ...dataMicroLearning.getSingleMicroLearning,
                      name: `${dataMicroLearning.getSingleMicroLearning.name} (Copy)`,
                    } as MicroLearning)
                  : (dataMicroLearning.getSingleMicroLearning as MicroLearning)
                : undefined
            }
            selection={selection}
            resetSelection={resetSelection}
            editMode={editMode === WizardMode.Microlearning}
          />
        )}
        {(creationMode === WizardMode.PracticeQuiz ||
          conversionMode == 'microLearningToPracticeQuiz') && (
          <PracticeQuizWizard
            title={t('shared.generic.practiceQuiz')}
            closeWizard={closeWizard}
            courses={courseSelection ?? []}
            initialValues={
              dataPracticeQuiz?.getSinglePracticeQuiz
                ? duplicationMode === WizardMode.PracticeQuiz
                  ? ({
                      ...dataPracticeQuiz.getSinglePracticeQuiz,
                      name: `${dataPracticeQuiz.getSinglePracticeQuiz.name} (Copy)`,
                    } as PracticeQuiz)
                  : (dataPracticeQuiz.getSinglePracticeQuiz as PracticeQuiz)
                : initialDataPracticeQuiz
            }
            selection={selection}
            resetSelection={resetSelection}
            editMode={editMode === WizardMode.PracticeQuiz}
            conversion={conversionMode === 'microLearningToPracticeQuiz'}
          />
        )}
        {creationMode === WizardMode.GroupActivity && (
          <GroupActivityWizard
            title={t('shared.generic.groupActivity')}
            closeWizard={closeWizard}
            courses={courseSelection ?? []}
            selection={selection}
            resetSelection={resetSelection}
            initialValues={
              (dataGroupActivity?.groupActivity as GroupActivity) ?? undefined
            }
          />
        )}
      </div>
    </div>
  )
}

export default ElementCreation
