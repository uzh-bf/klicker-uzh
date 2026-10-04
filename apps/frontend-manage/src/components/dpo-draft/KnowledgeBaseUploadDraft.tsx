import { Button, Checkbox, Modal, Select } from '@uzh-bf/design-system'
import { Form, Formik } from 'formik'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import * as Yup from 'yup'

type UploadScenario = 'initial' | 'additional' | 'replacement' | 'import'

type KnowledgeBaseFormValues = {
  rightsAcknowledgement: boolean
  privacyAcknowledgement: boolean
}

export default function KnowledgeBaseUploadDraft() {
  const t = useTranslations()
  const [open, setOpen] = useState(false)
  const [result, setResult] = useState('')
  const [scenario, setScenario] = useState<UploadScenario>('initial')

  function openModal() {
    setResult('')
    setScenario('initial')
    setOpen(true)
  }

  function closeModal() {
    setResult('')
    setScenario('initial')
    setOpen(false)
  }

  const initialValues: KnowledgeBaseFormValues = {
    rightsAcknowledgement: false,
    privacyAcknowledgement: false,
  }

  return (
    <section className="space-y-3" data-cy="dpo-knowledge-base-upload-draft">
      <p className="text-sm text-gray-700">
        {t('dpoDraft.lecturer.knowledgeBase.context')}
      </p>
      <Button onClick={openModal} data={{ cy: 'dpo-open-knowledge-upload' }}>
        {t('dpoDraft.lecturer.knowledgeBase.open')}
      </Button>

      {open ? (
        <Modal
          open
          onClose={closeModal}
          title={t('dpoDraft.lecturer.knowledgeBase.title')}
          data={{ cy: 'dpo-knowledge-upload-modal' }}
          dataCloseButton={{ cy: 'dpo-close-knowledge-upload' }}
          className={{
            content: 'max-w-3xl',
            title: 'min-w-0 whitespace-normal pr-8 text-left',
          }}
        >
          <div className="mb-4 space-y-2">
            <label
              className="font-semibold"
              htmlFor="dpo-knowledge-upload-scenario"
            >
              {t('dpoDraft.lecturer.knowledgeBase.scenarioDescription')}
            </label>
            <Select
              id="dpo-knowledge-upload-scenario"
              value={scenario}
              items={[
                {
                  value: 'initial',
                  label: t('dpoDraft.lecturer.knowledgeBase.scenarios.initial'),
                },
                {
                  value: 'additional',
                  label: t(
                    'dpoDraft.lecturer.knowledgeBase.scenarios.additional'
                  ),
                },
                {
                  value: 'replacement',
                  label: t(
                    'dpoDraft.lecturer.knowledgeBase.scenarios.replacement'
                  ),
                },
                {
                  value: 'import',
                  label: t('dpoDraft.lecturer.knowledgeBase.scenarios.import'),
                },
              ]}
              onChange={(value) => {
                setScenario(value as UploadScenario)
                setResult('')
              }}
              data={{ cy: 'dpo-knowledge-upload-scenario' }}
              className={{ trigger: 'w-full' }}
            />
            <p className="text-xs leading-5 text-gray-600">
              {t('dpoDraft.lecturer.knowledgeBase.scenarioDescription')}
            </p>
          </div>

          <Formik<KnowledgeBaseFormValues>
            key={scenario}
            initialValues={initialValues}
            validateOnMount
            validationSchema={Yup.object({
              rightsAcknowledgement: Yup.boolean()
                .required()
                .oneOf(
                  [true],
                  t('dpoDraft.lecturer.knowledgeBase.acknowledgementRequired')
                ),
              privacyAcknowledgement: Yup.boolean()
                .required()
                .oneOf(
                  [true],
                  t('dpoDraft.lecturer.knowledgeBase.acknowledgementRequired')
                ),
            })}
            onSubmit={(_, { setSubmitting }) => {
              setResult(t('dpoDraft.lecturer.knowledgeBase.result'))
              setSubmitting(false)
            }}
          >
            {({ errors, isSubmitting, isValid, setFieldValue, values }) => (
              <Form
                className="flex flex-col gap-4"
                data-cy="dpo-knowledge-upload-form"
              >
                <p className="text-sm leading-6">
                  {t('dpoDraft.lecturer.knowledgeBase.lead')}
                </p>

                <div className="space-y-2">
                  <h3 className="font-semibold">
                    {t('dpoDraft.lecturer.knowledgeBase.rightsHeading')}
                  </h3>
                  <p className="text-sm leading-6">
                    {t('dpoDraft.lecturer.knowledgeBase.rightsParagraphOne')}
                  </p>
                  <p className="text-sm leading-6">
                    {t('dpoDraft.lecturer.knowledgeBase.rightsParagraphTwo')}
                  </p>
                </div>

                <div className="space-y-2">
                  <h3 className="font-semibold">
                    {t('dpoDraft.lecturer.knowledgeBase.privacyHeading')}
                  </h3>
                  <p className="text-sm leading-6">
                    {t('dpoDraft.lecturer.knowledgeBase.privacyParagraph')}
                  </p>
                </div>

                <p className="text-xs leading-5 text-gray-600">
                  {t('dpoDraft.lecturer.knowledgeBase.disclaimer')}
                </p>

                <Checkbox
                  id="dpo-knowledge-rights-acknowledgement"
                  checked={values.rightsAcknowledgement}
                  onCheck={() => {
                    setResult('')
                    void setFieldValue(
                      'rightsAcknowledgement',
                      !values.rightsAcknowledgement
                    )
                  }}
                  label={
                    <label htmlFor="dpo-knowledge-rights-acknowledgement">
                      {t(
                        'dpoDraft.lecturer.knowledgeBase.rightsAcknowledgement'
                      )}
                    </label>
                  }
                  data={{ cy: 'dpo-knowledge-rights-acknowledgement' }}
                />
                {errors.rightsAcknowledgement ? (
                  <p
                    className="text-sm text-red-700"
                    role="alert"
                    data-cy="dpo-knowledge-rights-error"
                  >
                    {errors.rightsAcknowledgement}
                  </p>
                ) : null}

                <Checkbox
                  id="dpo-knowledge-privacy-acknowledgement"
                  checked={values.privacyAcknowledgement}
                  onCheck={() => {
                    setResult('')
                    void setFieldValue(
                      'privacyAcknowledgement',
                      !values.privacyAcknowledgement
                    )
                  }}
                  label={
                    <label htmlFor="dpo-knowledge-privacy-acknowledgement">
                      {t(
                        'dpoDraft.lecturer.knowledgeBase.privacyAcknowledgement'
                      )}
                    </label>
                  }
                  data={{ cy: 'dpo-knowledge-privacy-acknowledgement' }}
                />
                {errors.privacyAcknowledgement ? (
                  <p
                    className="text-sm text-red-700"
                    role="alert"
                    data-cy="dpo-knowledge-privacy-error"
                  >
                    {errors.privacyAcknowledgement}
                  </p>
                ) : null}

                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    type="button"
                    onClick={closeModal}
                    data={{ cy: 'dpo-cancel-knowledge-upload' }}
                  >
                    {t('dpoDraft.lecturer.knowledgeBase.cancel')}
                  </Button>
                  <Button
                    primary
                    type="submit"
                    disabled={!isValid || isSubmitting}
                    loading={isSubmitting}
                    data={{ cy: 'dpo-submit-knowledge-upload' }}
                  >
                    {t('dpoDraft.lecturer.knowledgeBase.submit')}
                  </Button>
                </div>

                {result ? (
                  <p
                    aria-live="polite"
                    className="rounded bg-slate-100 p-3 text-sm"
                    data-cy="dpo-knowledge-upload-result"
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
