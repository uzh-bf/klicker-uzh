import { Button, Modal, UserNotification } from '@uzh-bf/design-system'
import { Form, Formik } from 'formik'
import { useLocale, useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'
import * as Yup from 'yup'

type AssessmentExportScope = 'COURSE' | 'LIVE_QUIZ'

interface AssessmentExportFormValues {
  acknowledgement: boolean
}

interface AssessmentExportModalProps {
  courseId: string
  activityName: string
  liveQuizId?: string
  onClose: () => void
}

function getSafeFilename(requestId: string) {
  const safeRequestId = requestId.replace(/[^a-zA-Z0-9-]/g, '').slice(0, 36)

  return `assessment-export-${safeRequestId || 'export'}.csv`
}

function downloadAssessmentExport(blob: Blob, requestId: string) {
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')

  try {
    anchor.href = objectUrl
    anchor.download = getSafeFilename(requestId)
    document.body.append(anchor)
    anchor.click()
    anchor.remove()
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

function AssessmentExportModal({
  courseId,
  activityName,
  liveQuizId,
  onClose,
}: AssessmentExportModalProps) {
  const t = useTranslations()
  const locale = useLocale() === 'de' ? 'de' : 'en'
  const activeController = useRef<AbortController | null>(null)
  const closed = useRef(false)
  const [submissionStatus, setSubmissionStatus] = useState<
    'error' | undefined
  >()

  const scope: AssessmentExportScope = liveQuizId ? 'LIVE_QUIZ' : 'COURSE'

  useEffect(() => {
    closed.current = false

    return () => {
      closed.current = true
      activeController.current?.abort()
    }
  }, [])

  const validationSchema = Yup.object({
    acknowledgement: Yup.boolean()
      .required()
      .oneOf([true], t('manage.assessmentExport.acknowledgementRequired')),
  })

  function handleClose() {
    closed.current = true
    activeController.current?.abort()
    activeController.current = null
    setSubmissionStatus(undefined)
    onClose()
  }

  return (
    <Modal
      open
      title={t('manage.assessmentExport.title')}
      onClose={handleClose}
      className={{
        content: 'min-w-0 max-w-[calc(100%-2rem)] p-4 md:max-w-3xl md:p-6',
      }}
      dataContent={{ cy: 'assessment-export-modal' }}
      dataCloseButton={{ cy: 'assessment-export-close' }}
    >
      <Formik<AssessmentExportFormValues>
        initialValues={{ acknowledgement: false }}
        validateOnMount
        validationSchema={validationSchema}
        onSubmit={async () => {
          if (activeController.current) return

          setSubmissionStatus(undefined)
          const controller = new AbortController()
          activeController.current = controller
          const requestId = crypto.randomUUID()

          try {
            const response = await fetch(
              new URL(
                '/api/data-exports/assessment',
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
                  scope,
                  ...(liveQuizId ? { liveQuizId } : {}),
                  locale,
                  disclosureVersion: 'v1',
                  acknowledgement: true,
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

            downloadAssessmentExport(blob, requestId)
            handleClose()
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
        {({ isSubmitting, isValid, resetForm, setFieldValue, values }) => (
          <Form
            className="flex flex-col gap-4"
            data-cy="assessment-export-form"
          >
            <span className="w-fit rounded bg-red-100 px-2 py-1 text-sm font-semibold text-red-900">
              {t('manage.assessmentExport.classification')}
            </span>

            <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
              <dt className="font-semibold">
                {t('manage.assessmentExport.assessmentLabel')}
              </dt>
              <dd>{activityName}</dd>
              <dt className="font-semibold">
                {t('manage.assessmentExport.scopeLabel')}
              </dt>
              <dd>
                {t(
                  scope === 'LIVE_QUIZ'
                    ? 'manage.assessmentExport.liveQuizScope'
                    : 'manage.assessmentExport.courseScope'
                )}
              </dd>
            </dl>

            <p className="text-sm leading-6">
              {t('manage.assessmentExport.lead')}
            </p>

            <div className="space-y-2">
              <h2 className="font-semibold">
                {t('manage.assessmentExport.attestationsHeading')}
              </h2>
              <ol className="list-decimal space-y-2 pl-5 text-sm leading-6">
                <li>
                  <strong>
                    {t('manage.assessmentExport.attestations.purposeLabel')}
                  </strong>{' '}
                  {t('manage.assessmentExport.attestations.purposeText')}
                </li>
                <li>
                  <strong>
                    {t('manage.assessmentExport.attestations.accessLabel')}
                  </strong>{' '}
                  {t('manage.assessmentExport.attestations.accessText')}
                </li>
                <li>
                  <strong>
                    {t('manage.assessmentExport.attestations.storageLabel')}
                  </strong>{' '}
                  {t('manage.assessmentExport.attestations.storageText')}
                </li>
                <li>
                  <strong>
                    {t('manage.assessmentExport.attestations.retentionLabel')}
                  </strong>{' '}
                  {t('manage.assessmentExport.attestations.retentionText')}
                </li>
              </ol>
            </div>

            <p className="text-xs leading-5 text-gray-600">
              {t('manage.assessmentExport.logging')}
            </p>

            <label className="flex items-start gap-2 text-sm font-semibold text-gray-900">
              <input
                name="acknowledgement"
                type="checkbox"
                checked={values.acknowledgement}
                disabled={isSubmitting}
                onChange={() => {
                  setSubmissionStatus(undefined)
                  void setFieldValue('acknowledgement', !values.acknowledgement)
                }}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary-100 focus:ring-primary-100 disabled:cursor-not-allowed disabled:opacity-60"
                data-cy="assessment-export-acknowledgement"
              />
              <span>{t('manage.assessmentExport.acknowledgement')}</span>
            </label>

            {submissionStatus === 'error' ? (
              <div aria-live="polite">
                <UserNotification type="error">
                  {t('manage.assessmentExport.requestFailed')}
                </UserNotification>
              </div>
            ) : null}

            <div className="flex flex-row justify-end gap-2">
              <Button
                type="button"
                onClick={() => {
                  resetForm()
                  handleClose()
                }}
                data={{ cy: 'assessment-export-cancel' }}
              >
                {t('manage.assessmentExport.cancel')}
              </Button>
              <Button
                primary
                type="submit"
                disabled={isSubmitting || !isValid}
                loading={isSubmitting}
                data={{ cy: 'assessment-export-submit' }}
              >
                {t('manage.assessmentExport.submit')}
              </Button>
            </div>
          </Form>
        )}
      </Formik>
    </Modal>
  )
}

export default AssessmentExportModal
