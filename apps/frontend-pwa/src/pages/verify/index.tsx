import { useLazyQuery } from '@apollo/client'
import {
  getHistogramBinGeometry,
  isScoreInHistogramBin,
} from '@components/insights/assessmentResults/histogram'
import {
  AssessmentReportVerificationStatus,
  QGetVerifiableCredentialDocument,
  type QGetVerifiableCredentialQuery,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { UserNotification } from '@uzh-bf/design-system'
import type { GetServerSidePropsContext } from 'next'
import { useLocale, useTranslations } from 'next-intl'
import Head from 'next/head'
import Image from 'next/image'
import { useEffect, useState } from 'react'

const TOKEN_PATTERN = /^[a-f0-9]{64}$/
const REPORT_TIME_ZONE = 'Europe/Zurich'

type TokenState = 'reading' | 'missing' | 'invalid' | 'ready'
type Verification = NonNullable<
  QGetVerifiableCredentialQuery['assessmentReportVerification']
>
type Snapshot = NonNullable<Verification['snapshot']>

function formatNumber(value: number, locale: string) {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(
    value
  )
}

function formatReportDate(
  value: string | Date,
  locale: string,
  timeZoneLabel: string
) {
  const formattedDate = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: REPORT_TIME_ZONE,
  }).format(new Date(value))
  return `${formattedDate} (${timeZoneLabel})`
}

function StatusBand({
  tone,
  title,
  message,
}: {
  tone: 'success' | 'error' | 'warning'
  title: string
  message: string
}) {
  const styles = {
    success: 'border-green-700 bg-green-50 text-green-950',
    error: 'border-red-700 bg-red-50 text-red-950',
    warning: 'border-amber-600 bg-amber-50 text-amber-950',
  }
  return (
    <section
      className={`border-l-4 px-5 py-4 ${styles[tone]}`}
      role={tone === 'success' ? 'status' : 'alert'}
      aria-live="polite"
    >
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1 text-sm">{message}</p>
    </section>
  )
}

function ScoreTable({ snapshot }: { snapshot: Snapshot }) {
  const t = useTranslations()
  const locale = useLocale()
  const rows = [
    {
      label: t('pwa.assessment.basePoints'),
      achieved: snapshot.results.basePoints,
      available: snapshot.results.availableBasePoints,
    },
    {
      label: t('pwa.assessment.correctnessPoints'),
      achieved: snapshot.results.correctnessPoints,
      available: snapshot.results.availableCorrectnessPoints,
    },
    {
      label: t('pwa.assessment.bonusPoints'),
      achieved: snapshot.results.bonusPoints,
      available: snapshot.results.availableBonusPoints,
    },
    {
      label: t('pwa.assessment.totalPoints'),
      achieved: snapshot.results.totalPoints,
      available: snapshot.results.availableTotalPoints,
    },
  ]

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-slate-100">
            <th className="border-b border-slate-300 px-3 py-2 text-left"></th>
            <th className="border-b border-slate-300 px-3 py-2 text-right font-semibold">
              {t('pwa.assessment.achievedPointsLabel')}
            </th>
            <th className="border-b border-slate-300 px-3 py-2 text-right font-semibold">
              {t('pwa.assessment.availablePointsLabel')}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={row.label}
              className={
                index === rows.length - 1 ? 'bg-blue-50 font-bold' : ''
              }
            >
              <th
                scope="row"
                className="border-b border-slate-200 px-3 py-2 text-left font-semibold"
              >
                {row.label}
              </th>
              <td className="border-b border-slate-200 px-3 py-2 text-right tabular-nums">
                {formatNumber(row.achieved, locale)}
              </td>
              <td className="border-b border-slate-200 px-3 py-2 text-right tabular-nums">
                {formatNumber(row.available, locale)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Comparison({ snapshot }: { snapshot: Snapshot }) {
  const t = useTranslations()
  const locale = useLocale()
  const comparison = snapshot.comparison
  if (!comparison) {
    return (
      <p className="border-l-4 border-slate-400 bg-slate-50 px-4 py-3 text-sm text-slate-700">
        {t('pwa.assessment.notEnoughDataForComparison')}
      </p>
    )
  }

  const maxCount = Math.max(...comparison.histogram.map((bin) => bin.count), 1)
  const userBinIndex = comparison.histogram.findIndex((bin, index) => {
    return isScoreInHistogramBin({
      score: snapshot.results.totalPoints,
      bin,
      isLast: index === comparison.histogram.length - 1,
      availableTotalPoints: snapshot.results.availableTotalPoints,
    })
  })
  const userBin = comparison.histogram[userBinIndex]
  const userRange = userBin
    ? `${formatNumber(userBin.binStart, locale)}-${formatNumber(userBin.binEnd, locale)}`
    : null

  return (
    <>
      <div className="border-uzh-blue border-l-4 bg-blue-50 px-4 py-3">
        <p className="text-uzh-blue text-lg font-semibold">
          {t('pwa.assessment.percentileText', {
            percentile: comparison.percentile,
          })}
        </p>
        <p className="mt-1 text-sm text-slate-700">
          {t('pwa.assessment.percentileExplanation')}
        </p>
        <p className="mt-2 text-xs text-slate-600">
          {t('pwa.assessment.cohortSizeLabel', {
            count: comparison.cohortSize,
          })}
        </p>
      </div>

      <div
        className="mt-5"
        aria-label={t('pwa.assessment.percentileText', {
          percentile: comparison.percentile,
        })}
      >
        <div className="relative h-3 rounded-full bg-slate-200">
          <div
            className="absolute -top-1 h-5 w-1 rounded-full bg-uzh-blue"
            style={{
              left: `${Math.min(Math.max(comparison.percentile, 0), 100)}%`,
            }}
          />
        </div>
        <div className="mt-1 flex justify-between text-xs text-slate-600">
          <span>0</span>
          <span>100</span>
        </div>
      </div>

      <div
        className="mt-5 flex h-56 items-end gap-1 border-b border-l border-slate-400 px-2 pt-6"
        role="img"
        aria-label={
          userRange
            ? `${t('pwa.assessment.histogramDescription')} ${t(
                'pwa.assessment.histogramUserRange',
                { range: userRange }
              )}`
            : t('pwa.assessment.histogramDescription')
        }
      >
        {comparison.histogram.map((bin, index) => {
          const range = `${formatNumber(bin.binStart, locale)}-${formatNumber(
            bin.binEnd,
            locale
          )}`
          const isUserBin = index === userBinIndex
          const { widthRatio } = getHistogramBinGeometry(
            comparison.histogram,
            index
          )
          return (
            <div
              key={`${bin.binStart}-${bin.binEnd}`}
              className="flex h-full min-w-0 flex-col justify-end text-center"
              style={{ flexGrow: widthRatio, flexBasis: 0 }}
            >
              <span className="mb-1 text-xs font-semibold tabular-nums">
                {bin.count}
              </span>
              <div
                className={
                  isUserBin ? 'bg-uzh-blue w-full' : 'w-full bg-cyan-700'
                }
                style={{
                  height: `${Math.max((bin.count / maxCount) * 100, 4)}%`,
                }}
              />
              <span className="mt-1 truncate text-xs" title={range}>
                {range}
              </span>
            </div>
          )
        })}
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-slate-100">
              <th className="border-b border-slate-300 px-3 py-2 text-left">
                {t('pwa.assessment.binLabel')}
              </th>
              <th className="border-b border-slate-300 px-3 py-2 text-right">
                {t('pwa.assessment.countLabel')}
              </th>
            </tr>
          </thead>
          <tbody>
            {comparison.histogram.map((bin, index) => {
              const isUserBin = index === userBinIndex
              return (
                <tr
                  key={`${bin.binStart}-${bin.binEnd}`}
                  className={isUserBin ? 'bg-blue-50 font-semibold' : ''}
                >
                  <td className="border-b border-slate-200 px-3 py-2">
                    {formatNumber(bin.binStart, locale)}-
                    {formatNumber(bin.binEnd, locale)}
                    {isUserBin ? (
                      <span className="text-uzh-blue ml-2">
                        ({t('pwa.assessment.yourScoreLabel')})
                      </span>
                    ) : null}
                  </td>
                  <td className="border-b border-slate-200 px-3 py-2 text-right tabular-nums">
                    {bin.count}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}

function ActiveVerification({ verification }: { verification: Verification }) {
  const t = useTranslations()
  const locale = useLocale()
  const snapshot = verification.snapshot
  if (!snapshot) {
    return (
      <StatusBand
        tone="warning"
        title={t('pwa.assessment.verificationDataUnavailableTitle')}
        message={t('pwa.assessment.verificationDataUnavailableText')}
      />
    )
  }

  const identitySourceLabel = t('pwa.assessment.identitySourceCourseInvitation')

  return (
    <>
      <StatusBand
        tone="success"
        title={t('pwa.assessment.verificationActiveTitle')}
        message={t('pwa.assessment.verificationActiveText')}
      />

      <section className="border-b border-slate-300 py-7">
        <h2 className="text-uzh-blue text-xl font-semibold">
          {t('pwa.assessment.verificationIdentityTitle')}
        </h2>
        <dl className="mt-4 grid grid-cols-1 border-t border-slate-200 sm:grid-cols-[minmax(160px,1fr)_2fr]">
          <dt className="bg-slate-100 px-3 py-2 font-semibold">
            {t('pwa.assessment.courseNameLabel')}
          </dt>
          <dd className="min-w-0 break-words border-b border-slate-200 px-3 py-2 sm:border-b-0">
            {snapshot.course.displayName}
          </dd>
          <dt className="bg-slate-100 px-3 py-2 font-semibold">
            {t('pwa.assessment.courseReferenceLabel')}
          </dt>
          <dd className="min-w-0 break-words border-b border-slate-200 px-3 py-2 sm:border-b-0">
            {snapshot.course.name}
          </dd>
          <dt className="bg-slate-100 px-3 py-2 font-semibold">
            {t('pwa.assessment.studentEmailLabel')}
          </dt>
          <dd className="break-all border-b border-slate-200 px-3 py-2 sm:border-b-0">
            {snapshot.subject.email}
          </dd>
          <dt className="bg-slate-100 px-3 py-2 font-semibold">
            {t('pwa.assessment.identitySourceLabel')}
          </dt>
          <dd className="border-b border-slate-200 px-3 py-2 sm:border-b-0">
            {identitySourceLabel}
          </dd>
          <dt className="bg-slate-100 px-3 py-2 font-semibold">
            {t('pwa.assessment.issuedAt')}
          </dt>
          <dd className="px-3 py-2">
            {formatReportDate(
              verification.issuedAt,
              locale,
              t('pwa.assessment.reportTimeZone')
            )}
          </dd>
        </dl>
      </section>

      <section className="border-b border-slate-300 py-7">
        <h2 className="text-uzh-blue mb-4 text-xl font-semibold">
          {t('pwa.assessment.pointsSummaryLabel')}
        </h2>
        <ScoreTable snapshot={snapshot} />
      </section>

      <section className="py-7">
        <h2 className="text-uzh-blue mb-4 text-xl font-semibold">
          {t('pwa.assessment.performanceInsightsTitle')}
        </h2>
        <Comparison snapshot={snapshot} />
        <p className="mt-6 border-l-4 border-cyan-700 pl-4 text-sm text-slate-600">
          {t('pwa.assessment.privacyAndTransparencyNotice')}
        </p>
      </section>
    </>
  )
}

export default function VerifyAssessmentReportPage() {
  const t = useTranslations()
  const locale = useLocale()
  const [tokenState, setTokenState] = useState<TokenState>('reading')
  const [verify, { data, loading, error }] = useLazyQuery(
    QGetVerifiableCredentialDocument,
    { fetchPolicy: 'network-only' }
  )

  useEffect(() => {
    function verifyCurrentFragment() {
      const token = window.location.hash.slice(1)
      if (!token) {
        setTokenState('missing')
        return
      }
      if (!TOKEN_PATTERN.test(token)) {
        setTokenState('invalid')
        return
      }

      setTokenState('ready')
      void verify({ variables: { token } })
    }

    verifyCurrentFragment()
    window.addEventListener('hashchange', verifyCurrentFragment)
    return () => window.removeEventListener('hashchange', verifyCurrentFragment)
  }, [verify])

  const verification = data?.assessmentReportVerification
  let content
  if (tokenState === 'reading' || (tokenState === 'ready' && loading)) {
    content = (
      <div className="flex min-h-64 items-center justify-center" role="status">
        <Loader />
        <span className="sr-only">
          {t('pwa.assessment.verificationLoading')}
        </span>
      </div>
    )
  } else if (tokenState === 'missing') {
    content = (
      <StatusBand
        tone="error"
        title={t('pwa.assessment.verificationInvalidLinkTitle')}
        message={t('pwa.assessment.verificationMissingToken')}
      />
    )
  } else if (tokenState === 'invalid') {
    content = (
      <StatusBand
        tone="error"
        title={t('pwa.assessment.verificationInvalidLinkTitle')}
        message={t('pwa.assessment.verificationInvalidToken')}
      />
    )
  } else if (error) {
    content = (
      <UserNotification
        type="error"
        message={t('pwa.assessment.verificationLoadError')}
      />
    )
  } else if (!verification) {
    content = (
      <StatusBand
        tone="error"
        title={t('pwa.assessment.verificationNotFoundTitle')}
        message={t('pwa.assessment.verificationNotFoundText')}
      />
    )
  } else if (
    verification.status === AssessmentReportVerificationStatus.Revoked
  ) {
    content = (
      <StatusBand
        tone="error"
        title={t('pwa.assessment.verificationRevokedTitle')}
        message={t('pwa.assessment.verificationRevokedText', {
          date: formatReportDate(
            verification.issuedAt,
            locale,
            t('pwa.assessment.reportTimeZone')
          ),
        })}
      />
    )
  } else if (
    verification.status === AssessmentReportVerificationStatus.Superseded
  ) {
    content = (
      <StatusBand
        tone="warning"
        title={t('pwa.assessment.verificationSupersededTitle')}
        message={t('pwa.assessment.verificationSupersededText')}
      />
    )
  } else if (
    verification.status === AssessmentReportVerificationStatus.DataUnavailable
  ) {
    content = (
      <StatusBand
        tone="warning"
        title={t('pwa.assessment.verificationDataUnavailableTitle')}
        message={t('pwa.assessment.verificationDataUnavailableText')}
      />
    )
  } else {
    content = <ActiveVerification verification={verification} />
  }

  return (
    <>
      <Head>
        <title>{t('pwa.assessment.verificationPageTitle')}</title>
        <meta name="robots" content="noindex,nofollow,noarchive" key="robots" />
        <meta name="referrer" content="no-referrer" key="referrer" />
      </Head>
      <div className="min-h-screen bg-white text-slate-950">
        <header className="border-uzh-blue border-b-4">
          <div className="mx-auto flex max-w-5xl flex-col gap-5 px-5 py-6 sm:flex-row sm:items-end sm:justify-between sm:px-8">
            <div className="flex items-center gap-5">
              <Image
                src="/uzhlogo_email.png"
                alt="Universität Zürich"
                width={460}
                height={144}
                className="h-auto w-44"
                priority
              />
              <span className="border-l border-slate-400 pl-5 text-lg font-bold">
                KlickerUZH
              </span>
            </div>
            <div>
              <h1 className="text-2xl font-semibold">
                {t('pwa.assessment.verificationHeading')}
              </h1>
              <p className="mt-1 max-w-xl text-sm text-slate-600">
                {t('pwa.assessment.verificationIntro')}
              </p>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-4xl px-5 py-8 sm:px-8">{content}</main>
      </div>
    </>
  )
}

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  const locale = ctx.locale || 'en'
  return {
    props: {
      messages: (await import(`@klicker-uzh/i18n/messages/${locale}`)).default,
    },
  }
}
