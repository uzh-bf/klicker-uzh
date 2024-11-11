import { useMutation } from '@apollo/client'
import {
  ExtendGroupActivityDocument,
  ExtendMicroLearningDocument,
  GetSingleCourseDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, FormikDateField, Modal } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { Form, Formik } from 'formik'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
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
  const [extendMicroLearning] = useMutation(ExtendMicroLearningDocument, {
    refetchQueries: [
      { query: GetSingleCourseDocument, variables: { courseId: courseId } },
    ],
  })
  const [extendGroupActivity] = useMutation(ExtendGroupActivityDocument, {
    refetchQueries: [
      { query: GetSingleCourseDocument, variables: { courseId: courseId } },
    ],
  })

  return (
    <Modal
      onClose={(): void => setOpen(false)}
      open={open}
      hideCloseButton={true}
      title={title}
      className={{
        content: 'w-[40rem]',
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
                  {t('shared.generic.cancel')}
                </Button>
                <Button
                  type="submit"
                  loading={isSubmitting}
                  disabled={!isValid}
                  className={{
                    root: twMerge(
                      'bg-primary-100 font-bold text-white',
                      !isValid && 'bg-primary-40 cursor-not-allowed'
                    ),
                  }}
                  data={{ cy: 'extend-activity-confirm' }}
                >
                  {t('shared.generic.confirm')}
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
