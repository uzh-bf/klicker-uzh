import { useQuery } from '@apollo/client'
import { faX } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  Course,
  GetLearningElementDocument,
  GetSingleLiveSessionDocument,
  GetSingleMicroSessionDocument,
  GetUserCoursesDocument,
  LearningElement,
  MicroSession,
  Session,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, H2 } from '@uzh-bf/design-system'
import { useRouter } from 'next/router'
import { useMemo } from 'react'
import LearningElementWizard from './LearningElementWizard'
import LiveSessionWizard from './LiveSessionWizard'
import MicroSessionWizard from './MicroSessionWizard'

interface SessionCreationProps {
  creationMode: 'liveSession' | 'microSession' | 'learningElement' | 'groupTask'
  closeWizard: () => void
  sessionId?: string
  editMode?: string
}

function SessionCreation({
  creationMode,
  closeWizard,
  sessionId,
  editMode,
}: SessionCreationProps) {
  const router = useRouter()
  const { data: dataLiveSession } = useQuery(GetSingleLiveSessionDocument, {
    variables: { sessionId: sessionId || '' },
    skip: !sessionId || editMode !== 'liveSession',
  })
  const { data: dataMicroSession } = useQuery(GetSingleMicroSessionDocument, {
    variables: { id: sessionId || '' },
    skip: !sessionId || editMode !== 'microSession',
  })
  const { data: dataLearningElement } = useQuery(GetLearningElementDocument, {
    variables: { id: sessionId || '' },
    skip: !sessionId || editMode !== 'learningElement',
  })

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

  if (!errorCourses && loadingCourses) return <div>Loading...</div>

  return (
    <div className="flex flex-col justify-center print-hidden">
      <div className="w-full h-full rounded-lg">
        {creationMode === 'liveSession' && (
          <>
            <div className="grid w-full grid-cols-3 mb-1 -mt-1">
              <div />
              <H2 className={{ root: 'w-full text-center' }}>
                Live-Session {editMode ? 'bearbeiten' : 'erstellen'}
              </H2>
              <Button
                className={{ root: 'ml-auto -mt-1 border-red-400' }}
                onClick={closeWizard}
              >
                <FontAwesomeIcon icon={faX} />
                <div>{editMode ? 'Editieren' : 'Erstellen'} abbrechen</div>
              </Button>
            </div>
            <LiveSessionWizard
              courses={courseSelection || [{ label: '', value: '' }]}
              initialValues={
                (dataLiveSession?.liveSession as Session) ?? undefined
              }
            />
          </>
        )}
        {creationMode === 'microSession' && (
          <>
            <div className="grid w-full grid-cols-3 mb-1 -mt-1">
              <div />
              <H2 className={{ root: 'w-full text-center' }}>
                Micro-Session {editMode ? 'bearbeiten' : 'erstellen'}
              </H2>
              <Button
                className={{ root: 'ml-auto -mt-1 border-red-400' }}
                onClick={closeWizard}
              >
                <FontAwesomeIcon icon={faX} />
                <div>{editMode ? 'Editieren' : 'Erstellen'} abbrechen</div>
              </Button>
            </div>
            <MicroSessionWizard
              courses={courseSelection || [{ label: '', value: '' }]}
              initialValues={
                (dataMicroSession?.singleMicroSession as MicroSession) ??
                undefined
              }
            />
          </>
        )}
        {creationMode === 'learningElement' && (
          <>
            <div className="grid w-full grid-cols-3 mb-1 -mt-1">
              <div />
              <H2 className={{ root: 'w-full text-center' }}>
                Lernelement {editMode ? 'bearbeiten' : 'erstellen'}
              </H2>
              <Button
                className={{ root: 'ml-auto -mt-1 border-red-400' }}
                onClick={closeWizard}
              >
                <FontAwesomeIcon icon={faX} />
                <div>{editMode ? 'Editieren' : 'Erstellen'} abbrechen</div>
              </Button>
            </div>
            <LearningElementWizard
              courses={courseSelection || [{ label: '', value: '' }]}
              initialValues={
                (dataLearningElement?.learningElement as LearningElement) ??
                undefined
              }
            />
          </>
        )}
      </div>
    </div>
  )
}

export default SessionCreation
