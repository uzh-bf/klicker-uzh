import { useMutation } from '@apollo/client'
import { CreateCourseDocument } from '@klicker-uzh/graphql/dist/ops'
import {
  Button,
  FormikColorPicker,
  FormikDateChanger,
  FormikSwitchField,
  FormikTextField,
  Label,
  Modal,
} from '@uzh-bf/design-system'
import { Form, Formik } from 'formik'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useState } from 'react'
import ContentInput from 'shared-components/src/ContentInput'
import { twMerge } from 'tailwind-merge'
import * as yup from 'yup'
import ElementCreationErrorToast from '../../toasts/ElementCreationErrorToast'

interface CourseCreationModalProps {
  modalOpen: boolean
  onModalClose: () => void
}

// TODO: add notification email settings, once more generally compatible solution is available
// TODO: add groupDeadlineDate field, once this should be user settable (also add to fields on course overview)

function CourseCreationModal({
  modalOpen,
  onModalClose,
}: CourseCreationModalProps) {
  const t = useTranslations()
  const router = useRouter()
  const [createCourse] = useMutation(CreateCourseDocument)
  const [showErrorToast, setShowErrorToast] = useState(false)

  const schema = yup.object().shape({
    name: yup.string().required(t('manage.courseList.courseNameReq')),
    displayName: yup
      .string()
      .required(t('manage.courseList.courseDisplayNameReq')),
    description: yup.string(),
    color: yup.string().required(t('manage.courseList.courseColorReq')),
    startDate: yup.date().required(t('manage.courseList.courseStartReq')),
    endDate: yup
      .date()
      .min(new Date(), t('manage.courseList.endDateFuture'))
      .min(yup.ref('startDate'), t('manage.courseList.endAfterStart'))
      .required(t('manage.courseList.courseEndReq')),
    isGamificationEnabled: yup.boolean(),
  })
  const today = new Date()
  const initEndDate = new Date(today.setMonth(today.getMonth() + 6))

  return (
    <Modal
      title={t('manage.courseList.createNewCourse')}
      open={modalOpen}
      onClose={onModalClose}
      className={{ content: 'h-max' }}
    >
      <Formik
        initialValues={{
          name: '',
          displayName: '',
          description: '',
          color: '#0028A5',
          startDate: new Date().toISOString().slice(0, 10),
          endDate: initEndDate.toISOString().slice(0, 10),
          isGamificationEnabled: true,
        }}
        onSubmit={async (values, { setSubmitting }) => {
          try {
            const result = await createCourse({
              variables: {
                name: values.name,
                displayName: values.displayName,
                description: values.description,
                color: values.color,
                startDate: values.startDate + 'T00:00:00.000Z',
                endDate: values.endDate + 'T23:59:59.999Z',
                isGamificationEnabled: values.isGamificationEnabled,
              },
            })

            if (result.data?.createCourse) {
              onModalClose()
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
        validationSchema={schema}
        isInitialValid={false}
      >
        {({
          values,
          setFieldValue,
          isSubmitting,
          isValid,
          touched,
          errors,
        }) => (
          <Form>
            <div className="flex flex-col gap-2">
              <div className="flex flex-col w-full gap-3 md:flex-row">
                <FormikTextField
                  name="name"
                  label={t('manage.courseList.courseName')}
                  placeholder={t('manage.courseList.courseName')}
                  tooltip={t('manage.courseList.courseNameTooltip')}
                  className={{ root: 'w-full md:w-1/2' }}
                  required
                />
                <FormikTextField
                  name="displayName"
                  label={t('manage.sessionForms.displayName')}
                  placeholder={t('manage.courseList.courseDisplayName')}
                  tooltip={t('manage.courseList.courseDisplayNameTooltip')}
                  className={{ root: 'w-full md:w-1/2' }}
                  required
                />
              </div>

              <div>
                <Label
                  label={t('shared.generic.description')}
                  className={{ root: 'font-bold', tooltip: 'text-sm' }}
                  tooltip={t('manage.courseList.courseDescriptionTooltip')}
                  showTooltipSymbol
                  required
                />
                <ContentInput
                  placeholder={t('manage.courseList.addDescription')}
                  touched={touched.description}
                  content={values.description}
                  onChange={(newValue: string) =>
                    setFieldValue('description', newValue)
                  }
                  className={{ editor: 'h-20' }}
                />
              </div>

              <div className="flex flex-col gap-2 mt-4 md:gap-8 md:flex-row">
                <FormikDateChanger
                  name="startDate"
                  label={t('manage.courseList.startDate')}
                  tooltip={t('manage.courseList.startDateTooltip')}
                  required
                  className={{ label: 'font-bold' }}
                />
                <FormikDateChanger
                  name="endDate"
                  label={t('manage.courseList.endDate')}
                  tooltip={t('manage.courseList.endDateTooltip')}
                  required
                  className={{ label: 'font-bold' }}
                />
              </div>
              <div className="flex flex-col gap-2 mt-4 md:gap-8 md:flex-row">
                <FormikColorPicker
                  name="color"
                  label={t('manage.courseList.courseColor')}
                  position="top"
                  abortText={t('shared.generic.cancel')}
                  submitText={t('shared.generic.confirm')}
                  required
                />
                <FormikSwitchField
                  name="isGamificationEnabled"
                  label={t('shared.generic.gamification')}
                  className={{ label: 'font-bold' }}
                  standardLabel
                  required
                />
              </div>
            </div>
            <div className="flex flex-row justify-between mt-1">
              {errors && (
                <div className="text-sm text-red-700">{errors.description}</div>
              )}
            </div>
            <Button
              disabled={!isValid || isSubmitting}
              type="submit"
              className={{
                root: twMerge(
                  'float-right text-white font-bold mt-2 md:-mt-2 w-full md:w-max bg-primary-80',
                  (!isValid || isSubmitting) && 'cursor-not-allowed opacity-50'
                ),
              }}
            >
              {t('shared.generic.create')}
            </Button>
          </Form>
        )}
      </Formik>
      <ElementCreationErrorToast
        open={showErrorToast}
        setOpen={setShowErrorToast}
        error={t('manage.courseList.courseCreationFailed')}
      />
    </Modal>
  )
}

export default CourseCreationModal
