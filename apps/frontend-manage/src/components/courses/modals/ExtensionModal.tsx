import { useMutation } from '@apollo/client'
import {
  ExtendGroupActivityDocument,
  ExtendMicroLearningDocument,
  GetSingleCourseDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, FormikDatetimePicker, Modal } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { Form, Formik } from 'formik'
import { useTranslations } from 'next-intl'
import * as Yup from 'yup'

interface ExtensionModalProps {
  type: 'microLearning' | 'groupActivity'
  id: string
  currentEndDate: Date
  courseId: string
  title: string
  description: string
  onClose: () => void
  refetchActivities?: () => Promise<void>
}

function ExtensionModal({
  type,
  id,
  currentEndDate,
  courseId,
  title,
  description,
  onClose,
  refetchActivities,
}: ExtensionModalProps) {
  const t = useTranslations()
  const [extendMicroLearning] = useMutation(ExtendMicroLearningDocument)
  const [extendGroupActivity] = useMutation(ExtendGroupActivityDocument)

  return (
    <Modal
      open
      onClose={onClose}
      hideCloseButton={true}
      title={title}
      className={{
        content: 'max-w-xl pb-2',
        title: 'text-xl',
      }}
    >
      <div className="space-y-3" data-cy="activity-extension-modal">
        <div data-cy="extension-modal-description">{description}</div>
        <Formik
          initialValues={{ endDate: dayjs(currentEndDate).local().toDate() }}
          validationSchema={Yup.object().shape({
            endDate: Yup.date()
              .required()
              .min(new Date(), t('manage.course.futureEndDateRequired')),
          })}
          onSubmit={async (values, { setSubmitting }) => {
            const utcEndDate = dayjs(values.endDate).utc().format()
            setSubmitting(true)

            if (type === 'microLearning') {
              await extendMicroLearning({
                variables: { id, endDate: utcEndDate },
                optimisticResponse: {
                  __typename: 'Mutation',
                  extendMicroLearning: {
                    __typename: 'MicroLearning',
                    id,
                    scheduledEndAt: utcEndDate,
                  },
                },
                update: (cache, { data }) => {
                  // check if the extension was successful
                  if (!data?.extendMicroLearning) return

                  // update the end date of the modified microlearning in the cache
                  cache.updateQuery(
                    { query: GetSingleCourseDocument, variables: { courseId } },
                    (qData) => {
                      if (!qData?.course) return qData

                      return {
                        course: {
                          ...qData.course,
                          microLearningsInfo: (
                            qData.course.microLearningsInfo ?? []
                          ).map((ml) =>
                            ml.id === data.extendMicroLearning!.id
                              ? {
                                  ...ml,
                                  scheduledEndAt:
                                    data.extendMicroLearning!.scheduledEndAt,
                                }
                              : ml
                          ),
                        },
                      }
                    }
                  )
                },
              })
              await refetchActivities?.()
            } else if (type === 'groupActivity') {
              await extendGroupActivity({
                variables: { id, endDate: utcEndDate },
                optimisticResponse: {
                  __typename: 'Mutation',
                  extendGroupActivity: {
                    __typename: 'GroupActivity',
                    id,
                    scheduledEndAt: utcEndDate,
                  },
                },
                update: (cache, { data }) => {
                  // check if the extension was successful
                  if (!data?.extendGroupActivity) return

                  // update the end date of the modified group activity in the cache
                  cache.updateQuery(
                    { query: GetSingleCourseDocument, variables: { courseId } },
                    (qData) => {
                      if (!qData?.course) return qData

                      return {
                        course: {
                          ...qData.course,
                          groupActivitiesInfo: (
                            qData.course.groupActivitiesInfo ?? []
                          ).map((ga) =>
                            ga.id === data.extendGroupActivity!.id
                              ? {
                                  ...ga,
                                  scheduledEndAt:
                                    data.extendGroupActivity!.scheduledEndAt,
                                }
                              : ga
                          ),
                        },
                      }
                    }
                  )
                },
              })
              await refetchActivities?.()
            }

            setSubmitting(false)
            onClose()
          }}
        >
          {({ isValid, isSubmitting }) => (
            <Form>
              <FormikDatetimePicker
                required
                name="endDate"
                label={t('manage.course.newEndDate')}
                labelType="large"
                granularity="minute"
                className={{ tooltip: 'z-20' }}
                dataTrigger={{ cy: 'extend-activity-date' }}
                dataCalendar={{ cy: 'extend-activity-date-calendar' }}
                dataPreviousMonth={{
                  cy: 'extend-activity-date-previous-month',
                }}
                dataNextMonth={{ cy: 'extend-activity-date-next-month' }}
                dataHours={{ cy: 'extend-activity-date-hours' }}
                dataMinutes={{ cy: 'extend-activity-date-minutes' }}
              />
              <div className="mt-3 flex flex-row justify-between">
                <Button
                  onClick={onClose}
                  data={{ cy: 'extend-activity-cancel' }}
                >
                  <Button.Label>{t('shared.generic.cancel')}</Button.Label>
                </Button>
                <Button
                  primary
                  type="submit"
                  loading={isSubmitting}
                  disabled={!isValid}
                  data={{ cy: 'extend-activity-confirm' }}
                >
                  <Button.Label>{t('shared.generic.confirm')}</Button.Label>
                </Button>
              </div>
            </Form>
          )}
        </Formik>
      </div>
    </Modal>
  )
}

export default ExtensionModal
