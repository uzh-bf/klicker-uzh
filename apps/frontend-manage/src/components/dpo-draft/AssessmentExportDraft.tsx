import { Button, Checkbox, Modal } from '@uzh-bf/design-system'
import { Form, Formik } from 'formik'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import * as Yup from 'yup'

export default function AssessmentExportDraft() {
  const t = useTranslations()
  const [open, setOpen] = useState(false)
  const [result, setResult] = useState('')

  function openModal() {
    setResult('')
    setOpen(true)
  }

  function closeModal() {
    setResult('')
    setOpen(false)
  }

  return (
    <section className="space-y-3" data-cy="dpo-assessment-export-draft">
      <p className="text-sm text-gray-700">
        {t('dpoDraft.lecturer.assessment.context')}
      </p>
      <Button onClick={openModal} data={{ cy: 'dpo-open-assessment-export' }}>
        {t('dpoDraft.lecturer.assessment.open')}
      </Button>

      {open ? (
        <Modal
          open
          onClose={closeModal}
          title={t('dpoDraft.lecturer.assessment.title')}
          data={{ cy: 'dpo-assessment-export-modal' }}
          dataCloseButton={{ cy: 'dpo-close-assessment-export' }}
          className={{ content: 'max-w-3xl' }}
        >
          <Formik
            initialValues={{ acknowledgement: false }}
            validateOnMount
            validationSchema={Yup.object({
              acknowledgement: Yup.boolean()
                .required()
                .oneOf(
                  [true],
                  t('dpoDraft.lecturer.assessment.acknowledgementRequired')
                ),
            })}
            onSubmit={(_, { setSubmitting }) => {
              setResult(t('dpoDraft.lecturer.assessment.result'))
              setSubmitting(false)
            }}
          >
            {({ errors, isSubmitting, isValid, setFieldValue, values }) => (
              <Form
                className="flex flex-col gap-4"
                data-cy="dpo-assessment-export-form"
              >
                <span className="w-fit rounded bg-red-100 px-2 py-1 text-sm font-semibold text-red-900">
                  {t('dpoDraft.lecturer.assessment.classification')}
                </span>

                <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
                  <dt className="font-semibold">
                    {t('dpoDraft.lecturer.assessment.assessmentLabel')}
                  </dt>
                  <dd>{t('dpoDraft.lecturer.assessment.assessmentValue')}</dd>
                  <dt className="font-semibold">
                    {t('dpoDraft.lecturer.assessment.scopeLabel')}
                  </dt>
                  <dd>{t('dpoDraft.lecturer.assessment.scopeValue')}</dd>
                </dl>

                <p className="text-sm leading-6">
                  {t('dpoDraft.lecturer.assessment.lead')}
                </p>

                <div className="space-y-2">
                  <h3 className="font-semibold">
                    {t('dpoDraft.lecturer.assessment.attestationsHeading')}
                  </h3>
                  <ol className="list-decimal space-y-2 pl-5 text-sm leading-6">
                    <li>
                      <strong>
                        {t(
                          'dpoDraft.lecturer.assessment.attestations.purposeLabel'
                        )}
                      </strong>{' '}
                      {t(
                        'dpoDraft.lecturer.assessment.attestations.purposeText'
                      )}
                    </li>
                    <li>
                      <strong>
                        {t(
                          'dpoDraft.lecturer.assessment.attestations.accessLabel'
                        )}
                      </strong>{' '}
                      {t(
                        'dpoDraft.lecturer.assessment.attestations.accessText'
                      )}
                    </li>
                    <li>
                      <strong>
                        {t(
                          'dpoDraft.lecturer.assessment.attestations.storageLabel'
                        )}
                      </strong>{' '}
                      {t(
                        'dpoDraft.lecturer.assessment.attestations.storageText'
                      )}
                    </li>
                    <li>
                      <strong>
                        {t(
                          'dpoDraft.lecturer.assessment.attestations.retentionLabel'
                        )}
                      </strong>{' '}
                      {t(
                        'dpoDraft.lecturer.assessment.attestations.retentionText'
                      )}
                    </li>
                  </ol>
                </div>

                <p className="text-xs leading-5 text-gray-600">
                  {t('dpoDraft.lecturer.assessment.logging')}
                </p>

                <Checkbox
                  id="dpo-assessment-export-acknowledgement"
                  checked={values.acknowledgement}
                  onCheck={() => {
                    setResult('')
                    void setFieldValue(
                      'acknowledgement',
                      !values.acknowledgement
                    )
                  }}
                  label={
                    <label htmlFor="dpo-assessment-export-acknowledgement">
                      <strong>
                        {t('dpoDraft.lecturer.assessment.acknowledgement')}
                      </strong>
                    </label>
                  }
                  data={{ cy: 'dpo-assessment-export-acknowledgement' }}
                />
                {errors.acknowledgement ? (
                  <p
                    className="text-sm text-red-700"
                    role="alert"
                    data-cy="dpo-assessment-export-acknowledgement-error"
                  >
                    {errors.acknowledgement}
                  </p>
                ) : null}

                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    type="button"
                    onClick={closeModal}
                    data={{ cy: 'dpo-cancel-assessment-export' }}
                  >
                    {t('dpoDraft.lecturer.assessment.cancel')}
                  </Button>
                  <Button
                    primary
                    type="submit"
                    disabled={!isValid || isSubmitting}
                    loading={isSubmitting}
                    data={{ cy: 'dpo-submit-assessment-export' }}
                  >
                    {t('dpoDraft.lecturer.assessment.submit')}
                  </Button>
                </div>

                {result ? (
                  <p
                    aria-live="polite"
                    className="rounded bg-slate-100 p-3 text-sm"
                    data-cy="dpo-assessment-export-result"
                    role="status"
                  >
                    {result}
                  </p>
                ) : null}
              </Form>
            )}
          </Formik>
        </Modal>
      ) : null}
    </section>
  )
}
