import { useMutation, useSuspenseQuery } from '@apollo/client'
import { faDownload } from '@fortawesome/free-solid-svg-icons'
import {
  CredentialType,
  GetStudentAssessmentResultsDocument,
  MIssueCredentialDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { ActivityType } from '@klicker-uzh/types'
import { Button, H3, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useState } from 'react'
import { QRCode } from 'react-qrcode-logo'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import AssessmentResultsList from './AssessmentResultsList'
import { downloadAssessmentReport, ExportReportTexts } from './exportReport'

function SuspendedAssessmentResults({ courseId }: { courseId: string }) {
  const t = useTranslations()
  const { data } = useSuspenseQuery(GetStudentAssessmentResultsDocument, {
    variables: { courseId },
    fetchPolicy: 'network-only',
  })

  const [verificationToken, setVerificationToken] = useState<string | null>(
    null
  )
  const [isExporting, setIsExporting] = useState(false)
  const [issueCredentialMutation] = useMutation(MIssueCredentialDocument)

  const results = data.studentAssessmentResults

  const liveQuizzes = results?.liveQuizzes ?? []
  const practiceQuizzes = results?.practiceQuizzes ?? []
  const microLearnings = results?.microLearnings ?? []
  const groupActivities = results?.groupActivities ?? []
  const percentile = results?.percentile ?? null
  const histogram = results?.histogram ?? null
  const hasEnoughData = results?.hasEnoughData ?? false
  const participantEmail = results?.participantEmail ?? ''
  const courseName = results?.courseName ?? 'Course'

  const allActivities = [
    ...liveQuizzes,
    ...practiceQuizzes,
    ...microLearnings,
    ...groupActivities,
  ]

  const aggregated = allActivities.reduce(
    (acc, activity) => {
      acc.basePoints += activity.basePoints
      acc.availableBasePoints += activity.availableBasePoints
      acc.correctnessPoints += activity.correctnessPoints
      acc.availableCorrectnessPoints += activity.availableCorrectnessPoints
      acc.bonusPoints += activity.bonusPoints
      acc.availableBonusPoints += activity.availableBonusPoints
      acc.totalPoints +=
        activity.basePoints + activity.correctnessPoints + activity.bonusPoints
      acc.availableTotalPoints +=
        activity.availableBasePoints +
        activity.availableCorrectnessPoints +
        activity.availableBonusPoints
      return acc
    },
    {
      basePoints: 0,
      availableBasePoints: 0,
      correctnessPoints: 0,
      availableCorrectnessPoints: 0,
      bonusPoints: 0,
      availableBonusPoints: 0,
      totalPoints: 0,
      availableTotalPoints: 0,
    }
  )

  const runDownload = useCallback(
    (token: string) => {
      if (!results) return

      const texts: ExportReportTexts = {
        title: t('pwa.assessment.performanceInsightsTitle'),
        subtitle: t('pwa.assessment.performanceInsightsTitle'),
        course: t('pwa.assessment.courseNameLabel') || 'Kurs',
        student:
          t('pwa.assessment.studentEmailLabel') || 'Studierende (E-Mail)',
        date: t('manage.general.date') || 'Datum',
        pointsSummary:
          t('pwa.assessment.pointsSummaryLabel') || 'Punkteübersicht',
        basePointsTitle: t('pwa.assessment.basePoints'),
        correctnessPointsTitle: t('pwa.assessment.correctnessPoints'),
        bonusPointsTitle: t('pwa.assessment.bonusPoints'),
        totalPointsTitle: t('pwa.assessment.totalPoints'),
        ofAvailable: t('pwa.assessment.ofAvailable'),
        excludingBonus: t('pwa.assessment.excludingBonus'),
        percentileTitle: t('pwa.assessment.performanceInsightsTitle'),
        percentileText: t('pwa.assessment.percentileText'),
        percentileExplanation: t('pwa.assessment.percentileExplanation'),
        histogramTitle: t('pwa.assessment.histogramTitle'),
        histogramDescription: t('pwa.assessment.histogramDescription'),
        privacyNoticeTitle:
          t('pwa.assessment.privacyNoticeTitle') || 'Datenschutz & Transparenz',
        privacyNoticeText: t('pwa.assessment.privacyAndTransparencyNotice'),
        yourScoreLabel: t('pwa.assessment.yourScoreLabel') || 'Deine Position',
        countLabel: t('pwa.assessment.countLabel') || 'Anzahl',
        binLabel: t('pwa.assessment.binLabel') || 'Punktebereich',
        notEnoughDataForComparison: t(
          'pwa.assessment.notEnoughDataForComparison'
        ),
      }

      const canvas = document.getElementById(
        'verification-qr-canvas'
      ) as HTMLCanvasElement
      const qrCodeDataUrl = canvas?.toDataURL('image/png') ?? null
      const verificationUrl = `${window.location.origin}/verify/${token}`

      downloadAssessmentReport({
        courseName,
        studentEmail: participantEmail,
        totalPoints: aggregated.totalPoints,
        availableTotalPoints: aggregated.availableTotalPoints,
        basePoints: aggregated.basePoints,
        availableBasePoints: aggregated.availableBasePoints,
        correctnessPoints: aggregated.correctnessPoints,
        availableCorrectnessPoints: aggregated.availableCorrectnessPoints,
        bonusPoints: aggregated.bonusPoints,
        availableBonusPoints: aggregated.availableBonusPoints,
        percentile: percentile ?? null,
        histogram: histogram ? (histogram as any) : null,
        hasEnoughData: !!hasEnoughData,
        texts,
        verificationUrl,
        qrCodeDataUrl,
      })
    },
    [
      results,
      courseName,
      participantEmail,
      aggregated,
      percentile,
      histogram,
      hasEnoughData,
      t,
    ]
  )

  useEffect(() => {
    if (isExporting && verificationToken) {
      const timer = setTimeout(() => {
        runDownload(verificationToken)
        setIsExporting(false)
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [verificationToken, isExporting, runDownload])

  const handleExport = async () => {
    if (verificationToken) {
      runDownload(verificationToken)
      return
    }

    setIsExporting(true)
    try {
      const response = await issueCredentialMutation({
        variables: {
          courseId,
          type: CredentialType.CourseAssessmentInsights,
          metadata: {
            courseName,
            studentEmail: participantEmail,
            totalPoints: aggregated.totalPoints,
            availableTotalPoints: aggregated.availableTotalPoints,
            basePoints: aggregated.basePoints,
            availableBasePoints: aggregated.availableBasePoints,
            correctnessPoints: aggregated.correctnessPoints,
            availableCorrectnessPoints: aggregated.availableCorrectnessPoints,
            bonusPoints: aggregated.bonusPoints,
            availableBonusPoints: aggregated.availableBonusPoints,
            percentile: percentile ?? null,
            histogram: histogram ?? null,
            hasEnoughData: !!hasEnoughData,
          },
        },
      })
      const token = response.data?.issueCredential?.token
      if (token) {
        setVerificationToken(token)
      } else {
        setIsExporting(false)
      }
    } catch (e) {
      console.error('Failed to issue credential', e)
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

  const chartData =
    histogram?.map((bin) => ({
      name: `${Math.round(bin.binStart)}-${Math.round(bin.binEnd)}`,
      count: bin.count,
      binStart: bin.binStart,
      binEnd: bin.binEnd,
    })) || []

  const userBinIndex = histogram
    ? histogram.findIndex((bin) => {
        if (bin.binStart === histogram[histogram.length - 1]?.binStart) {
          return (
            aggregated.totalPoints >= bin.binStart &&
            aggregated.totalPoints <= bin.binEnd
          )
        }
        return (
          aggregated.totalPoints >= bin.binStart &&
          aggregated.totalPoints < bin.binEnd
        )
      })
    : -1

  return (
    <div>
      <div className="mb-4 text-sm md:mb-6 md:text-base">
        {t('pwa.assessment.activityResultsDescription')}
      </div>

      {/* Performance Insights Section */}
      <div className="mb-8 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <H3 className={{ root: 'mb-4 text-lg font-bold text-slate-800' }}>
          {t('pwa.assessment.performanceInsightsTitle')}
        </H3>

        {hasEnoughData && percentile !== null && percentile !== undefined ? (
          <div>
            <div className="border-uzh-blue mb-6 rounded-r-lg border-l-4 bg-slate-50 p-4">
              <div className="text-uzh-blue text-base font-semibold">
                {t('pwa.assessment.percentileText', {
                  percentile: percentile.toString(),
                })}
              </div>
              <div className="mt-1 text-sm text-slate-600">
                {t('pwa.assessment.percentileExplanation')}
              </div>
            </div>

            <div className="mb-6 rounded-lg border border-slate-100 bg-slate-50 p-4">
              <div className="mb-2 text-center text-sm font-semibold text-slate-700">
                {t('pwa.assessment.histogramTitle')}
              </div>
              <div className="mb-4 text-center text-xs text-slate-500">
                {t('pwa.assessment.histogramDescription')}
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    margin={{ top: 10, right: 10, left: -20, bottom: 10 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="#E2E8F0"
                    />
                    <XAxis
                      dataKey="name"
                      stroke="#64748B"
                      fontSize={10}
                      tickLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      stroke="#64748B"
                      fontSize={10}
                      tickLine={false}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload
                          return (
                            <div className="rounded border border-slate-200 bg-white p-2 text-xs shadow-sm">
                              <p className="font-semibold text-slate-800">
                                {t('pwa.assessment.binLabel')}: {data.name}
                              </p>
                              <p className="text-slate-600">
                                {t('pwa.assessment.countLabel')}: {data.count}
                              </p>
                            </div>
                          )
                        }
                        return null
                      }}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {chartData.map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={index === userBinIndex ? '#0028A5' : '#4AC9E3'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        ) : (
          <div className="mb-6 rounded-r-lg border-l-4 border-slate-400 bg-slate-50 p-4 text-sm text-slate-600">
            {t('pwa.assessment.notEnoughDataForComparison')}
          </div>
        )}

        {/* PDF / HTML Export Button */}
        <div className="flex flex-col items-center border-t border-slate-100 pt-6">
          <Button
            onClick={handleExport}
            primary
            fluid={false}
            loading={isExporting}
            data={{ cy: 'export-report-button' }}
            className={{
              root: 'bg-uzh-blue flex items-center gap-2 rounded-full px-6 py-2.5 font-medium text-white transition-all hover:bg-opacity-90',
            }}
          >
            <Button.Icon icon={faDownload} loading={isExporting} />
            <Button.Label>
              {t('pwa.assessment.exportReportButton')}
            </Button.Label>
          </Button>
          <div className="mt-2 max-w-md text-center text-xs text-slate-500">
            {t('pwa.assessment.exportReportExplanation')}
          </div>
        </div>

        {/* Privacy Notice */}
        <div className="text-2xs mt-6 border-t border-slate-100 pt-4 leading-normal text-slate-400">
          {t('pwa.assessment.privacyAndTransparencyNotice')}
        </div>
      </div>

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

      {/* Hidden QR Code canvas for PDF/HTML report verification */}
      {verificationToken && (
        <div style={{ display: 'none' }}>
          <QRCode
            id="verification-qr-canvas"
            value={`${window.location.origin}/verify/${verificationToken}`}
            size={300}
            logoImage="/img/KlickerLogo.png"
            logoWidth={90}
            logoHeight={27}
          />
        </div>
      )}
    </div>
  )
}

export default SuspendedAssessmentResults
