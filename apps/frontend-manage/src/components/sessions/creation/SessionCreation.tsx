import { useQuery } from '@apollo/client'
import {
  Course,
  Element,
  GetMicroLearningDocument,
  GetPracticeQuizDocument,
  GetSingleLiveSessionDocument,
  GetUserCoursesDocument,
  MicroLearning,
  PracticeQuiz,
  Session,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { useTranslations } from 'next-intl'
import { useMemo } from 'react'
import LiveSessionWizard from './LiveSessionWizard'
import MicroLearningWizard from './MicroLearningWizard'
import PracticeQuizWizard from './PracticeQuizWizard'

export enum WizardMode {
  LiveQuiz = 'liveQuiz',
  Microlearning = 'microlearning',
  PracticeQuiz = 'practiceQuiz',
  GroupActivity = 'groupActivity',
}

interface SessionCreationProps {
  creationMode: WizardMode
  closeWizard: () => void
  sessionId?: string
  editMode?: string
  duplicationMode?: string
  conversionMode?: string
  selection: Record<number, Element>
  resetSelection: () => void
}

function SessionCreation({
  creationMode,
  closeWizard,
  sessionId,
  editMode,
  duplicationMode,
  conversionMode,
  selection,
  resetSelection,
}: SessionCreationProps) {
  const t = useTranslations()
  const { data: dataLiveSession, loading: liveLoading } = useQuery(
    GetSingleLiveSessionDocument,
    {
      variables: { sessionId: sessionId || '' },
      skip:
        !sessionId ||
        (editMode !== WizardMode.LiveQuiz &&
          duplicationMode !== WizardMode.LiveQuiz) ||
        conversionMode === 'microLearningToPracticeQuiz',
    }
  )
  const { data: dataMicroLearning, loading: microLoading } = useQuery(
    GetMicroLearningDocument,
    {
      variables: { id: sessionId || '' },
      skip:
        !sessionId ||
        (editMode !== WizardMode.Microlearning &&
          conversionMode !== 'microLearningToPracticeQuiz'),
    }
  )
  const { data: dataPracticeQuiz, loading: learningLoading } = useQuery(
    GetPracticeQuizDocument,
    {
      variables: { id: sessionId || '' },
      skip:
        !sessionId ||
        editMode !== WizardMode.PracticeQuiz ||
        conversionMode === 'microLearningToPracticeQuiz',
    }
  )

  const {
    loading: loadingCourses,
    error: errorCourses,
    data: dataCourses,
  } = useQuery(GetUserCoursesDocument)

  const courseSelection = useMemo(
    () =>
      dataCourses?.userCourses?.map((course: Partial<Course>) => ({
        label: course.displayName || '',
        value: course.id || '',
      })),
    [dataCourses]
  )

  if (
    (!errorCourses && loadingCourses) ||
    (sessionId &&
      (editMode === WizardMode.LiveQuiz ||
        duplicationMode === WizardMode.LiveQuiz) &&
      liveLoading) ||
    (sessionId && editMode === WizardMode.Microlearning && microLoading) ||
    (sessionId && editMode === WizardMode.PracticeQuiz && learningLoading) ||
    (sessionId &&
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
    <div className="flex flex-col justify-center print-hidden">
      <div className="w-full h-full rounded-lg">
        {creationMode === WizardMode.LiveQuiz && (
          <LiveSessionWizard
            title={t('shared.generic.liveQuiz')}
            closeWizard={closeWizard}
            courses={courseSelection || [{ label: '', value: '' }]}
            initialValues={
              dataLiveSession?.liveSession
                ? duplicationMode === WizardMode.LiveQuiz
                  ? ({
                      ...dataLiveSession?.liveSession,
                      name: `${dataLiveSession.liveSession.name} (Copy)`,
                      displayName: `${dataLiveSession.liveSession.displayName} (Copy)`,
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
      </div>
    </div>
  )
}

export default SessionCreation
