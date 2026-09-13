import {
  Button,
  FormikTextareaField,
  FormikTextField,
  Modal,
  UserNotification,
} from '@uzh-bf/design-system'
import { Form, Formik, useField } from 'formik'
import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'
import * as Yup from 'yup'

type ResearchExportClass =
  | 'LIVE_QUIZ_RESPONSES'
  | 'ASYNCHRONOUS_RESPONSES'
  | 'LEARNING_ANALYTICS'
  | 'CHAT_TRANSCRIPTS'

interface ResearchExportFormValues {
  projectTitle: string
  responsiblePerson: string
  contactEmail: string
  purpose: string
  deletionDate: string
  reference: string
  selectedClasses: ResearchExportClass[]
  acknowledgement: boolean
}

interface ResearchExportModalProps {
  courseId: string
  courseName: string
  onClose: () => void
}

const researchExportClassValues: ResearchExportClass[] = [
  'LIVE_QUIZ_RESPONSES',
  'ASYNCHRONOUS_RESPONSES',
  'LEARNING_ANALYTICS',
  'CHAT_TRANSCRIPTS',
]

function isDateOnly(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false

  const date = new Date(`${value}T00:00:00.000Z`)
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  )
}

function getSafeFilename(projectTitle: string, requestId: string) {
  const safeProjectTitle = projectTitle
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)

  return `research-${safeProjectTitle || 'export'}-${requestId}.json`
}

function downloadResearchExport(
  blob: Blob,
  projectTitle: string,
  requestId: string
) {
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')

  try {
    anchor.href = objectUrl
    anchor.download = getSafeFilename(projectTitle, requestId)
    document.body.append(anchor)
    anchor.click()
    anchor.remove()
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

function ResearchExportClassOption({
  value,
  label,
  dataCy,
  disabled = false,
  unavailableHint,
}: {
  value: ResearchExportClass
  label: string
  dataCy: string
  disabled?: boolean
  unavailableHint?: string
}) {
  const [field, , helpers] = useField<ResearchExportClass[]>('selectedClasses')
  const checked = field.value.includes(value)
  const unavailableHintId = `${dataCy}-unavailable`

  return (
    <label
      className={`flex items-start gap-2 text-sm ${
        disabled ? 'text-gray-500' : 'text-gray-900'
      }`}
    >
      <input
        type="checkbox"
        name={field.name}
        checked={checked}
        disabled={disabled}
        onBlur={field.onBlur}
        onChange={() => {
          const nextClasses = checked
            ? field.value.filter((selectedClass) => selectedClass !== value)
            : [...field.value, value]
          void helpers.setValue(nextClasses)
        }}
        aria-describedby={unavailableHint ? unavailableHintId : undefined}
        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary-100 focus:ring-primary-100 disabled:cursor-not-allowed disabled:opacity-60"
        data-cy={dataCy}
      />
      <span>
        <span>{label}</span>
        {unavailableHint ? (
          <span id={unavailableHintId} className="ml-1 text-xs text-gray-500">
            ({unavailableHint})
          </span>
        ) : null}
      </span>
    </label>
  )
}

function ResearchExportAcknowledgement({ disabled }: { disabled: boolean }) {
  const [field, meta] = useField<boolean>('acknowledgement')
  const errorId = 'research-export-acknowledgement-error'
  const showError = Boolean(meta.touched && meta.error)

  return (
    <div>
      <label className="flex items-start gap-2 text-sm font-semibold text-gray-900">
        <input
          name={field.name}
          type="checkbox"
          checked={field.value}
          disabled={disabled}
          onBlur={field.onBlur}
          onChange={field.onChange}
          aria-describedby={showError ? errorId : undefined}
          aria-invalid={showError}
          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary-100 focus:ring-primary-100 disabled:cursor-not-allowed disabled:opacity-60"
          data-cy="research-export-acknowledgement"
        />
        <span>
          {useTranslations()('manage.researchExport.acknowledgement')}
        </span>
      </label>
      {showError ? (
        <p id={errorId} className="mt-1 text-sm text-red-700" role="alert">
          {meta.error}
        </p>
      ) : null}
    </div>
  )
}

function ResearchExportModal({
  courseId,
  courseName,
  onClose,
}: ResearchExportModalProps) {
  const t = useTranslations()
  const today = new Date().toISOString().slice(0, 10)
  const activeController = useRef<AbortController | null>(null)
  const closed = useRef(false)
  const [submissionStatus, setSubmissionStatus] = useState<
    'success' | 'error' | undefined
  >()

  useEffect(() => {
    closed.current = false

    return () => {
      closed.current = true
      activeController.current?.abort()
    }
  }, [])

  const validationSchema = Yup.object({
    projectTitle: Yup.string()
      .trim()
      .required(t('manage.researchExport.required'))
      .max(200, t('manage.researchExport.maxLength')),
    responsiblePerson: Yup.string()
      .trim()
      .required(t('manage.researchExport.required'))
      .max(200, t('manage.researchExport.maxLength')),
    contactEmail: Yup.string()
      .trim()
      .email(t('manage.researchExport.invalidEmail'))
      .required(t('manage.researchExport.required'))
      .max(254, t('manage.researchExport.maxLength')),
    purpose: Yup.string()
      .trim()
      .required(t('manage.researchExport.required'))
      .max(5000, t('manage.researchExport.maxLength')),
    deletionDate: Yup.string()
      .required(t('manage.researchExport.required'))
      .test(
        'valid-date-only',
        t('manage.researchExport.deletionDateInvalid'),
        (value) => !value || isDateOnly(value)
      )
      .test(
        'not-in-the-past',
        t('manage.researchExport.deletionDatePast'),
        (value) => !value || value >= today
      ),
    reference: Yup.string()
      .trim()
      .max(500, t('manage.researchExport.maxLength')),
    selectedClasses: Yup.array()
      .of(Yup.mixed<ResearchExportClass>().oneOf(researchExportClassValues))
      .min(1, t('manage.researchExport.classesRequired')),
    acknowledgement: Yup.boolean().oneOf(
      [true],
      t('manage.researchExport.acknowledgementRequired')
    ),
  })

  function handleClose() {
    closed.current = true
    activeController.current?.abort()
    activeController.current = null
    onClose()
  }

  return (
    <Modal
      open
      title={t('manage.researchExport.title')}
      onClose={handleClose}
      className={{
        content: 'min-w-0 max-w-[calc(100%-2rem)] p-4 md:max-w-4xl md:p-6',
      }}
      dataContent={{ cy: 'research-export-modal' }}
      dataCloseButton={{ cy: 'research-export-close' }}
    >
      <Formik<ResearchExportFormValues>
        initialValues={{
          projectTitle: '',
          responsiblePerson: '',
          contactEmail: '',
          purpose: '',
          deletionDate: '',
          reference: '',
          selectedClasses: [],
          acknowledgement: false,
        }}
        validateOnMount
        validationSchema={validationSchema}
        onSubmit={async (values) => {
          setSubmissionStatus(undefined)
          const controller = new AbortController()
          activeController.current = controller

          try {
            const requestId = crypto.randomUUID()
            const response = await fetch(
              new URL(
                '/api/data-exports/research',
                process.env.NEXT_PUBLIC_API_URL as string
              ),
              {
                method: 'POST',
                credentials: 'include',
                headers: {
                  'Content-Type': 'application/json',
                  'x-graphql-yoga-csrf': '1',
                },
                body: JSON.stringify({
                  requestId,
                  courseId,
                  projectTitle: values.projectTitle.trim(),
                  responsiblePerson: values.responsiblePerson.trim(),
                  contactEmail: values.contactEmail.trim(),
                  purpose: values.purpose.trim(),
                  deletionDate: values.deletionDate,
                  reference: values.reference.trim() || undefined,
                  selectedClasses: values.selectedClasses,
                  acknowledgement: true,
                  disclosureVersion: 'v1',
                }),
                signal: controller.signal,
              }
            )

            if (!response.ok) {
              if (!controller.signal.aborted && !closed.current) {
                setSubmissionStatus('error')
              }
              return
            }

            const blob = await response.blob()
            if (controller.signal.aborted || closed.current) return

            downloadResearchExport(blob, values.projectTitle, requestId)
            setSubmissionStatus('success')
          } catch {
            if (!controller.signal.aborted && !closed.current) {
              setSubmissionStatus('error')
            }
          } finally {
            if (activeController.current === controller) {
              activeController.current = null
            }
          }
        }}
      >
        {({ isSubmitting, isValid }) => (
          <Form className="flex flex-col gap-4">
            <section
              className="space-y-3"
              aria-labelledby="research-export-project"
            >
              <h2
                id="research-export-project"
                className="text-base font-semibold text-gray-900"
              >
                {t('manage.researchExport.projectDetailsTitle')}
              </h2>
              <p className="text-sm text-gray-600">
                {t('manage.researchExport.projectDetailsDescription')}
              </p>

              <FormikTextField
                required
                disabled={isSubmitting}
                id="research-export-project-title"
                name="projectTitle"
                label={t('manage.researchExport.projectTitle')}
                placeholder={t('manage.researchExport.projectTitlePlaceholder')}
                maxLength={200}
                data={{ cy: 'research-export-project-title' }}
              />

              <div className="grid gap-3 md:grid-cols-2">
                <FormikTextField
                  required
                  disabled={isSubmitting}
                  id="research-export-responsible-person"
                  name="responsiblePerson"
                  label={t('manage.researchExport.responsiblePerson')}
                  maxLength={200}
                  data={{ cy: 'research-export-responsible-person' }}
                />
                <FormikTextField
                  required
                  disabled={isSubmitting}
                  id="research-export-contact-email"
                  name="contactEmail"
                  type="email"
                  label={t('manage.researchExport.contactEmail')}
                  maxLength={254}
                  data={{ cy: 'research-export-contact-email' }}
                />
              </div>

              <div>
                <FormikTextareaField
                  required
                  disabled={isSubmitting}
                  id="research-export-purpose"
                  name="purpose"
                  rows={4}
                  label={t('manage.researchExport.purpose')}
                  maxLength={5000}
                  data={{ cy: 'research-export-purpose' }}
                />
                <p className="mt-1 text-xs text-gray-500">
                  {t('manage.researchExport.purposeHint')}
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <FormikTextField
                  required
                  disabled={isSubmitting}
                  id="research-export-deletion-date"
                  name="deletionDate"
                  type="date"
                  min={today}
                  label={t('manage.researchExport.deletionDate')}
                  data={{ cy: 'research-export-deletion-date' }}
                />
                <div>
                  <FormikTextField
                    disabled={isSubmitting}
                    id="research-export-reference"
                    name="reference"
                    label={t('manage.researchExport.reference')}
                    placeholder={t(
                      'manage.researchExport.referencePlaceholder'
                    )}
                    maxLength={500}
                    data={{ cy: 'research-export-reference' }}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    {t('manage.researchExport.referenceHint')}
                  </p>
                </div>
              </div>
            </section>

            <fieldset className="space-y-2 rounded-md border border-gray-200 p-3">
              <legend className="px-1 text-sm font-semibold text-gray-900">
                {t('manage.researchExport.dataClassesTitle')}
              </legend>
              <ResearchExportClassOption
                value="LIVE_QUIZ_RESPONSES"
                label={t('manage.researchExport.liveQuizResponses')}
                dataCy="research-export-class-live-quiz-responses"
                disabled={isSubmitting}
              />
              <ResearchExportClassOption
                value="ASYNCHRONOUS_RESPONSES"
                label={t('manage.researchExport.asynchronousResponses')}
                dataCy="research-export-class-asynchronous-responses"
                disabled={isSubmitting}
              />
              <ResearchExportClassOption
                value="LEARNING_ANALYTICS"
                label={t('manage.researchExport.learningAnalytics')}
                dataCy="research-export-class-learning-analytics"
                disabled
                unavailableHint={t('manage.researchExport.unavailableHint')}
              />
              <ResearchExportClassOption
                value="CHAT_TRANSCRIPTS"
                label={t('manage.researchExport.chatTranscripts')}
                dataCy="research-export-class-chat-transcripts"
                disabled
                unavailableHint={t('manage.researchExport.unavailableHint')}
              />
              <p className="text-sm text-gray-600">
                {t('manage.researchExport.classDataNote')}
              </p>
            </fieldset>

            <dl className="space-y-1 text-sm text-gray-700">
              <dt className="font-semibold text-gray-900">
                {t('manage.researchExport.scopeLabel')}
              </dt>
              <dd>{courseName}</dd>
              <dt className="pt-2 font-semibold text-gray-900">
                {t('manage.researchExport.classificationLabel')}
              </dt>
              <dd>{t('manage.researchExport.classification')}</dd>
            </dl>
            <p className="text-sm text-gray-700">
              {t('manage.researchExport.classificationNote')}
            </p>

            <div className="space-y-2 text-sm text-gray-700">
              <h2 className="text-base font-semibold text-gray-900">
                {t('manage.researchExport.attestationTitle')}
              </h2>
              <ol className="list-decimal space-y-2 pl-5">
                <li>{t('manage.researchExport.attestationPurpose')}</li>
                <li>
                  {t('manage.researchExport.attestationReidentification')}
                </li>
                <li>{t('manage.researchExport.attestationAccess')}</li>
                <li>{t('manage.researchExport.attestationSecurity')}</li>
              </ol>
              <p className="text-xs text-gray-500">
                {t('manage.researchExport.auditNote')}
              </p>
            </div>

            <ResearchExportAcknowledgement disabled={isSubmitting} />

            {submissionStatus ? (
              <div aria-live="polite">
                <UserNotification
                  type={submissionStatus === 'error' ? 'error' : 'success'}
                >
                  {t(
                    submissionStatus === 'error'
                      ? 'manage.researchExport.requestFailed'
                      : 'manage.researchExport.downloadStarted'
                  )}
                </UserNotification>
              </div>
            ) : null}

            <div className="flex flex-row justify-end gap-2">
              <Button
                type="button"
                onClick={handleClose}
                data={{ cy: 'research-export-cancel' }}
              >
                {t('manage.researchExport.cancel')}
              </Button>
              <Button
                primary
                type="submit"
                disabled={isSubmitting || !isValid}
                loading={isSubmitting}
                data={{ cy: 'research-export-submit' }}
              >
                {t('manage.researchExport.submit')}
              </Button>
            </div>
          </Form>
        )}
      </Formik>
    </Modal>
  )
}

export default ResearchExportModal
