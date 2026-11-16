import { useQuery } from '@apollo/client'
import { GetAssessmentExportChatbotsDocument } from '@klicker-uzh/graphql/dist/ops'
import { ASSESSMENT_EXPORT_DISCLOSURE_VERSION } from '@klicker-uzh/types'
import { Button, Modal, UserNotification } from '@uzh-bf/design-system'
import { Form, Formik } from 'formik'
import { useLocale, useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'
import * as Yup from 'yup'

type AssessmentExportScope = 'COURSE' | 'LIVE_QUIZ'

interface AssessmentExportFormValues {
  acknowledgement: boolean
  kind: 'results' | 'transcripts'
  chatbotId: string
}

const TRANSCRIPT_POLL_INTERVAL_MS = 3000

interface AssessmentExportModalProps {
  courseId: string
  activityName: string
  liveQuizId?: string
  onClose: () => void
}

const exportHeaders = {
  'Content-Type': 'application/json',
  'x-graphql-yoga-csrf': '1',
}

function waitFor(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    const timer = window.setTimeout(resolve, ms)
    signal.addEventListener(
      'abort',
      () => {
        window.clearTimeout(timer)
        resolve()
      },
      { once: true }
    )
  })
}

// Polls the status route until the archive is ready. The ready response is the
// ZIP itself and can be fetched once; any other final status is a failure.
async function fetchTranscriptArchive(
  exportId: string,
  signal: AbortSignal
): Promise<Blob | null> {
  const url = new URL(
    `/api/data-exports/assessment-transcripts/${exportId}`,
    process.env.NEXT_PUBLIC_API_URL as string
  )
  while (!signal.aborted) {
    const response = await fetch(url, {
      credentials: 'include',
      headers: { 'x-graphql-yoga-csrf': '1' },
      signal,
    })
    if (!response.ok) return null
    if (response.headers.get('Content-Type')?.includes('application/zip')) {
      return await response.blob()
    }
    const { status } = (await response.json()) as { status?: string }
    if (status !== 'PENDING') return null
    await waitFor(TRANSCRIPT_POLL_INTERVAL_MS, signal)
  }
  return null
}

function downloadAssessmentExport(
  blob: Blob,
  requestId: string,
  extension: 'csv' | 'zip' = 'csv'
) {
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')

  try {
    anchor.href = objectUrl
    anchor.download = `assessment-export-${requestId}.${extension}`
    document.body.append(anchor)
    anchor.click()
    anchor.remove()
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
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
    'error' | 'preparing' | 'transcriptFailed' | undefined
  >()

  const scope: AssessmentExportScope = liveQuizId ? 'LIVE_QUIZ' : 'COURSE'

  // Chat transcripts are offered for the whole course only.
  const { data: chatbotData } = useQuery(GetAssessmentExportChatbotsDocument, {
    variables: { courseId },
    skip: scope !== 'COURSE',
  })
  const chatbots = chatbotData?.assessmentExportChatbots ?? []

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
    chatbotId: Yup.string().when('kind', ([kind], schema) =>
      kind === 'transcripts'
        ? schema.required(t('manage.assessmentExport.chatbotRequired'))
        : schema
    ),
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
        initialValues={{
          acknowledgement: false,
          kind: 'results',
          chatbotId: '',
        }}
        validateOnMount
        validationSchema={validationSchema}
        onSubmit={async (values) => {
          if (activeController.current) return

          setSubmissionStatus(undefined)
          const controller = new AbortController()
          activeController.current = controller
          const requestId = crypto.randomUUID()

          try {
            if (values.kind === 'transcripts') {
              const created = await fetch(
                new URL(
                  '/api/data-exports/assessment-transcripts',
                  process.env.NEXT_PUBLIC_API_URL as string
                ),
                {
                  method: 'POST',
                  credentials: 'include',
                  headers: exportHeaders,
                  body: JSON.stringify({
                    requestId,
                    courseId,
                    chatbotId: values.chatbotId,
                    locale,
                    disclosureVersion: ASSESSMENT_EXPORT_DISCLOSURE_VERSION,
                    acknowledgement: values.acknowledgement,
                  }),
                  signal: controller.signal,
                }
              )
              if (!created.ok) {
                if (!controller.signal.aborted && !closed.current) {
                  setSubmissionStatus('error')
                }
                return
              }
              setSubmissionStatus('preparing')
              const archive = await fetchTranscriptArchive(
                requestId,
                controller.signal
              )
              if (controller.signal.aborted || closed.current) return
              if (!archive) {
                setSubmissionStatus('transcriptFailed')
                return
              }
              downloadAssessmentExport(archive, requestId, 'zip')
              handleClose()
              return
            }

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
                  disclosureVersion: ASSESSMENT_EXPORT_DISCLOSURE_VERSION,
                  acknowledgement: values.acknowledgement,
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
              console.error('Assessment export request failed')
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

            {scope === 'COURSE' ? (
              <fieldset className="flex flex-col gap-2 text-sm">
                <legend className="font-semibold">
                  {t('manage.assessmentExport.kindLabel')}
                </legend>
                {(['results', 'transcripts'] as const).map((kind) => (
                  <label key={kind} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="kind"
                      checked={values.kind === kind}
                      disabled={isSubmitting}
                      onChange={() => {
                        setSubmissionStatus(undefined)
                        void setFieldValue('kind', kind)
                      }}
                      data-cy={`assessment-export-kind-${kind}`}
                    />
                    {t(
                      kind === 'results'
                        ? 'manage.assessmentExport.kindResults'
                        : 'manage.assessmentExport.kindTranscripts'
                    )}
                  </label>
                ))}
                {values.kind === 'transcripts' ? (
                  chatbots.length > 0 ? (
                    <label className="flex flex-col gap-1">
                      <span className="font-semibold">
                        {t('manage.assessmentExport.chatbotLabel')}
                      </span>
                      <select
                        name="chatbotId"
                        value={values.chatbotId}
                        disabled={isSubmitting}
                        onChange={(event) =>
                          void setFieldValue('chatbotId', event.target.value)
                        }
                        className="rounded border border-gray-300 p-1"
                        data-cy="assessment-export-chatbot"
                      >
                        <option value="">
                          {t('manage.assessmentExport.chatbotPlaceholder')}
                        </option>
                        {chatbots.map((chatbot) => (
                          <option key={chatbot.id} value={chatbot.id}>
                            {chatbot.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : (
                    <p>{t('manage.assessmentExport.noChatbots')}</p>
                  )
                ) : null}
              </fieldset>
            ) : null}

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

            {submissionStatus === 'preparing' ? (
              <div aria-live="polite">
                <UserNotification type="info">
                  {t('manage.assessmentExport.preparing')}
                </UserNotification>
              </div>
            ) : null}

            {submissionStatus === 'error' ||
            submissionStatus === 'transcriptFailed' ? (
              <div aria-live="polite">
                <UserNotification type="error">
                  {t(
                    submissionStatus === 'error'
                      ? 'manage.assessmentExport.requestFailed'
                      : 'manage.assessmentExport.transcriptFailed'
                  )}
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
                disabled={
                  isSubmitting ||
                  !isValid ||
                  (values.kind === 'transcripts' && !values.chatbotId)
                }
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
