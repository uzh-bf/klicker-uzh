import { ApolloError, useMutation, useSuspenseQuery } from '@apollo/client'
import {
  faArrowUpRightFromSquare,
  faDownload,
  faRotate,
} from '@fortawesome/free-solid-svg-icons'
import {
  GetStudentAssessmentResultsDocument,
  MIssueCredentialDocument,
  type MIssueCredentialMutation,
} from '@klicker-uzh/graphql/dist/ops'
import { routing } from '@klicker-uzh/i18n'
import { ActivityType } from '@klicker-uzh/types'
import { Button, H3, UserNotification } from '@uzh-bf/design-system'
import { useLocale, useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'
import { QRCode } from 'react-qrcode-logo'
import AssessmentResultsList from './AssessmentResultsList'
import {
  type AssessmentReportArtifact,
  createAssessmentReport,
  type ExportReportTexts,
  loadPublicImageAsDataUrl,
} from './exportReport'
import { isScoreInHistogramBin } from './histogram'

type IssuedAssessmentReport = MIssueCredentialMutation['issueAssessmentReport']
const ASSESSMENT_REPORT_QR_ID = 'assessment-report-qr-code'
const ASSESSMENT_REPORT_PRINT_CHECK_INTERVAL_MS = 50
const ASSESSMENT_REPORT_PRINT_TIMEOUT_MS = 10_000
const ASSESSMENT_REPORT_QR_TIMEOUT_MS = 10_000

type QrCodeRequest = {
  logoDataUrl: string
  value: string
}

type QrCodeRequestResult = {
  reject: (error: Error) => void
  resolve: (dataUrl: string) => void
}

function getAssessmentReportIssueErrorKey(error: unknown) {
  const code =
    error instanceof ApolloError
      ? error.graphQLErrors
          .map((graphQLError) => graphQLError.extensions?.code)
          .find((extensionCode) => typeof extensionCode === 'string')
      : undefined

  switch (code) {
    case 'ASSESSMENT_REPORT_NOT_ELIGIBLE':
      return 'pwa.assessment.exportReportNotEligibleError' as const
    case 'ASSESSMENT_REPORT_IDENTITY_UNVERIFIED':
      return 'pwa.assessment.exportReportIdentityUnverifiedError' as const
    case 'ASSESSMENT_REPORT_REVOKED':
      return 'pwa.assessment.exportReportRevokedError' as const
    case 'ASSESSMENT_REPORT_INVALID_DATA':
      return 'pwa.assessment.exportReportInvalidDataError' as const
    default:
      return 'pwa.assessment.exportReportIssuanceError' as const
  }
}

function SuspendedAssessmentResults({ courseId }: { courseId: string }) {
  const t = useTranslations()
  const locale = useLocale()
  // `errorPolicy: 'all'` returns GraphQL errors instead of throwing them (e.g. a
  // participant without an accepted course invitation). There is no error boundary
  // above this component, so a thrown error takes down the whole course page
  // instead of rendering the notification below.
  const { data, error } = useSuspenseQuery(
    GetStudentAssessmentResultsDocument,
    {
      variables: { courseId },
      fetchPolicy: 'network-only',
      errorPolicy: 'all',
    }
  )
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [reportArtifact, setReportArtifact] =
    useState<AssessmentReportArtifact | null>(null)
  const [qrCodeRequest, setQrCodeRequest] = useState<QrCodeRequest | null>(null)
  const qrCodeRequestResult = useRef<QrCodeRequestResult | null>(null)
  const qrCodeRequestTimeout = useRef<number | null>(null)
  const [issueAssessmentReport] = useMutation(MIssueCredentialDocument)

  // Swallowing the error above would otherwise leave no trace of why the results
  // failed to load - this keeps the cause recoverable from the browser console.
  useEffect(() => {
    if (error) console.error(error)
  }, [error])

  useEffect(() => {
    if (!reportArtifact) return

    return () => {
      URL.revokeObjectURL(reportArtifact.url)
    }
  }, [reportArtifact])

  useEffect(() => {
    return () => {
      if (qrCodeRequestTimeout.current !== null) {
        window.clearTimeout(qrCodeRequestTimeout.current)
      }
      qrCodeRequestTimeout.current = null
      qrCodeRequestResult.current?.reject(
        new Error('ASSESSMENT_REPORT_QR_RENDER_CANCELLED')
      )
      qrCodeRequestResult.current = null
    }
  }, [])

  function clearQrCodeRequestTimeout() {
    if (qrCodeRequestTimeout.current !== null) {
      window.clearTimeout(qrCodeRequestTimeout.current)
      qrCodeRequestTimeout.current = null
    }
  }

  function rejectQrCodeRequest(error: Error) {
    clearQrCodeRequestTimeout()
    const result = qrCodeRequestResult.current
    qrCodeRequestResult.current = null
    result?.reject(error)
    setQrCodeRequest(null)
  }

  function resolveQrCodeRequest(dataUrl: string) {
    clearQrCodeRequestTimeout()
    const result = qrCodeRequestResult.current
    qrCodeRequestResult.current = null
    result?.resolve(dataUrl)
    setQrCodeRequest(null)
  }

  function createLogoQrCodeDataUrl(
    value: string,
    logoDataUrl: string
  ): Promise<string> {
    if (qrCodeRequestResult.current) {
      rejectQrCodeRequest(new Error('ASSESSMENT_REPORT_QR_RENDER_REPLACED'))
    }

    return new Promise((resolve, reject) => {
      qrCodeRequestResult.current = { resolve, reject }
      qrCodeRequestTimeout.current = window.setTimeout(() => {
        rejectQrCodeRequest(new Error('ASSESSMENT_REPORT_QR_RENDER_TIMEOUT'))
      }, ASSESSMENT_REPORT_QR_TIMEOUT_MS)
      setQrCodeRequest({ logoDataUrl, value })
    })
  }

  function handleQrCodeLogoLoad() {
    const canvas = document.getElementById(ASSESSMENT_REPORT_QR_ID)
    const result = qrCodeRequestResult.current
    if (!(canvas instanceof HTMLCanvasElement) || !result) {
      if (result) {
        rejectQrCodeRequest(new Error('ASSESSMENT_REPORT_QR_RENDER_FAILED'))
      } else {
        setQrCodeRequest(null)
      }
      return
    }

    try {
      resolveQrCodeRequest(canvas.toDataURL('image/png'))
    } catch (error) {
      rejectQrCodeRequest(
        error instanceof Error
          ? error
          : new Error('ASSESSMENT_REPORT_QR_RENDER_FAILED')
      )
    }
  }

  function handleViewReport() {
    if (!reportArtifact) return
    setExportError(null)
    const reportWindow = window.open(reportArtifact.url, '_blank')
    if (reportWindow) {
      reportWindow.opener = null
    } else {
      setExportError(t('pwa.assessment.exportReportViewError'))
    }
  }

  function handlePrintReport() {
    if (!reportArtifact) return
    setExportError(null)

    const openedWindow = window.open('about:blank', '_blank')
    if (!openedWindow) {
      setExportError(t('pwa.assessment.exportReportPrintError'))
      return
    }
    const reportWindow: Window = openedWindow
    const reportUrl = reportArtifact.url

    let readinessCheck: number | null = null
    let printTimeout: number | null = null
    let settled = false

    function cleanup() {
      if (readinessCheck !== null) {
        window.clearTimeout(readinessCheck)
        readinessCheck = null
      }
      if (printTimeout !== null) {
        window.clearTimeout(printTimeout)
        printTimeout = null
      }
      reportWindow.removeEventListener('load', checkReadiness)
    }

    function failPrint(error?: unknown) {
      if (settled) return
      settled = true
      cleanup()
      if (error) console.error('Failed to print assessment report', error)
      try {
        reportWindow.close()
      } catch {
        // The popup may already be closed.
      }
      setExportError(t('pwa.assessment.exportReportPrintError'))
    }

    function checkReadiness() {
      if (settled) return
      if (readinessCheck !== null) {
        window.clearTimeout(readinessCheck)
        readinessCheck = null
      }

      try {
        if (reportWindow.closed) {
          failPrint()
          return
        }
        if (
          reportWindow.location.href !== reportUrl ||
          reportWindow.document.readyState !== 'complete'
        ) {
          readinessCheck = window.setTimeout(
            checkReadiness,
            ASSESSMENT_REPORT_PRINT_CHECK_INTERVAL_MS
          )
          return
        }

        reportWindow.focus()
        reportWindow.print()
        settled = true
        cleanup()
      } catch (error) {
        failPrint(error)
      }
    }

    reportWindow.addEventListener('load', checkReadiness)
    try {
      reportWindow.location.href = reportUrl
      readinessCheck = window.setTimeout(
        checkReadiness,
        ASSESSMENT_REPORT_PRINT_CHECK_INTERVAL_MS
      )
      printTimeout = window.setTimeout(
        () => failPrint(),
        ASSESSMENT_REPORT_PRINT_TIMEOUT_MS
      )
    } catch (error) {
      failPrint(error)
    }
  }

  const results = data?.studentAssessmentResults
  const liveQuizzes = results?.liveQuizzes ?? []
  const practiceQuizzes = results?.practiceQuizzes ?? []
  const microLearnings = results?.microLearnings ?? []
  const groupActivities = results?.groupActivities ?? []

  async function handleExport() {
    setIsExporting(true)
    setExportError(null)
    // Drop any previously rendered artifact: a failed re-issue must not leave a
    // stale (possibly revoked) report on screen presented as ready.
    setReportArtifact(null)
    try {
      let report: IssuedAssessmentReport
      try {
        const response = await issueAssessmentReport({
          variables: { courseId },
        })
        const issuedReport = response.data?.issueAssessmentReport
        if (!issuedReport) throw new Error('ASSESSMENT_REPORT_ISSUANCE_FAILED')
        report = issuedReport
      } catch (error) {
        setExportError(t(getAssessmentReportIssueErrorKey(error)))
        return
      }

      const localePrefix = locale === routing.defaultLocale ? '' : `/${locale}`
      const verificationUrl = `${window.location.origin}${localePrefix}/verify#${report.token}`
      try {
        const [klickerLogoDataUrl, uzhLogoDataUrl] = await Promise.all([
          loadPublicImageAsDataUrl('/KlickerLogo.png'),
          loadPublicImageAsDataUrl('/uzhlogo_email.png'),
        ])
        const qrCodeDataUrl = await createLogoQrCodeDataUrl(
          verificationUrl,
          klickerLogoDataUrl
        )
        const identitySourceLabel = t(
          'pwa.assessment.identitySourceCourseInvitation'
        )
        const comparison = report.snapshot.comparison
        const userBin = comparison?.histogram.find((bin, index, histogram) => {
          return isScoreInHistogramBin({
            score: report.snapshot.results.totalPoints,
            bin,
            isLast: index === histogram.length - 1,
            availableTotalPoints: report.snapshot.results.availableTotalPoints,
          })
        })
        const numberFormatter = new Intl.NumberFormat(locale, {
          maximumFractionDigits: 2,
        })
        const histogramUserRange = userBin
          ? t('pwa.assessment.histogramUserRange', {
              range: `${numberFormatter.format(userBin.binStart)}-${numberFormatter.format(userBin.binEnd)}`,
            })
          : ''
        const texts: ExportReportTexts = {
          documentTitle: t('pwa.assessment.reportTitle'),
          issuedAt: t('pwa.assessment.issuedAt'),
          timeZone: t('pwa.assessment.reportTimeZone'),
          course: t('pwa.assessment.courseNameLabel'),
          courseReference: t('pwa.assessment.courseReferenceLabel'),
          student: t('pwa.assessment.studentEmailLabel'),
          identitySource: t('pwa.assessment.identitySourceLabel'),
          pointsSummary: t('pwa.assessment.pointsSummaryLabel'),
          achieved: t('pwa.assessment.achievedPointsLabel'),
          available: t('pwa.assessment.availablePointsLabel'),
          basePoints: t('pwa.assessment.basePoints'),
          correctnessPoints: t('pwa.assessment.correctnessPoints'),
          bonusPoints: t('pwa.assessment.bonusPoints'),
          totalPoints: t('pwa.assessment.totalPoints'),
          comparisonTitle: t('pwa.assessment.performanceInsightsTitle'),
          percentileText: comparison
            ? t('pwa.assessment.percentileText', {
                percentile: comparison.percentile,
              })
            : '',
          percentileExplanation: t('pwa.assessment.percentileExplanation'),
          histogramTitle: t('pwa.assessment.histogramTitle'),
          histogramDescription: t('pwa.assessment.histogramDescription'),
          histogramUserRange,
          noComparison: t('pwa.assessment.notEnoughDataForComparison'),
          privacyTitle: t('pwa.assessment.privacyNoticeTitle'),
          privacyText: t('pwa.assessment.privacyAndTransparencyNotice'),
          scoreRange: t('pwa.assessment.binLabel'),
          participantCount: t('pwa.assessment.countLabel'),
          yourScore: t('pwa.assessment.yourScoreLabel'),
          verificationTitle: t('pwa.assessment.verificationTitle'),
          verificationText: t('pwa.assessment.verificationText'),
          verificationLink: t('pwa.assessment.verificationLink'),
          verificationQrAlt: t('pwa.assessment.verificationQrAlt'),
        }

        const artifact = createAssessmentReport({
          snapshot: report.snapshot,
          issuedAt: report.issuedAt,
          identitySourceLabel,
          locale,
          texts,
          verificationUrl,
          qrCodeDataUrl,
          uzhLogoDataUrl,
        })
        setReportArtifact(artifact)
      } catch (error) {
        console.error('Failed to generate assessment report', error)
        setExportError(t('pwa.assessment.exportReportGenerationError'))
      }
    } finally {
      setIsExporting(false)
    }
  }

  if (!results) {
    return (
      <UserNotification
        type="error"
        message={t('pwa.assessment.failedToLoadActivityResults')}
      />
    )
  }

  return (
    <div>
      <div className="mb-4 text-sm md:mb-6 md:text-base">
        {t('pwa.assessment.activityResultsDescription')}
      </div>

      <section className="mb-8 border-y border-slate-200 py-5">
        <H3 className={{ root: 'mb-2 text-lg font-semibold' }}>
          {t('pwa.assessment.reportTitle')}
        </H3>
        <p className="mb-4 max-w-2xl text-sm text-slate-600">
          {t('pwa.assessment.exportReportExplanation')}
        </p>
        {exportError ? (
          <div className="mb-4" role="alert">
            <UserNotification type="error" message={exportError} />
          </div>
        ) : null}
        {reportArtifact ? (
          <div className="mb-4 space-y-3">
            <UserNotification
              type="success"
              message={t('pwa.assessment.exportReportReady')}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={handleViewReport}
                primary
                fluid={false}
                disabled={isExporting}
                data={{ cy: 'view-assessment-report' }}
              >
                <Button.Icon icon={faArrowUpRightFromSquare} />
                <Button.Label>
                  {t('pwa.assessment.viewReportButton')}
                </Button.Label>
              </Button>
              <Button
                onClick={handlePrintReport}
                fluid={false}
                disabled={isExporting}
                data={{ cy: 'download-assessment-report' }}
              >
                <Button.Icon icon={faDownload} />
                <Button.Label>
                  {t('pwa.assessment.downloadReportButton')}
                </Button.Label>
              </Button>
              <Button
                onClick={handleExport}
                fluid={false}
                loading={isExporting}
                disabled={isExporting}
                data={{ cy: 'refresh-assessment-report' }}
              >
                <Button.Icon icon={faRotate} loading={isExporting} />
                <Button.Label>
                  {t('pwa.assessment.refreshReportButton')}
                </Button.Label>
              </Button>
            </div>
          </div>
        ) : null}
        {!reportArtifact ? (
          <Button
            onClick={handleExport}
            primary
            fluid={false}
            loading={isExporting}
            disabled={isExporting}
            data={{ cy: 'export-report-button' }}
          >
            <Button.Icon icon={faDownload} loading={isExporting} />
            <Button.Label>
              {t('pwa.assessment.exportReportButton')}
            </Button.Label>
          </Button>
        ) : null}
      </section>

      <div>
        <H3>{t('shared.generic.liveQuizzes')}</H3>
        {liveQuizzes.length > 0 ? (
          <AssessmentResultsList
            results={liveQuizzes}
            type={ActivityType.LIVE_QUIZ}
          />
        ) : (
          <div>{t('pwa.assessment.noCompletedLiveQuizzesYet')}</div>
        )}
      </div>
      {qrCodeRequest ? (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed -left-[10000px] top-0"
        >
          <QRCode
            id={ASSESSMENT_REPORT_QR_ID}
            ecLevel="H"
            logoHeight={96 / 3.34}
            logoImage={qrCodeRequest.logoDataUrl}
            logoWidth={96}
            logoOnLoad={handleQrCodeLogoLoad}
            qrStyle="squares"
            quietZone={8}
            size={320}
            value={qrCodeRequest.value}
          />
        </div>
      ) : null}
      {practiceQuizzes.length > 0 && (
        <div>
          <H3>{t('shared.generic.practiceQuizzes')}</H3>
          <AssessmentResultsList
            results={practiceQuizzes}
            type={ActivityType.PRACTICE_QUIZ}
          />
        </div>
      )}
      {microLearnings.length > 0 && (
        <div>
          <H3>{t('shared.generic.microlearnings')}</H3>
          <AssessmentResultsList
            results={microLearnings}
            type={ActivityType.MICRO_LEARNING}
          />
        </div>
      )}
      {groupActivities.length > 0 && (
        <div>
          <H3>{t('shared.generic.groupActivities')}</H3>
          <AssessmentResultsList
            results={groupActivities}
            type={ActivityType.GROUP_ACTIVITY}
          />
        </div>
      )}
    </div>
  )
}

export default SuspendedAssessmentResults
