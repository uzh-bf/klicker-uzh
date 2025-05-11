import { useMutation } from '@apollo/client'
import {
  ExtendGroupActivityDocument,
  ExtendMicroLearningDocument,
  GetSingleCourseDocument,
  GetUserActivitiesDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, FormikDateField, Modal } from '@uzh-bf/design-system'
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
  open: boolean
  setOpen: (value: boolean) => void
}

function ExtensionModal({
  type,
  id,
  currentEndDate,
  courseId,
  title,
  description,
  open,
  setOpen,
}: ExtensionModalProps) {
  const t = useTranslations()
  const [extendMicroLearning] = useMutation(ExtendMicroLearningDocument)
  const [extendGroupActivity] = useMutation(ExtendGroupActivityDocument)

  return (
    <Modal
      onClose={(): void => setOpen(false)}
      open={open}
      hideCloseButton={true}
      title={title}
      className={{
        content: 'max-w-[40rem]',
        title: 'text-xl',
      }}
    >
      <div className="space-y-3" data-cy="activity-extension-modal">
        <div>{description}</div>
        <Formik
          initialValues={{
            endDate: dayjs(currentEndDate).local().format('YYYY-MM-DDTHH:mm'),
          }}
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
                variables: {
                  id,
                  endDate: utcEndDate,
                },
                optimisticResponse: {
                  __typename: 'Mutation',
                  extendMicroLearning: {
                    __typename: 'MicroLearning',
                    id,
                    scheduledEndAt: utcEndDate,
                  },
                },
                // TODO: replace with proper cache update
                refetchQueries: [
                  { query: GetUserActivitiesDocument },
                  {
                    query: GetSingleCourseDocument,
                    variables: { courseId: courseId },
                  },
                ],
              })
            } else if (type === 'groupActivity') {
              await extendGroupActivity({
                variables: {
                  id,
                  endDate: utcEndDate,
                },
                optimisticResponse: {
                  __typename: 'Mutation',
                  extendGroupActivity: {
                    __typename: 'GroupActivity',
                    id,
                    scheduledEndAt: utcEndDate,
                  },
                },
                // TODO: replace with proper cache update
                refetchQueries: [
                  { query: GetUserActivitiesDocument },
                  {
                    query: GetSingleCourseDocument,
                    variables: { courseId: courseId },
                  },
                ],
              })
            }

            setSubmitting(false)
            setOpen(false)
          }}
        >
          {({ isValid, isSubmitting }) => (
            <Form>
              <FormikDateField
                required
                name="endDate"
                label={t('manage.course.newEndDate')}
                labelType="large"
                data={{ cy: 'extend-activity-date' }}
              />
              <div className="mt-3 flex flex-row justify-between">
                <Button
                  onClick={(): void => setOpen(false)}
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
