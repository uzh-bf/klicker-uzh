import { faPlus, faSave } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { ParameterType } from '@klicker-uzh/graphql/dist/ops'
import {
  Button,
  FormikNumberField,
  FormikSelectField,
  FormikTextField,
  Modal,
} from '@uzh-bf/design-system'
import { Form, Formik } from 'formik'
import { useTranslations } from 'next-intl'
import * as yup from 'yup'

interface GroupActivityClueModalProps {
  initialValues?: {
    name: string
    displayName: string
    type: ParameterType
    value: string
    unit?: string
  }
  open: boolean
  setOpen: (open: boolean) => void
  pushClue: (values: any) => void
  replaceClue: (values: any) => void
  clueIx?: number
  unsetClueIx: () => void
}

function GroupActivityClueModal({
  initialValues,
  pushClue,
  replaceClue,
  open,
  setOpen,
  clueIx,
  unsetClueIx,
}: GroupActivityClueModalProps) {
  const t = useTranslations()

  return (
    <div className="w-full">
      <Button
        fluid
        className={{
          root: 'h-14 border-orange-300 bg-orange-100 hover:border-orange-400 hover:bg-orange-200 hover:text-orange-900',
        }}
        onClick={() => {
          unsetClueIx()
          setOpen(true)
        }}
        data={{
          cy: 'add-group-activity-clue',
        }}
      >
        <FontAwesomeIcon icon={faPlus} />
        <div>{t('manage.sessionForms.groupActivityAddClue')}</div>
      </Button>

      <Modal
        escapeDisabled
        open={open}
        onClose={() => setOpen(false)}
        title={t('manage.sessionForms.groupActivityAddClue')}
        className={{ content: 'w-[40rem]' }}
      >
        <Formik
          enableReinitialize
          validationSchema={yup.object().shape({
            name: yup
              .string()
              .required(t('manage.sessionForms.clueNameMissing')),
            displayName: yup
              .string()
              .required(t('manage.sessionForms.clueDisplayNameMissing')),
            type: yup
              .string()
              .oneOf([ParameterType.String, ParameterType.Number]),
            value: yup
              .string()
              .required(t('manage.sessionForms.clueValueMissing')),
            unit: yup.string().optional(),
          })}
          initialValues={
            initialValues ?? {
              name: '',
              displayName: '',
              type: ParameterType.String,
              value: '',
              unit: undefined,
            }
          }
          onSubmit={(values) => {
            typeof clueIx !== 'undefined'
              ? replaceClue(values)
              : pushClue(values)
          }}
        >
          {({ values, resetForm, submitForm }) => (
            <Form className="flex flex-col">
              <div className="test-gray-800 text-base">
                {t('manage.sessionForms.groupActivityCluesDescription')}
              </div>
              <FormikSelectField
                name="type"
                items={[
                  {
                    label: t('manage.sessionForms.textClue'),
                    value: ParameterType.String,
                    data: { cy: 'group-activity-clue-type-string' },
                  },
                  {
                    label: t('manage.sessionForms.numericalClue'),
                    value: ParameterType.Number,
                    data: { cy: 'group-activity-clue-type-number' },
                  },
                ]}
                label={t('manage.sessionForms.groupActivityClueType')}
                labelType="small"
                data={{ cy: 'group-activity-clue-type' }}
                required
              />
              <div className="flex w-full flex-row gap-2">
                <FormikTextField
                  name="name"
                  label={t('manage.sessionForms.name')}
                  labelType="small"
                  className={{ root: 'w-1/2' }}
                  data={{ cy: 'group-activity-clue-name' }}
                  required
                />
                <FormikTextField
                  name="displayName"
                  label={t('manage.sessionForms.displayName')}
                  labelType="small"
                  data={{ cy: 'group-activity-clue-display-name' }}
                  required
                  className={{ root: 'w-1/2' }}
                />
              </div>

              {values.type === ParameterType.String && (
                <FormikTextField
                  name="value"
                  label={t('shared.generic.value')}
                  labelType="small"
                  data={{ cy: 'group-activity-string-clue-value' }}
                  required
                />
              )}
              {values.type === ParameterType.Number && (
                <div className="flex w-full flex-row gap-2">
                  <FormikNumberField
                    name="value"
                    label={t('shared.generic.value')}
                    labelType="small"
                    data={{ cy: 'group-activity-number-clue-value' }}
                    required
                    className={{ root: 'w-1/2' }}
                  />
                  <FormikTextField
                    disabled={values.type !== ParameterType.Number}
                    name="unit"
                    label={t('shared.generic.unit')}
                    data={{ cy: 'group-activity-number-clue-unit' }}
                    labelType="small"
                    className={{ root: 'mt-1 w-1/2' }}
                  />
                </div>
              )}

              <Button
                className={{ root: 'mt-3 gap-3 self-end' }}
                type="button"
                onClick={async () => {
                  await submitForm()
                  resetForm()
                  setOpen(false)
                }}
                data={{ cy: 'group-activity-clue-save' }}
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
