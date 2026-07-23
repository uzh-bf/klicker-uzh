import { faClipboard } from '@fortawesome/free-regular-svg-icons'
import { faBan } from '@fortawesome/free-solid-svg-icons'
import {
  AssessmentReportCredentialStatus,
  type QGetCourseVerificationRecordsQuery,
} from '@klicker-uzh/graphql/dist/ops'
import { Button } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

export type AssessmentReportRecord =
  QGetCourseVerificationRecordsQuery['courseAssessmentReportRecords']['records'][number]

const REPORT_TIME_ZONE = 'Europe/Zurich'

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

function statusClasses(status: AssessmentReportCredentialStatus) {
  switch (status) {
    case AssessmentReportCredentialStatus.Active:
      return 'bg-green-50 text-green-800 ring-green-700/20'
    case AssessmentReportCredentialStatus.Revoked:
      return 'bg-red-50 text-red-800 ring-red-700/20'
    case AssessmentReportCredentialStatus.Superseded:
      return 'bg-amber-50 text-amber-900 ring-amber-700/20'
  }
}

function truncateVerificationToken(token: string) {
  return `${token.slice(0, 8)}...${token.slice(-4)}`
}

function RecordStatus({
  status,
}: {
  status: AssessmentReportCredentialStatus
}) {
  const t = useTranslations()
  const labels = {
    [AssessmentReportCredentialStatus.Active]: t(
      'manage.assessment.reportStatusActive'
    ),
    [AssessmentReportCredentialStatus.Revoked]: t(
      'manage.assessment.reportStatusRevoked'
    ),
    [AssessmentReportCredentialStatus.Superseded]: t(
      'manage.assessment.reportStatusSuperseded'
    ),
  }

  return (
    <span
      className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${statusClasses(status)}`}
    >
      {labels[status]}
    </span>
  )
}

function RecordActions({
  record,
  revokingId,
  onCopy,
  onRevoke,
}: {
  record: AssessmentReportRecord
  revokingId: string | null
  onCopy: (record: AssessmentReportRecord) => void
  onRevoke: (record: AssessmentReportRecord) => void
}) {
  const t = useTranslations()
  return (
    <div className="flex items-center justify-end gap-2">
      <Button
        onClick={() => onCopy(record)}
        aria-label={t('manage.assessment.reportCopyLinkTooltip')}
        title={t('manage.assessment.reportCopyLinkTooltip')}
        className={{ root: 'h-8 w-8' }}
        data={{ cy: `copy-assessment-report-${record.id}` }}
      >
        <Button.Icon withoutLabel icon={faClipboard} />
      </Button>
      {record.status === AssessmentReportCredentialStatus.Active ? (
        <Button
          onClick={() => onRevoke(record)}
          disabled={revokingId !== null}
          className={{ root: 'h-8' }}
          data={{ cy: `revoke-assessment-report-${record.id}` }}
        >
          <Button.Icon icon={faBan} />
          <Button.Label>{t('manage.assessment.reportRevoke')}</Button.Label>
        </Button>
      ) : null}
    </div>
  )
}

export default function CourseVerifiableCredentialsList({
  records,
  locale,
  revokingId,
  onCopy,
  onRevoke,
}: {
  records: AssessmentReportRecord[]
  locale: string
  revokingId: string | null
  onCopy: (record: AssessmentReportRecord) => void
  onRevoke: (record: AssessmentReportRecord) => void
}) {
  const t = useTranslations()
  const timeZoneLabel = t('manage.assessment.reportTimeZone')

  function changedAt(record: AssessmentReportRecord) {
    return record.revokedAt ?? record.supersededAt
  }

  return (
    <>
      <div className="space-y-3 md:hidden">
        {records.map((record) => (
          <article
            key={record.id}
            className="rounded border border-slate-200 bg-white p-3 text-sm"
          >
            <div className="mb-3 flex items-start justify-between gap-2">
              <p className="min-w-0 break-all font-semibold text-slate-800">
                {record.subjectEmail}
              </p>
              <RecordStatus status={record.status} />
            </div>
            <dl className="space-y-2 text-slate-700">
              <div className="flex items-start justify-between gap-3">
                <dt className="font-semibold">
                  {t('manage.assessment.reportToken')}
                </dt>
                <dd className="font-mono text-xs">
                  {truncateVerificationToken(record.verificationToken)}
                </dd>
              </div>
              <div>
                <dt className="font-semibold">
                  {t('manage.assessment.reportIssuedAt')}
                </dt>
                <dd>
                  {formatReportDate(record.issuedAt, locale, timeZoneLabel)}
                </dd>
              </div>
              {changedAt(record) ? (
                <div>
                  <dt className="font-semibold">
                    {t('manage.assessment.reportStatusChangedAt')}
                  </dt>
                  <dd>
                    {formatReportDate(
                      changedAt(record)!,
                      locale,
                      timeZoneLabel
                    )}
                  </dd>
                </div>
              ) : null}
            </dl>
            <div className="mt-3 border-t border-slate-200 pt-3">
              <RecordActions
                record={record}
                revokingId={revokingId}
                onCopy={onCopy}
                onRevoke={onRevoke}
              />
            </div>
          </article>
        ))}
      </div>

      <div className="hidden overflow-x-auto rounded-md border border-slate-200 md:block">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead className="bg-slate-50 text-xs text-slate-600">
            <tr>
              <th className="px-4 py-3 font-semibold">
                {t('manage.assessment.reportRecipient')}
              </th>
              <th className="px-4 py-3 font-semibold">
                {t('manage.assessment.reportToken')}
              </th>
              <th className="px-4 py-3 font-semibold">
                {t('manage.assessment.reportIssuedAt')}
              </th>
              <th className="px-4 py-3 font-semibold">
                {t('manage.assessment.reportStatus')}
              </th>
              <th className="px-4 py-3 font-semibold">
                {t('manage.assessment.reportStatusChangedAt')}
              </th>
              <th className="px-4 py-3 text-right font-semibold">
                {t('manage.assessment.reportActions')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {records.map((record) => (
              <tr key={record.id}>
                <td className="break-all px-4 py-3 font-semibold text-slate-800">
                  {record.subjectEmail}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-slate-600">
                  {truncateVerificationToken(record.verificationToken)}
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {formatReportDate(record.issuedAt, locale, timeZoneLabel)}
                </td>
                <td className="px-4 py-3">
                  <RecordStatus status={record.status} />
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {changedAt(record)
                    ? formatReportDate(
                        changedAt(record)!,
                        locale,
                        timeZoneLabel
                      )
                    : '-'}
                </td>
                <td className="px-4 py-3">
                  <RecordActions
                    record={record}
                    revokingId={revokingId}
                    onCopy={onCopy}
                    onRevoke={onRevoke}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
