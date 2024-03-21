import { faPlus, faSave } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  Button,
  FormikNumberField,
  FormikSelectField,
  FormikTextField,
  Modal,
} from '@uzh-bf/design-system'
import { Form, Formik } from 'formik'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import * as yup from 'yup'

interface GroupActivityClueModalProps {
  pushClue: (values: any) => void
}

function GroupActivityClueModal({ pushClue }: GroupActivityClueModalProps) {
  const t = useTranslations()
  const [open, setOpen] = useState(false)

  return (
    <div className="w-full">
      <Button
        fluid
        className={{
          root: 'h-full min-h-20 hover:bg-orange-200 hover:border-orange-400 hover:text-orange-900 bg-orange-100 border-orange-300',
        }}
        onClick={() => setOpen(true)}
      >
        <FontAwesomeIcon icon={faPlus} />
        <div>{t('manage.sessionForms.groupActivityAddClue')}</div>
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t('manage.sessionForms.groupActivityAddClue')}
        className={{ content: 'w-[40rem] h-max self-center pt-0' }}
      >
        <Formik
          // TODO: specify proper error messages for form
          // TODO: add tooltips for the fields
          validationSchema={yup.object().shape({
            name: yup.string().required(),
            displayName: yup.string().required(),
            type: yup.string().required(),
            value: yup.string().required(),
            unit: yup.string().optional(),
          })}
          initialValues={{
            name: '',
            displayName: '',
            type: 'STRING',
            value: '',
            unit: undefined,
          }}
          onSubmit={(values) => {
            pushClue(values)
          }}
        >
          {({
            values,
            isSubmitting,
            isValid,
            resetForm,
            validateForm,
            submitForm,
          }) => (
            <Form className="flex flex-col">
              <div className="text-base test-gray-800">
                {t('manage.sessionForms.groupActivityCluesDescription')}
              </div>
              <FormikSelectField
                name="type"
                items={[
                  { label: t('manage.sessionForms.textClue'), value: 'STRING' },
                  {
                    label: t('manage.sessionForms.numericalClue'),
                    value: 'NUMBER',
                  },
                ]}
                label={t('manage.sessionForms.groupActivityClueType')}
                labelType="small"
                required
              />
              <div className="flex flex-row gap-2 w-full">
                <FormikTextField
                  name="name"
                  label={t('manage.sessionForms.name')}
                  labelType="small"
                  className={{ root: 'w-1/2' }}
                  required
                />
                <FormikTextField
                  name="displayName"
                  label={t('manage.sessionForms.displayName')}
                  labelType="small"
                  required
                  className={{ root: 'w-1/2' }}
                />
              </div>

              {values.type === 'STRING' && (
                <FormikTextField
                  name="value"
                  label={t('shared.generic.value')}
                  labelType="small"
                  required
                />
              )}
              {values.type === 'NUMBER' && (
                <div className="flex flex-row gap-2 w-full">
                  <FormikNumberField
                    name="value"
                    label={t('shared.generic.value')}
                    labelType="small"
                    required
                    className={{ root: 'w-1/2' }}
                  />
                  <FormikTextField
                    disabled={values.type !== 'NUMBER'}
                    name="unit"
                    label={t('shared.generic.unit')}
                    labelType="small"
                    required
                    className={{ root: 'w-1/2' }}
                  />
                </div>
              )}

              <Button
                className={{ root: 'mt-3 self-end -mb-3 gap-3' }}
                type="button"
                onClick={async () => {
                  await submitForm()
                  resetForm()
                  setOpen(false)
                }}
              >
                <Button.Icon>
                  <FontAwesomeIcon icon={faSave} />
                </Button.Icon>
                <Button.Label>{t('shared.generic.save')}</Button.Label>
              </Button>
            </Form>
          )}
        </Formik>
      </Modal>
    </div>
  )
}

export default GroupActivityClueModal
