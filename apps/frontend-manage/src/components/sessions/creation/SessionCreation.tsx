import { useQuery } from '@apollo/client'
import {
  Course,
  Element,
  GetLearningElementDocument,
  GetSingleLiveSessionDocument,
  GetSingleMicroSessionDocument,
  GetUserCoursesDocument,
  LearningElement,
  MicroSession,
  Session,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { useTranslations } from 'next-intl'
import { useMemo } from 'react'
import LearningElementWizard from './LearningElementWizard'
import LiveSessionWizard from './LiveSessionWizard'
import MicroSessionWizard from './MicroSessionWizard'

interface SessionCreationProps {
  creationMode: 'liveSession' | 'microSession' | 'learningElement' | 'groupTask'
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
        (editMode !== 'liveSession' && duplicationMode !== 'liveSession'),
    }
  )
  const { data: dataMicroSession, loading: microLoading } = useQuery(
    GetSingleMicroSessionDocument,
    {
      variables: { id: sessionId || '' },
      skip: !sessionId || editMode !== 'microSession',
    }
  )
  const { data: dataLearningElement, loading: learningLoading } = useQuery(
    GetLearningElementDocument,
    {
      variables: { id: sessionId || '' },
      skip: !sessionId || editMode !== 'learningElement',
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
      (editMode === 'liveSession' || duplicationMode === 'liveSession') &&
      liveLoading) ||
    (sessionId && editMode === 'microSession' && microLoading) ||
    (sessionId && editMode === 'learningElement' && learningLoading)
  ) {
    return <Loader />
  }

  return (
    <div className="flex flex-col justify-center print-hidden">
      <div className="w-full h-full rounded-lg">
        {creationMode === 'liveSession' && (
          <LiveSessionWizard
            title={t('shared.generic.liveSession')}
            closeWizard={closeWizard}
            courses={courseSelection || [{ label: '', value: '' }]}
            initialValues={
              dataLiveSession?.liveSession
                ? duplicationMode === 'liveSession'
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
            editMode={editMode === 'liveSession'}
          />
        )}
        {creationMode === 'microSession' && (
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
        {creationMode === 'learningElement' && (
          <LearningElementWizard
            title={t('shared.generic.learningElement')}
            closeWizard={closeWizard}
            courses={courseSelection || [{ label: '', value: '' }]}
            initialValues={
              (dataLearningElement?.learningElement as LearningElement) ??
              undefined
            }
          />
        )}
      </div>
    </div>
  )
}

export default SessionCreation
