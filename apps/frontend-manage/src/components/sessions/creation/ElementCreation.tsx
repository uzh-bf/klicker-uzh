import { useQuery } from '@apollo/client'
import {
  Course,
  Element,
  GetGroupActivityDocument,
  GetMicroLearningDocument,
  GetPracticeQuizDocument,
  GetSingleLiveSessionDocument,
  GetUserCoursesDocument,
  GroupActivity,
  MicroLearning,
  PracticeQuiz,
  Session,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { useTranslations } from 'next-intl'
import { useMemo } from 'react'
import GroupActivityWizard from './GroupActivityWizard'
import LiveSessionWizard from './LiveSessionWizard'
import MicroLearningWizard from './MicroLearningWizard'
import PracticeQuizWizard from './PracticeQuizWizard'

export enum WizardMode {
  LiveQuiz = 'liveQuiz',
  Microlearning = 'microlearning',
  PracticeQuiz = 'practiceQuiz',
  GroupActivity = 'groupActivity',
}

interface ElementCreationProps {
  creationMode: WizardMode
  closeWizard: () => void
  elementId?: string
  editMode?: string
  duplicationMode?: string
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
    GetMicroLearningDocument,
    {
      variables: { id: elementId || '' },
      skip:
        !elementId ||
        (editMode !== WizardMode.Microlearning &&
          conversionMode !== 'microLearningToPracticeQuiz'),
    }
  )
  const { data: dataPracticeQuiz, loading: learningLoading } = useQuery(
    GetPracticeQuizDocument,
    {
      variables: { id: elementId || '' },
      skip:
        !elementId ||
        editMode !== WizardMode.PracticeQuiz ||
        conversionMode === 'microLearningToPracticeQuiz',
    }
  )
  const { data: dataGroupActivity, loading: groupActivityLoading } = useQuery(
    GetGroupActivityDocument,
    {
      variables: { id: elementId || '' },
      skip: !elementId || editMode !== WizardMode.GroupActivity,
    }
  )

  const {
    loading: loadingCourses,
    error: errorCourses,
    data: dataCourses,
  } = useQuery(GetUserCoursesDocument)

  const courseSelection = useMemo(
    () =>
      dataCourses?.userCourses?.map(
        (course: Pick<Course, 'id' | 'name' | 'isGamificationEnabled'>) => ({
          label: course.name,
          value: course.id,
          isGamified: course.isGamificationEnabled,
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
    (elementId && editMode === WizardMode.Microlearning && microLoading) ||
    (elementId && editMode === WizardMode.PracticeQuiz && learningLoading) ||
    (elementId &&
      editMode === WizardMode.GroupActivity &&
      groupActivityLoading) ||
    (elementId &&
      conversionMode === 'microLearningToPracticeQuiz' &&
      microLoading)
  ) {
    return <Loader />
  }

  // initialize practice quiz data from microlearning
  let initialDataPracticeQuiz: PracticeQuiz | undefined
  if (conversionMode === 'microLearningToPracticeQuiz' && dataMicroLearning) {
    initialDataPracticeQuiz = {
      name: `${dataMicroLearning.microLearning?.name} (converted)`,
      displayName: dataMicroLearning.microLearning?.displayName,
      description: dataMicroLearning.microLearning?.description,
      stacks: dataMicroLearning.microLearning?.stacks,
      pointsMultiplier: dataMicroLearning.microLearning?.pointsMultiplier,
      course: dataMicroLearning.microLearning?.course,
    } as PracticeQuiz
  }

  return (
    <div className="flex flex-col justify-center print-hidden h-96">
      <div className="w-full h-full rounded-lg">
        {creationMode === WizardMode.LiveQuiz && (
          <LiveSessionWizard
            title={t('shared.generic.liveQuiz')}
            closeWizard={closeWizard}
            courses={
              courseSelection || [{ label: '', value: '', isGamified: false }]
            }
            initialValues={
              dataLiveSession?.liveSession
                ? duplicationMode === WizardMode.LiveQuiz
                  ? ({
                      ...dataLiveSession?.liveSession,
                      name: `${dataLiveSession.liveSession.name} (Copy)`,
                      displayName: dataLiveSession.liveSession.displayName,
                    } as Session)
                  : (dataLiveSession?.liveSession as Session)
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
            courses={courseSelection || [{ label: '', value: '' }]}
            initialValues={
              (dataMicroLearning?.microLearning as MicroLearning) ?? undefined
            }
          />
        )}
        {(creationMode === WizardMode.PracticeQuiz ||
          conversionMode == 'microLearningToPracticeQuiz') && (
          <PracticeQuizWizard
            title={t('shared.generic.practiceQuiz')}
            closeWizard={closeWizard}
            courses={courseSelection || [{ label: '', value: '' }]}
            initialValues={
              (dataPracticeQuiz?.practiceQuiz as PracticeQuiz) ??
              initialDataPracticeQuiz
            }
            conversion={conversionMode === 'microLearningToPracticeQuiz'}
          />
        )}
        {creationMode === WizardMode.GroupActivity && (
          <GroupActivityWizard
            title={t('shared.generic.groupActivity')}
            closeWizard={closeWizard}
            courses={courseSelection || [{ label: '', value: '' }]}
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
