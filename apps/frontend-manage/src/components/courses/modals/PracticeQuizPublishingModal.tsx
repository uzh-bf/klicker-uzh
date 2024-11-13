import { useMutation } from '@apollo/client'
import { faClock } from '@fortawesome/free-regular-svg-icons'
import { faUserGroup } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { PublishPracticeQuizDocument } from '@klicker-uzh/graphql/dist/ops'
import { Button, FormikDateField, H3, Modal } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { Form, Formik } from 'formik'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import * as yup from 'yup'

interface PracticeQuizPublishingModalProps {
  elementId: string
  title: string
  courseStartDate: string
  open: boolean
  setOpen: (value: boolean) => void
}

function PracticeQuizPublishingModal({
  elementId,
  title,
  courseStartDate,
  open,
  setOpen,
}: PracticeQuizPublishingModalProps) {
  const t = useTranslations()
  const [publishPracticeQuiz, { loading: practiceQuizPublishing }] =
    useMutation(PublishPracticeQuizDocument)

  // TODO: translate content of entire file

  return (
    <Modal
      title={`${t('shared.generic.practiceQuiz')}: ${title}`}
      onClose={(): void => setOpen(false)}
      open={open}
      className={{ content: '!w-full max-w-4xl text-base' }}
      dataCloseButton={{ cy: 'cancel-practice-quiz-publication' }}
    >
      <div className="flex w-full flex-col gap-4 md:flex-row">
        <div className="border-uzh-grey-80 w-full border-b border-solid pb-3 md:w-1/2 md:border-b-0 md:border-r md:pr-3">
          <div className="mb-2 flex flex-row items-center gap-2">
            <FontAwesomeIcon icon={faUserGroup} />
            <H3 className={{ root: 'mb-0' }}>Publish Immediately</H3>
          </div>
          <div>
            When choosing this option, the practice quiz {title} will become
            immediately visible to all students in your course. Since students
            can submit answers to all published practice quizzes, they can only
            be deleted, but no longer be unpublished.
          </div>
          <Button
            className={{
              root: twMerge(
                'bg-primary-100 float-right mt-3 text-white',
                practiceQuizPublishing &&
                  'hover:bg-primary-40 bg-primary-40 cursor-not-allowed'
              ),
            }}
            onClick={async () => {
              await publishPracticeQuiz({
                variables: {
                  id: elementId,
                },
              })
              setOpen(false)
            }}
            loading={practiceQuizPublishing}
            data={{ cy: 'publish-practice-quiz-immediately' }}
          >
            Confirm Publication
          </Button>
        </div>

        <div className="w-full md:w-1/2 md:pl-3">
          <div className="mb-2 flex flex-row items-center gap-2">
            <FontAwesomeIcon icon={faClock} />
            <H3 className={{ root: 'mb-0' }}>Schedule Publication</H3>
          </div>
          <div className="mb-2">
            Scheduling the practice quiz {title} for publication at a certain
            point in time, it will automatically become available to all
            students in the course at that time. Before the scheduled
            publication date is reached, the activity can still be unpublished
            and edited again.
          </div>
          <Formik
            validateOnMount
            initialValues={{ availableFrom: undefined }}
            onSubmit={async (values, { setSubmitting }) => {
              setSubmitting(true)
              await publishPracticeQuiz({
                variables: {
                  id: elementId,
                  availableFrom: dayjs(values.availableFrom).utc().format(),
                },
              })
              setOpen(false)
            }}
            validationSchema={yup.object().shape({
              availableFrom: yup
                .date()
                .required(t('manage.sessionForms.practiceQuizStartReqeuired'))
                .test(
                  'afterCourseStart',
                  t('manage.sessionForms.practiceQuizStartAfterCourseStart'),
                  (value) => dayjs(value) > dayjs(courseStartDate)
                ),
            })}
          >
            {({ isValid }) => {
              return (
                <Form>
                  <FormikDateField
                    required
                    label={t('shared.generic.availableFrom')}
                    name="availableFrom"
                    className={{
                      root: 'w-full',
                      field: 'w-full',
                      error: 'z-20',
                    }}
                    data={{ cy: 'practice-quiz-available-from' }}
                  />
                  <Button
                    type="submit"
                    className={{
                      root: twMerge(
                        'bg-primary-100 float-right mt-3 text-white',
                        (!isValid || practiceQuizPublishing) &&
                          'hover:bg-primary-40 bg-primary-40 cursor-not-allowed'
                      ),
                    }}
                    loading={practiceQuizPublishing}
                    disabled={!isValid}
                    data={{ cy: 'schedule-practice-quiz-publication' }}
                  >
                    Confirm Scheduling
                  </Button>
                </Form>
              )
            }}
          </Formik>
        </div>
      </div>
    </Modal>
  )
}

export default PracticeQuizPublishingModal
