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
import { Tab, TabContent, TabList, Tabs } from '@uzh-bf/design-system'
import { useMemo, useState } from 'react'
import LearningElementWizard from './LearningElementWizard'
import LiveSessionWizard from './LiveSessionWizard'
import MicroSessionWizard from './MicroSessionWizard'

interface SessionCreationProps {
  sessionId?: string
  editMode?: string
}

function SessionCreation({ sessionId, editMode }: SessionCreationProps) {
  const [selectedForm, setSelectedForm] = useState(editMode)

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

  console.log('SessionCreation - dataLiveSession', dataLiveSession)
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
      <div className="w-full h-full border rounded">
        <Tabs
          defaultValue="liveSession"
          value={selectedForm}
          onValueChange={(newValue: string) => setSelectedForm(newValue)}
        >
          <TabList
            className={{
              root: 'flex flex-row justify-between w-full h-8',
            }}
          >
            <Tab
              key="liveSession"
              value="liveSession"
              label="Live-Session"
              className={{
                root: 'flex-1 hover:bg-primary-20',
                label:
                  'font-bold text-base flex flex-col justify-center h-full',
              }}
            />
            <Tab
              key="microSession"
              value="microSession"
              label="Micro-Session"
              className={{
                root: 'flex-1 hover:bg-primary-20',
                label:
                  'font-bold text-base flex flex-col justify-center h-full',
              }}
              disabled={courseSelection?.length === 0}
              data={{ cy: 'create-micro-session' }}
            />
            <Tab
              key="learningElement"
              value="learningElement"
              label="Lernelement"
              className={{
                root: 'flex-1 hover:bg-primary-20',
                label:
                  'font-bold text-base flex flex-col justify-center h-full',
              }}
              disabled={courseSelection?.length === 0}
              data={{ cy: 'create-learning-element' }}
            />
          </TabList>
          <TabContent
            key="liveSession"
            value="liveSession"
            className={{ root: 'p-0' }}
          >
            <LiveSessionWizard
              courses={courseSelection || [{ label: '', value: '' }]}
              initialValues={
                (dataLiveSession?.liveSession as Session) ?? undefined
              }
            />
          </TabContent>
          <TabContent
            key="microSession"
            value="microSession"
            className={{ root: 'p-0' }}
          >
            <MicroSessionWizard
              courses={courseSelection || [{ label: '', value: '' }]}
              initialValues={
                (dataMicroSession?.singleMicroSession as MicroSession) ??
                undefined
              }
            />
          </TabContent>
          <TabContent
            key="learningElement"
            value="learningElement"
            className={{ root: 'p-0' }}
          >
            <LearningElementWizard
              courses={courseSelection || [{ label: '', value: '' }]}
              initialValues={
                (dataLearningElement?.learningElement as LearningElement) ??
                undefined
              }
            />
          </TabContent>
        </Tabs>
      </div>
    </div>
  )
}

export default SessionCreation
