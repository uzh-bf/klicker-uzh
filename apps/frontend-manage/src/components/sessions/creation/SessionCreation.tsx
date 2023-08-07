import { useQuery } from '@apollo/client'
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
import { useTranslations } from 'next-intl'
import { useMemo } from 'react'
import CreationTitle from './CreationTitle'
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
  const t = useTranslations()
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

  if (!errorCourses && loadingCourses)
    return <div>{t('shared.generic.loading')}</div>

  return (
    <div className="flex flex-col justify-center print-hidden">
      <div className="w-full h-full rounded-lg">
        {creationMode === 'liveSession' && (
          <>
            <CreationTitle
              text={t('shared.generic.liveSession')}
              editMode={!!editMode}
              closeWizard={closeWizard}
            />
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
            <CreationTitle
              text={t('shared.generic.microlearning')}
              editMode={!!editMode}
              closeWizard={closeWizard}
            />
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
            <CreationTitle
              text={t('shared.generic.learningElement')}
              editMode={!!editMode}
              closeWizard={closeWizard}
            />
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
