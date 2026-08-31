import { useMutation, useQuery } from '@apollo/client'
import { faPlusCircle } from '@fortawesome/free-solid-svg-icons'
import {
  CreateCourseDocument,
  GetUserCoursesDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { H3, Switch, UserNotification } from '@uzh-bf/design-system'
import { useRouter } from 'next/router'

import Loader from '@klicker-uzh/shared-components/src/Loader'
import dayjs from 'dayjs'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { useCourseDeletionStatus } from '../../components/courses/CourseDeletionStatusProvider'
import CourseListButton from '../../components/courses/CourseListButton'
import CourseArchiveModal from '../../components/courses/modals/CourseArchiveModal'
import CourseDeletionModal from '../../components/courses/modals/CourseDeletionModal'
import CourseManipulationModal, {
  CourseManipulationFormData,
} from '../../components/courses/modals/CourseManipulationModal'
import CourseRemovalModal from '../../components/courses/modals/CourseRemovalModal'
import Layout from '../../components/Layout'

function CourseSelectionPage() {
  const router = useRouter()
  const t = useTranslations()
  const [createCourse] = useMutation(CreateCourseDocument)
  const { isCourseDeletionActive, isCourseDeletionStateInitialized } =
    useCourseDeletionStatus()

  const [createCourseModal, showCreateCourseModal] = useState(false)
  const [showArchive, setShowArchive] = useState(false)
  const [archiveModal, showArchiveModal] = useState<{
    open: boolean
    courseId: string | null
    isArchived: boolean
  }>({ open: false, courseId: null, isArchived: false })
  const [deletionModal, showDeletionModal] = useState<{
    open: boolean
    courseId: string | null
  }>({ open: false, courseId: null })
  const [removalModal, showRemovalModal] = useState<{
    open: boolean
    courseId: string | null
    courseName: string | null
  }>({ open: false, courseId: null, courseName: null })

  const { loading: loadingCourses, data: dataCourses } = useQuery(
    GetUserCoursesDocument,
    { fetchPolicy: 'cache-and-network' }
  )

  if (loadingCourses || !isCourseDeletionStateInitialized) {
    return (
      <Layout>
        <Loader />
      </Layout>
    )
  }

  const visibleCourses = dataCourses?.userCourses?.filter(
    (course) => !isCourseDeletionActive(course.id)
  )
  const courses = visibleCourses?.filter((course) =>
    showArchive ? true : !course.isArchived
  )

  return (
    <Layout>
      <div className="flex w-full justify-center">
        <div className="md:w-180 flex w-full flex-col">
          <div className="mb-1 flex w-full flex-row justify-between">
            <H3>{t('manage.courseList.selectCourse')}:</H3>
            {(visibleCourses?.length ?? 0) > 0 ? (
              <Switch
                checked={showArchive}
                onCheckedChange={(newValue) => setShowArchive(newValue)}
                className={{
                  root: 'flex flex-row items-center gap-3',
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
                  return (
                    <div
                      className="flex flex-row items-center gap-2"
                      key={course.id}
                    >
                      <CourseListButton
                        course={course}
                        onClick={() => router.push(`/courses/${course.id}`)}
                        // icon={faPeopleGroup}
                        label={course.name}
                        showArchiveModal={showArchiveModal}
                        showDeletionModal={showDeletionModal}
                        showRemovalModal={showRemovalModal}
                        data={{ cy: `course-list-button-${course.name}` }}
                      />
                    </div>
                  )
                })}
                <CourseListButton
                  onClick={() => showCreateCourseModal(true)}
                  icon={faPlusCircle}
                  label={t('manage.courseList.createNewCourse')}
                  data={{ cy: 'course-list-button-new-course' }}
                />
              </div>
            </div>
          ) : (
            <div
              className={twMerge(
                'w-full',
                (visibleCourses?.length ?? 0) > 0 && 'md:pr-24'
              )}
            >
              <UserNotification className={{ root: 'mb-3 text-base' }}>
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
          {archiveModal.open && (
            <CourseArchiveModal
              onClose={() =>
                showArchiveModal({
                  open: false,
                  courseId: null,
                  isArchived: false,
                })
              }
              courseId={archiveModal.courseId}
              isArchived={archiveModal.isArchived}
            />
          )}
          {deletionModal.open && (
            <CourseDeletionModal
              onClose={() => showDeletionModal({ open: false, courseId: null })}
              courseId={deletionModal.courseId}
            />
          )}
          {createCourseModal && (
            <CourseManipulationModal
              onModalClose={() => showCreateCourseModal(false)}
              onSubmit={async (
                values: CourseManipulationFormData,
                setSubmitting,
                onError
              ) => {
                try {
                  // convert dates to UTC
                  const startDateUTC = dayjs(values.startDate)
                    .utc()
                    .toISOString()
                  const endDateUTC = dayjs(values.endDate).utc().toISOString()
                  const groupDeadlineDateUTC = dayjs(
                    values.groupCreationDeadline
                  )
                    .utc()
                    .toISOString()

                  const result = await createCourse({
                    variables: {
                      name: values.name,
                      displayName: values.displayName,
                      description:
                        !values.description?.match(/^(<br>(\n)*)$/g) &&
                        values.description !== ''
                          ? values.description
                          : null,
                      language: values.language,
                      color: values.color,
                      startDate: startDateUTC,
                      endDate: endDateUTC,
                      notificationEmail: values.notificationEmail,
                      isGamificationEnabled: values.isGamificationEnabled,
                      isGroupCreationEnabled: values.isGroupCreationEnabled,
                      groupDeadlineDate: groupDeadlineDateUTC,
                      maxGroupSize: parseInt(String(values.maxGroupSize)),
                      preferredGroupSize: parseInt(
                        String(values.preferredGroupSize)
                      ),
                    },
                    update: (cache, { data }) => {
                      // verify that the course creation was successful
                      if (!data?.createCourse) return

                      // add the new course to the course list
                      cache.updateQuery(
                        { query: GetUserCoursesDocument },
                        (qData) => {
                          if (!qData?.userCourses) return qData

                          return {
                            userCourses: [
                              ...qData.userCourses,
                              data.createCourse!,
                            ],
                          }
                        }
                      )
                    },
                  })

                  if (result.data?.createCourse) {
                    showCreateCourseModal(false)
                    router.push(`/courses/${result.data.createCourse.id}`)
                  } else {
                    onError()
                    setSubmitting(false)
                  }
                } catch (error) {
                  onError()
                  setSubmitting(false)
                  console.log(error)
                }
              }}
            />
          )}
          {removalModal.courseId && removalModal.courseName ? (
            <CourseRemovalModal
              courseId={removalModal.courseId}
              title={removalModal.courseName}
              isModalOpen={removalModal.open}
              setModalOpen={(newOpen) =>
                showRemovalModal((prev) =>
                  newOpen
                    ? { ...prev, open: newOpen }
                    : { open: false, courseId: null, courseName: null }
                )
              }
            />
          ) : null}
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
