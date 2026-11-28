import {
  Button,
  Checkbox,
  FormikTextareaField,
  FormikTextField,
  Modal,
} from '@uzh-bf/design-system'
import { Form, Formik } from 'formik'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import * as Yup from 'yup'

type ResearchDataClasses = {
  liveQuizAnswers: boolean
  asynchronousAnswers: boolean
  learningAnalytics: boolean
  chatTranscripts: boolean
}

type ResearchFormValues = {
  projectTitle: string
  responsiblePerson: string
  contactAddress: string
  purpose: string
  deletionDate: string
  reference: string
  dataClasses: ResearchDataClasses
  acknowledgement: boolean
}

function localDateString() {
  const today = new Date()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${today.getFullYear()}-${month}-${day}`
}

export default function ResearchExportDraft() {
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

  function validationSchema() {
    const requiredText = () =>
      Yup.string().test(
        'non-blank',
        t('dpoDraft.lecturer.research.required'),
        (value) => Boolean(value?.trim())
      )

    return Yup.object({
      projectTitle: requiredText(),
      responsiblePerson: requiredText(),
      contactAddress: requiredText().email(
        t('dpoDraft.lecturer.research.invalidEmail')
      ),
      purpose: requiredText(),
      deletionDate: requiredText().test(
        'not-before-local-today',
        t('dpoDraft.lecturer.research.deletionDateTooEarly'),
        (value) => !value || value >= localDateString()
      ),
      reference: Yup.string(),
      dataClasses: Yup.object({
        liveQuizAnswers: Yup.boolean(),
        asynchronousAnswers: Yup.boolean(),
        learningAnalytics: Yup.boolean(),
        chatTranscripts: Yup.boolean(),
      }).test(
        'at-least-one-data-class',
        t('dpoDraft.lecturer.research.dataClassRequired'),
        (value) => Boolean(value && Object.values(value).some(Boolean))
      ),
      acknowledgement: Yup.boolean()
        .required()
        .oneOf([true], t('dpoDraft.lecturer.research.acknowledgementRequired')),
    })
  }

  const initialValues: ResearchFormValues = {
    projectTitle: '',
    responsiblePerson: '',
    contactAddress: '',
    purpose: '',
    deletionDate: '',
    reference: '',
    dataClasses: {
      liveQuizAnswers: false,
      asynchronousAnswers: false,
      learningAnalytics: false,
      chatTranscripts: false,
    },
    acknowledgement: false,
  }

  return (
    <section className="space-y-3" data-cy="dpo-research-export-draft">
      <p className="text-sm text-gray-700">
        {t('dpoDraft.lecturer.research.context')}
      </p>
      <Button onClick={openModal} data={{ cy: 'dpo-open-research-export' }}>
        {t('dpoDraft.lecturer.research.open')}
      </Button>

      {open ? (
        <Modal
          open
          onClose={closeModal}
          title={t('dpoDraft.lecturer.research.title')}
          data={{ cy: 'dpo-research-export-modal' }}
          dataCloseButton={{ cy: 'dpo-close-research-export' }}
          className={{ content: 'max-w-4xl' }}
        >
          <Formik<ResearchFormValues>
            initialValues={initialValues}
            validateOnMount
            validationSchema={validationSchema}
            onSubmit={(_, { setSubmitting }) => {
              setResult(t('dpoDraft.lecturer.research.result'))
              setSubmitting(false)
            }}
          >
            {({
              errors,
              isSubmitting,
              isValid,
              setFieldTouched,
              setFieldValue,
              values,
            }) => {
              const dataClassError =
                typeof errors.dataClasses === 'string'
                  ? errors.dataClasses
                  : undefined

              return (
                <Form
                  className="flex flex-col gap-4"
                  data-cy="dpo-research-export-form"
                  onChange={() => {
                    if (result) setResult('')
                  }}
                >
                  <span className="w-fit rounded bg-slate-100 px-2 py-1 text-sm font-semibold text-gray-800">
                    {t('dpoDraft.lecturer.research.classification')}
                  </span>

                  <section className="space-y-3">
                    <h3 className="font-semibold">
                      {t('dpoDraft.lecturer.research.projectHeading')}
                    </h3>
                    <p className="text-sm leading-6 text-gray-600">
                      {t('dpoDraft.lecturer.research.projectNotice')}
                    </p>

                    <FormikTextField
                      id="dpo-research-project-title"
                      name="projectTitle"
                      label={t('dpoDraft.lecturer.research.projectTitleLabel')}
                      required
                      placeholder={t(
                        'dpoDraft.lecturer.research.projectTitlePlaceholder'
                      )}
                      data={{ cy: 'dpo-research-project-title' }}
                    />

                    <div className="grid gap-3 md:grid-cols-2">
                      <FormikTextField
                        id="dpo-research-responsible-person"
                        name="responsiblePerson"
                        label={t(
                          'dpoDraft.lecturer.research.responsiblePersonLabel'
                        )}
                        required
                        data={{ cy: 'dpo-research-responsible-person' }}
                      />
                      <FormikTextField
                        id="dpo-research-contact-address"
                        name="contactAddress"
                        type="email"
                        label={t(
                          'dpoDraft.lecturer.research.contactAddressLabel'
                        )}
                        required
                        data={{ cy: 'dpo-research-contact-address' }}
                      />
                    </div>

                    <FormikTextareaField
                      id="dpo-research-purpose"
                      name="purpose"
                      rows="2"
                      label={t('dpoDraft.lecturer.research.purposeLabel')}
                      required
                      data={{ cy: 'dpo-research-purpose' }}
                    />

                    <div className="grid gap-3 md:grid-cols-2">
                      <FormikTextField
                        id="dpo-research-deletion-date"
                        name="deletionDate"
                        type="date"
                        min={localDateString()}
                        label={t(
                          'dpoDraft.lecturer.research.deletionDateLabel'
                        )}
                        required
                        data={{ cy: 'dpo-research-deletion-date' }}
                      />
                      <FormikTextField
                        id="dpo-research-reference"
                        name="reference"
                        className={{ root: 'min-w-0', label: 'min-w-0' }}
                        label={t('dpoDraft.lecturer.research.referenceLabel')}
                        placeholder={t(
                          'dpoDraft.lecturer.research.referencePlaceholder'
                        )}
                        data={{ cy: 'dpo-research-reference' }}
                      />
                    </div>
                  </section>

                  <fieldset className="space-y-2 rounded border border-gray-300 p-3">
                    <legend className="px-1 text-sm font-semibold">
                      {t('dpoDraft.lecturer.research.dataClassesLegend')}
                    </legend>
                    <Checkbox
                      id="dpo-research-class-live-quiz"
                      checked={values.dataClasses.liveQuizAnswers}
                      onCheck={() => {
                        setResult('')
                        void setFieldValue(
                          'dataClasses.liveQuizAnswers',
                          !values.dataClasses.liveQuizAnswers
                        )
                        void setFieldTouched('dataClasses', true, false)
                      }}
                      label={
                        <label htmlFor="dpo-research-class-live-quiz">
                          {t(
                            'dpoDraft.lecturer.research.dataClasses.liveQuizAnswers'
                          )}
                        </label>
                      }
                      data={{ cy: 'dpo-research-class-live-quiz' }}
                    />
                    <Checkbox
                      id="dpo-research-class-asynchronous"
                      checked={values.dataClasses.asynchronousAnswers}
                      onCheck={() => {
                        setResult('')
                        void setFieldValue(
                          'dataClasses.asynchronousAnswers',
                          !values.dataClasses.asynchronousAnswers
                        )
                        void setFieldTouched('dataClasses', true, false)
                      }}
                      label={
                        <label htmlFor="dpo-research-class-asynchronous">
                          {t(
                            'dpoDraft.lecturer.research.dataClasses.asynchronousAnswers'
                          )}
                        </label>
                      }
                      data={{ cy: 'dpo-research-class-asynchronous' }}
                    />
                    <Checkbox
                      id="dpo-research-class-learning-analytics"
                      checked={values.dataClasses.learningAnalytics}
                      onCheck={() => {
                        setResult('')
                        void setFieldValue(
                          'dataClasses.learningAnalytics',
                          !values.dataClasses.learningAnalytics
                        )
                        void setFieldTouched('dataClasses', true, false)
                      }}
                      label={
                        <label htmlFor="dpo-research-class-learning-analytics">
                          {t(
                            'dpoDraft.lecturer.research.dataClasses.learningAnalytics'
                          )}
                        </label>
                      }
                      data={{ cy: 'dpo-research-class-learning-analytics' }}
                    />
                    <Checkbox
                      id="dpo-research-class-chat-transcripts"
                      checked={values.dataClasses.chatTranscripts}
                      onCheck={() => {
                        setResult('')
                        void setFieldValue(
                          'dataClasses.chatTranscripts',
                          !values.dataClasses.chatTranscripts
                        )
                        void setFieldTouched('dataClasses', true, false)
                      }}
                      label={
                        <label htmlFor="dpo-research-class-chat-transcripts">
                          {t(
                            'dpoDraft.lecturer.research.dataClasses.chatTranscripts'
                          )}
                        </label>
                      }
                      data={{ cy: 'dpo-research-class-chat-transcripts' }}
                    />
                    <p className="pl-7 text-xs leading-5 text-gray-600">
                      {t('dpoDraft.lecturer.research.transcriptWarning')}
                    </p>
                    {dataClassError ? (
                      <p
                        className="text-sm text-red-700"
                        role="alert"
                        data-cy="dpo-research-data-class-error"
                      >
                        {dataClassError}
                      </p>
                    ) : null}
                  </fieldset>

                  <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
                    <dt className="font-semibold">
                      {t('dpoDraft.lecturer.research.scopeLabel')}
                    </dt>
                    <dd>{t('dpoDraft.lecturer.research.scopeValue')}</dd>
                    <dt className="font-semibold">
                      {t('dpoDraft.lecturer.research.classificationLabel')}
                    </dt>
                    <dd>
                      {values.dataClasses.chatTranscripts
                        ? t(
                            'dpoDraft.lecturer.research.classificationWithTranscripts'
                          )
                        : t('dpoDraft.lecturer.research.classification')}
                    </dd>
                  </dl>

                  <p className="text-sm leading-6">
                    {t('dpoDraft.lecturer.research.lead')}
                  </p>

                  <div className="space-y-2">
                    <h3 className="font-semibold">
                      {t('dpoDraft.lecturer.research.attestationsHeading')}
                    </h3>
                    <ol className="list-decimal space-y-2 pl-5 text-sm leading-6">
                      <li>
                        <strong>
                          {t(
                            'dpoDraft.lecturer.research.attestations.purposeLabel'
                          )}
                        </strong>{' '}
                        {t(
                          'dpoDraft.lecturer.research.attestations.purposeText'
                        )}
                      </li>
                      <li>
                        <strong>
                          {t(
                            'dpoDraft.lecturer.research.attestations.noReidentificationLabel'
                          )}
                        </strong>{' '}
                        {t(
                          'dpoDraft.lecturer.research.attestations.noReidentificationText'
                        )}
                      </li>
                      <li>
                        <strong>
                          {t(
                            'dpoDraft.lecturer.research.attestations.accessLabel'
                          )}
                        </strong>{' '}
                        {t(
                          'dpoDraft.lecturer.research.attestations.accessText'
                        )}
                      </li>
                      <li>
                        <strong>
                          {t(
                            'dpoDraft.lecturer.research.attestations.securityLabel'
                          )}
                        </strong>{' '}
                        {t(
                          'dpoDraft.lecturer.research.attestations.securityText'
                        )}
                      </li>
                    </ol>
                  </div>

                  <p className="text-xs leading-5 text-gray-600">
                    {t('dpoDraft.lecturer.research.logging')}
                  </p>

                  <Checkbox
                    id="dpo-research-export-acknowledgement"
                    checked={values.acknowledgement}
                    onCheck={() => {
                      setResult('')
                      void setFieldValue(
                        'acknowledgement',
                        !values.acknowledgement
                      )
                    }}
                    label={
                      <label htmlFor="dpo-research-export-acknowledgement">
                        <strong>
                          {t('dpoDraft.lecturer.research.acknowledgement')}
                        </strong>
                      </label>
                    }
                    data={{ cy: 'dpo-research-export-acknowledgement' }}
                  />
                  {errors.acknowledgement ? (
                    <p
                      className="text-sm text-red-700"
                      role="alert"
                      data-cy="dpo-research-export-acknowledgement-error"
                    >
                      {errors.acknowledgement}
                    </p>
                  ) : null}

                  <div className="flex flex-wrap justify-end gap-2">
                    <Button
                      type="button"
                      onClick={closeModal}
                      data={{ cy: 'dpo-cancel-research-export' }}
                    >
                      {t('dpoDraft.lecturer.research.cancel')}
                    </Button>
                    <Button
                      primary
                      type="submit"
                      disabled={!isValid || isSubmitting}
                      loading={isSubmitting}
                      data={{ cy: 'dpo-submit-research-export' }}
                    >
                      {t('dpoDraft.lecturer.research.submit')}
                    </Button>
                  </div>

                  {result ? (
                    <p
                      aria-live="polite"
                      className="rounded bg-slate-100 p-3 text-sm"
                      data-cy="dpo-research-export-result"
                      role="status"
                    >
                      {result}
                    </p>
                  ) : null}
                </Form>
              )
            }}
          </Formik>
        </Modal>
      ) : null}
    </section>
  )
}
