import { useQuery } from '@apollo/client'
import {
  Course,
  Element,
  GetPracticeQuizDocument,
  GetSingleLiveSessionDocument,
  GetSingleMicroSessionDocument,
  GetUserCoursesDocument,
  MicroSession,
  Session,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { useTranslations } from 'next-intl'
import { useMemo } from 'react'
import LiveSessionWizard from './LiveSessionWizard'
import MicroSessionWizard from './MicroSessionWizard'
import PracticeQuizWizard from './PracticeQuizWizard'

export enum WizardMode {
  LiveSession = 'liveSession',
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
  selection: Record<number, Element>
  resetSelection: () => void
}

function SessionCreation({
  creationMode,
  closeWizard,
  sessionId,
  editMode,
  duplicationMode,
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
        (editMode !== WizardMode.LiveSession &&
          duplicationMode !== WizardMode.LiveSession),
    }
  )
  const { data: dataMicroSession, loading: microLoading } = useQuery(
    GetSingleMicroSessionDocument,
    {
      variables: { id: sessionId || '' },
      skip: !sessionId || editMode !== WizardMode.Microlearning,
    }
  )
  const { data: dataPracticeQuiz, loading: learningLoading } = useQuery(
    GetPracticeQuizDocument,
    {
      variables: { id: sessionId || '' },
      skip: !sessionId || editMode !== WizardMode.PracticeQuiz,
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
      (editMode === WizardMode.LiveSession ||
        duplicationMode === WizardMode.LiveSession) &&
      liveLoading) ||
    (sessionId && editMode === WizardMode.Microlearning && microLoading) ||
    (sessionId && editMode === WizardMode.PracticeQuiz && learningLoading)
  ) {
    return <Loader />
  }

  return (
    <div className="flex flex-col justify-center print-hidden">
      <div className="w-full h-full rounded-lg">
        {creationMode === WizardMode.LiveSession && (
          <LiveSessionWizard
            title={t('shared.generic.liveQuiz')}
            closeWizard={closeWizard}
            courses={courseSelection || [{ label: '', value: '' }]}
            initialValues={
              dataLiveSession?.liveSession
                ? duplicationMode === WizardMode.LiveSession
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
            editMode={editMode === WizardMode.LiveSession}
          />
        )}
        {creationMode === WizardMode.Microlearning && (
          <MicroSessionWizard
            title={t('shared.generic.microlearning')}
            closeWizard={closeWizard}
            courses={courseSelection || [{ label: '', value: '' }]}
            initialValues={
              (dataMicroSession?.singleMicroSession as MicroSession) ??
              undefined
            }
          />
        )}
        {creationMode === WizardMode.PracticeQuiz && (
          <PracticeQuizWizard
            title={t('shared.generic.practiceQuiz')}
            closeWizard={closeWizard}
            courses={courseSelection || [{ label: '', value: '' }]}
            initialValues={dataPracticeQuiz?.practiceQuiz ?? undefined}
          />
        )}
      </div>
    </div>
  )
}

export default SessionCreation
