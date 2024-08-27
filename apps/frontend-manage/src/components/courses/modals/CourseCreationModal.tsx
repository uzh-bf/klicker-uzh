import { useMutation } from '@apollo/client'
import {
  CreateCourseDocument,
  GetUserCoursesDocument,
} from '@klicker-uzh/graphql/dist/ops'
import {
  Button,
  FormikColorPicker,
  FormikDateChanger,
  FormikSwitchField,
  FormikTextField,
  Modal,
} from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { Form, Formik, FormikProps } from 'formik'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import * as yup from 'yup'
import EditorField from '../../sessions/creation/EditorField'
import ElementCreationErrorToast from '../../toasts/ElementCreationErrorToast'

interface CourseCreationModalProps {
  modalOpen: boolean
  onModalClose: () => void
}

interface CourseCreationFormData {
  name: string
  displayName: string
  description: string
  color: string
  startDate: string
  endDate: string
  isGamificationEnabled: boolean
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
  const formRef = useRef<FormikProps<CourseCreationFormData>>(null)

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
        innerRef={formRef}
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
            // convert dates to UTC
            const startDateUTC = dayjs(values.startDate + 'T00:00:00.000')
              .utc()
              .toISOString()
            const endDateUTC = dayjs(values.endDate + 'T23:59:59.999')
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
              },
              refetchQueries: [
                {
                  query: GetUserCoursesDocument,
                },
              ],
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
        {({ errors, isValid, isSubmitting }) => (
          <Form>
            <div className="flex flex-col gap-2">
              <div className="flex w-full flex-col gap-3 md:flex-row">
                <FormikTextField
                  name="name"
                  label={t('manage.courseList.courseName')}
                  placeholder={t('manage.courseList.courseName')}
                  tooltip={t('manage.courseList.courseNameTooltip')}
                  className={{ root: 'w-full md:w-1/2' }}
                  data={{ cy: 'create-course-name' }}
                  required
                />
                <FormikTextField
                  name="displayName"
                  label={t('manage.sessionForms.displayName')}
                  placeholder={t('manage.courseList.courseDisplayName')}
                  tooltip={t('manage.courseList.courseDisplayNameTooltip')}
                  className={{ root: 'w-full md:w-1/2' }}
                  data={{ cy: 'create-course-display-name' }}
                  required
                />
              </div>
              <EditorField
                fieldName="description"
                label={t('shared.generic.description')}
                placeholder={t('manage.courseList.addDescription')}
                tooltip={t('manage.courseList.courseDescriptionTooltip')}
                data={{ cy: 'create-course-description' }}
                className={{ input: { editor: 'h-20' } }}
                showToolbarOnFocus={false}
              />
              <div className="mt-2 flex flex-col gap-2 md:flex-row md:items-end md:justify-between md:gap-8">
                <FormikDateChanger
                  name="startDate"
                  label={t('manage.courseList.startDate')}
                  tooltip={t('manage.courseList.startDateTooltip')}
                  data={{ cy: 'create-course-start-date' }}
                  dataButton={{ cy: 'create-course-start-date-button' }}
                  required
                />
                <FormikDateChanger
                  name="endDate"
                  label={t('manage.courseList.endDate')}
                  tooltip={t('manage.courseList.endDateTooltip')}
                  data={{ cy: 'create-course-end-date' }}
                  dataButton={{ cy: 'create-course-end-date-button' }}
                  required
                />
                <FormikColorPicker
                  required
                  name="color"
                  label={t('manage.courseList.courseColor')}
                  colorLabel={t('shared.generic.color')}
                  position="top"
                  submitText={t('shared.generic.confirm')}
                  dataTrigger={{ cy: 'create-course-color-trigger' }}
                  dataHexInput={{ cy: 'create-course-color-hex-input' }}
                  dataSubmit={{ cy: 'create-course-color-submit' }}
                  className={{ root: 'w-max' }}
                />
                <FormikSwitchField
                  required
                  labelLeft
                  name="isGamificationEnabled"
                  label={t('shared.generic.gamification')}
                  className={{ label: 'font-bold text-gray-600' }}
                  data={{ cy: 'create-course-gamification' }}
                />
              </div>
            </div>
            <div className="mt-1 flex flex-row justify-between">
              {errors && (
                <div className="text-sm text-red-700">{errors.description}</div>
              )}
            </div>
            <Button
              disabled={!isValid || isSubmitting}
              type="submit"
              className={{
                root: twMerge(
                  'bg-primary-80 float-right -mb-5 mt-3 w-full font-bold text-white md:w-max',
                  (!isValid || isSubmitting) && 'cursor-not-allowed opacity-50'
                ),
              }}
              data={{ cy: 'create-course-submit' }}
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
