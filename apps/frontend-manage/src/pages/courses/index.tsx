import { useMutation, useQuery } from '@apollo/client'
import {
  faArchive,
  faInbox,
  faPeopleGroup,
  faPlusCircle,
} from '@fortawesome/free-solid-svg-icons'
import {
  CreateCourseDocument,
  GetUserCoursesDocument,
} from '@klicker-uzh/graphql/dist/ops'
import {
  Button,
  H3,
  Switch,
  Tooltip,
  UserNotification,
} from '@uzh-bf/design-system'
import { useRouter } from 'next/router'

import { faTrashCan } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import dayjs from 'dayjs'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import Layout from '../../components/Layout'
import CourseListButton from '../../components/courses/CourseListButton'
import CourseArchiveModal from '../../components/courses/modals/CourseArchiveModal'
import CourseDeletionModal from '../../components/courses/modals/CourseDeletionModal'
import CourseManipulationModal, {
  CourseManipulationFormData,
} from '../../components/courses/modals/CourseManipulationModal'

function CourseSelectionPage() {
  const router = useRouter()
  const t = useTranslations()
  const [createCourse] = useMutation(CreateCourseDocument)

  const [createCourseModal, showCreateCourseModal] = useState(false)
  const [showArchive, setShowArchive] = useState(false)
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null)
  const [selectedCourseArchived, setSelectedCourseArchived] = useState(false)
  const [archiveModal, showArchiveModal] = useState(false)
  const [deletionModal, showDeletionModal] = useState(false)

  const { loading: loadingCourses, data: dataCourses } = useQuery(
    GetUserCoursesDocument
  )

  if (loadingCourses) {
    return (
      <Layout>
        <Loader />
      </Layout>
    )
  }

  const courses = dataCourses?.userCourses
    ?.filter((course) => {
      return showArchive ? true : !course.isArchived
    })
    .sort((a, b) => {
      return dayjs(b.endDate).diff(dayjs(a.endDate))
    })

  return (
    <Layout>
      <div className="flex w-full justify-center">
        <div className="flex w-[30rem] flex-col md:w-[40rem]">
          <div className="flex w-full flex-row justify-between">
            <H3>{t('manage.courseList.selectCourse')}:</H3>
            {(dataCourses?.userCourses?.length ?? 0) > 0 ? (
              <Switch
                checked={showArchive}
                onCheckedChange={(newValue) => setShowArchive(newValue)}
                className={{
                  root: 'mr-24 flex flex-row items-center gap-3',
                  label: 'mr-0 font-normal',
                }}
                data={{ cy: 'toggle-course-archive' }}
                label={t('manage.courseList.showArchive')}
                size="sm"
              />
            ) : null}
          </div>
          {courses && courses.length > 0 ? (
            <div className="w-full">
              <div className="flex flex-col gap-2">
                {courses.map((course) => {
                  const courseRunning = dayjs(course.endDate).isAfter(dayjs())

                  const ArchiveButton = (
                    <Button
                      className={{
                        root: 'flex h-10 w-10 items-center justify-center',
                      }}
                      onClick={() => {
                        setSelectedCourseId(course.id)
                        setSelectedCourseArchived(course.isArchived)
                        showArchiveModal(true)
                      }}
                      disabled={courseRunning}
                      data={{ cy: `archive-course-${course.name}` }}
                    >
                      <FontAwesomeIcon
                        icon={course.isArchived ? faInbox : faArchive}
                      />
                    </Button>
                  )

                  return (
                    <div
                      className="flex flex-row items-center gap-2"
                      key={course.id}
                    >
                      <CourseListButton
                        onClick={() => router.push(`/courses/${course.id}`)}
                        icon={faPeopleGroup}
                        label={course.name}
                        color={course.color}
                        isArchived={course.isArchived}
                        startDate={course.startDate}
                        endDate={course.endDate}
                        data={{ cy: `course-list-button-${course.name}` }}
                      />
                      {courseRunning ? (
                        <Tooltip
                          tooltip={t(
                            'manage.courseList.archiveOnlyPastCourses'
                          )}
                        >
                          {ArchiveButton}
                        </Tooltip>
                      ) : (
                        ArchiveButton
                      )}
                      <Button
                        className={{
                          root: 'flex h-10 w-10 items-center justify-center border border-red-600',
                        }}
                        onClick={() => {
                          setSelectedCourseId(course.id)
                          showDeletionModal(true)
                        }}
                        data={{ cy: `delete-course-${course.name}` }}
                      >
                        <FontAwesomeIcon icon={faTrashCan} />
                      </Button>
                    </div>
                  )
                })}
                <div className="mr-24">
                  <CourseListButton
                    onClick={() => showCreateCourseModal(true)}
                    icon={faPlusCircle}
                    label={t('manage.courseList.createNewCourse')}
                    data={{ cy: 'course-list-button-new-course' }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div
              className={twMerge(
                'w-full',
                (dataCourses?.userCourses?.length ?? 0) > 0 && 'md:pr-24'
              )}
            >
              <UserNotification
                type="warning"
                className={{ root: 'text-normal mb-3' }}
              >
                {t('manage.courseList.noCoursesFound')}
              </UserNotification>
              <CourseListButton
                onClick={() => showCreateCourseModal(true)}
                icon={faPlusCircle}
                label={t('manage.courseList.createCourseNow')}
                data={{ cy: 'course-list-create-first-course' }}
              />
            </div>
          )}
          <CourseArchiveModal
            open={archiveModal}
            setOpen={showArchiveModal}
            courseId={selectedCourseId}
            setSelectedCourseId={setSelectedCourseId}
            isArchived={selectedCourseArchived}
          />
          <CourseDeletionModal
            open={deletionModal}
            setOpen={showDeletionModal}
            courseId={selectedCourseId}
            setSelectedCourseId={setSelectedCourseId}
          />
          <CourseManipulationModal
            modalOpen={createCourseModal}
            onModalClose={() => showCreateCourseModal(false)}
            onSubmit={async (
              values: CourseManipulationFormData,
              setSubmitting,
              setShowErrorToast
            ) => {
              try {
                // convert dates to UTC
                const startDateUTC = dayjs(values.startDate + 'T00:00:00.000')
                  .utc()
                  .toISOString()
                const endDateUTC = dayjs(values.endDate + 'T23:59:59.999')
                  .utc()
                  .toISOString()
                const groupDeadlineDateUTC = dayjs(
                  values.groupCreationDeadline + 'T23:59:59.999'
                )
                  .utc()
                  .toISOString()

                const result = await createCourse({
                  variables: {
                    name: values.name,
                    displayName: values.displayName,
                    description: values.description,
                    color: values.color,
                    startDate: startDateUTC,
                    endDate: endDateUTC,
                    isGamificationEnabled: values.isGamificationEnabled,
                    isGroupCreationEnabled: values.isGroupCreationEnabled,
                    groupDeadlineDate: groupDeadlineDateUTC,
                    maxGroupSize: parseInt(String(values.maxGroupSize)),
                    preferredGroupSize: parseInt(
                      String(values.preferredGroupSize)
                    ),
                  },
                  refetchQueries: [
                    {
                      query: GetUserCoursesDocument,
                    },
                  ],
                })

                if (result.data?.createCourse) {
                  showCreateCourseModal(false)
                  router.push(`/courses/${result.data.createCourse.id}`)
                } else {
                  setShowErrorToast(true)
                  setSubmitting(false)
                }
              } catch (error) {
                setShowErrorToast(true)
                setSubmitting(false)
                console.log(error)
              }
            }}
          />
        </div>
      </div>
    </Layout>
  )
}

export async function getStaticProps({ locale }: GetStaticPropsContext) {
  return {
    props: {
      messages: (await import(`@klicker-uzh/i18n/messages/${locale}`)).default,
    },
  }
}

export default CourseSelectionPage
