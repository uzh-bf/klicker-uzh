import { useQuery } from '@apollo/client'
import { Course, GetUserCoursesDocument } from '@klicker-uzh/graphql/dist/ops'
import {
  Tab,
  TabContent,
  TabList,
  Tabs,
  ThemeContext,
} from '@uzh-bf/design-system'
import { useContext, useMemo } from 'react'
import { twMerge } from 'tailwind-merge'
import LearningElementCreationForm from '../../../components/sessions/creation/LearningElementCreationForm'
import LiveSessionCreationForm from '../../../components/sessions/creation/LiveSessionCreationForm'
import MicroSessionCreationForm from '../../../components/sessions/creation/MicroSessionCreationForm'

function SessionCreation() {
  const theme = useContext(ThemeContext)

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
    <div className="flex justify-center mx-5 sm:mx-10 md:mx-20 print-hidden">
      <div className="max-w-[100rem] h-full w-full mt-6 gap-5 border border-solid border-uzh-grey-60 rounded-md">
        <Tabs defaultValue="live-session">
          <TabList
            className={{
              root: 'flex flex-row justify-between w-full h-8 border-b border-solid border-uzh-grey-60',
            }}
          >
            <Tab
              key="live-session"
              value="live-session"
              label="Live-Session"
              className={{
                root: twMerge('flex-1', theme.primaryBgHover),
                label:
                  'font-bold text-base flex flex-col justify-center h-full',
              }}
            />
            <div className="border-r-2 border-solid border-uzh-grey-60" />
            <Tab
              key="micro-session"
              value="micro-session"
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
            <div className="border-r-2 border-solid border-uzh-grey-60" />
            <Tab
              key="learning-element"
              value="learning-element"
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
          <TabContent key="live-session" value="live-session">
            <LiveSessionCreationForm courses={courseSelection} />
          </TabContent>
          <TabContent key="micro-session" value="micro-session">
            <MicroSessionCreationForm
              courses={courseSelection || [{ label: '', value: '' }]}
            />
          </TabContent>
          <TabContent key="learning-element" value="learning-element">
            <LearningElementCreationForm
              courses={courseSelection || [{ label: '', value: '' }]}
            />
          </TabContent>
        </Tabs>
      </div>
    </div>
  )
}

export default SessionCreation
