import { useQuery } from '@apollo/client'
import {
  Course,
  GetSingleLiveSessionDocument,
  GetSingleMicroSessionDocument,
  GetUserCoursesDocument,
  MicroSession,
  Session,
} from '@klicker-uzh/graphql/dist/ops'
import {
  Tab,
  TabContent,
  TabList,
  Tabs,
  ThemeContext,
} from '@uzh-bf/design-system'
import { useContext, useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import LearningElementWizard from './LearningElementWizard'
import LiveSessionWizard from './LiveSessionWizard'
import MicroSessionWizard from './MicroSessionWizard'

interface SessionCreationProps {
  sessionId?: string
  editMode?: string
}

function SessionCreation({ sessionId, editMode }: SessionCreationProps) {
  const theme = useContext(ThemeContext)
  const [selectedForm, setSelectedForm] = useState(editMode)
  //  const [stepNumber, setStepNumber] = useState(0)

  const { data: dataLiveSession } = useQuery(GetSingleLiveSessionDocument, {
    variables: { sessionId: sessionId || '' },
    skip: !sessionId || editMode !== 'liveSession',
  })
  const { data: dataMicroSession } = useQuery(GetSingleMicroSessionDocument, {
    variables: { id: sessionId || '' },
    skip: !sessionId || editMode !== 'microSession',
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
      <div className="w-full h-full gap-5 border rounded">
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
                root: twMerge('flex-1', theme.primaryBgHover),
                label:
                  'font-bold text-base flex flex-col justify-center h-full',
              }}
            />
            <Tab
              key="microSession"
              value="microSession"
              label="Micro-Session"
              className={{
                root: twMerge(
                  'flex-1 disabled:text-uzh-grey-80 disabled:hover:bg-white disabled:cursor-not-allowed',
                  theme.primaryBgHover
                ),
                label:
                  'font-bold text-base flex flex-col justify-center h-full',
              }}
              disabled={courseSelection?.length === 0}
            />
            <Tab
              key="learningElement"
              value="learningElement"
              label="Lernelement"
              className={{
                root: twMerge(
                  'flex-1 disabled:text-uzh-grey-80 disabled:hover:bg-white disabled:cursor-not-allowed',
                  theme.primaryBgHover
                ),
                label:
                  'font-bold text-base flex flex-col justify-center h-full',
              }}
              disabled={courseSelection?.length === 0}
            />
          </TabList>
          <TabContent
            key="liveSession"
            value="liveSession"
            className={{ root: 'p-0' }}
          >
            {/* <LiveSessionCreationForm
              courses={courseSelection}
              initialValues={
                (dataLiveSession?.liveSession as Session) ?? undefined
              }
            /> */}
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
            {/* <MicroSessionCreationForm
              courses={courseSelection || [{ label: '', value: '' }]}
              initialValues={
                (dataMicroSession?.singleMicroSession as MicroSession) ??
                undefined
              }
            /> */}
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
            {/* <LearningElementCreationForm
              courses={courseSelection || [{ label: '', value: '' }]}
            /> */}
            <LearningElementWizard
              courses={courseSelection || [{ label: '', value: '' }]}
            />
          </TabContent>
        </Tabs>
      </div>
      {/* <LiveSessionWizard
        courses={courseSelection}
        initialValues={(dataLiveSession?.liveSession as Session) ?? undefined}
      /> */}
      {/* <MicroSessionWizard
        courses={courseSelection}
        initialValues={
          (dataMicroSession?.singleMicroSession as MicroSession) ?? undefined
        }
      /> */}
    </div>
  )
}

export default SessionCreation
