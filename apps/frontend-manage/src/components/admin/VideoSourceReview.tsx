import { useLazyQuery, useMutation, useQuery } from '@apollo/client'
import {
  AdminApproveVideoSourceRequestDocument,
  GetVideoSourcesForReviewDocument,
  type GetVideoSourcesForReviewQuery,
  KbVideoApprovalRequestStatus,
  KbVideoCutMode,
  KbVideoSourceStatus,
  RejectVideoSourceDocument,
  ResolveVideoSourceDocument,
  VerifyVideoSourceDocument,
  VideoSourceProviderConfiguredDocument,
} from '@klicker-uzh/graphql/dist/ops'
import {
  Button,
  SelectField,
  TextField,
  UserNotification,
} from '@uzh-bf/design-system'
import { useFormatter, useTranslations } from 'next-intl'
import { useState } from 'react'

type ReviewSource =
  GetVideoSourcesForReviewQuery['getVideoSourcesForReview'][number]

const OPEN_STATUSES = [
  KbVideoSourceStatus.Submitted,
  KbVideoSourceStatus.Verified,
  KbVideoSourceStatus.AwaitingAdmin,
]

// One recipient per line: "Name <email>" or just the email.
export function parseRecipientLines(
  value: string
): Array<{ name: string; email: string }> {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = /^(.*?)\s*<([^>]+)>$/.exec(line)
      const email = (match?.[2] ?? line).trim()
      return { name: match?.[1]?.trim() || email, email }
    })
}

function useDate() {
  const format = useFormatter()
  return (value: string | Date | null | undefined) =>
    value
      ? format.dateTime(new Date(value), {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })
      : '–'
}

// Admin review of lecture video sources that KB owners submitted: check that
// the recordings link belongs to the course in the directory, confirm the
// Kaltura category and send the approval emails, or reject with a reason.
// Sources a lecturer approved wait here for the final admin approval.
function VideoSourceReview() {
  const t = useTranslations()
  const [showAll, setShowAll] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const { data, refetch } = useQuery(GetVideoSourcesForReviewDocument, {
    variables: { statuses: showAll ? null : OPEN_STATUSES },
    fetchPolicy: 'cache-and-network',
  })
  const sources = data?.getVideoSourcesForReview ?? []
  const selected = sources.find((s) => s.id === selectedId) ?? null

  return (
    <div className="flex flex-col gap-4" data-cy="video-source-review">
      <p className="text-sm text-gray-600">
        {t('manage.admin.videoSourceDescription')}
      </p>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={showAll}
          onChange={(e) => setShowAll(e.target.checked)}
        />
        {t('manage.admin.videoSourceShowAll')}
      </label>
      {sources.length === 0 ? (
        <p className="text-sm text-gray-600">
          {t('manage.admin.videoSourceQueueEmpty')}
        </p>
      ) : (
        <ul className="flex flex-col divide-y rounded border">
          {sources.map((source) => (
            <li key={source.id}>
              <button
                type="button"
                className={`flex w-full flex-col p-2 text-left text-sm hover:bg-gray-50 ${
                  source.id === selectedId ? 'bg-gray-100' : ''
                }`}
                onClick={() => setSelectedId(source.id)}
                data-cy={`video-source-review-${source.id}`}
              >
                <span className="font-bold">
                  {source.name} · {source.kbName}
                </span>
                <span className="text-gray-600">
                  {t(`manage.admin.videoSourceStatus${source.status}`)} ·{' '}
                  {source.kbOwnerEmail}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {selected && (
        <VideoSourceReviewDetail
          key={selected.id}
          source={selected}
          onChanged={() => refetch()}
        />
      )}
    </div>
  )
}

function VideoSourceReviewDetail({
  source,
  onChanged,
}: {
  source: ReviewSource
  onChanged: () => Promise<unknown>
}) {
  const t = useTranslations()
  const date = useDate()
  const { data: providerData, loading: providerLoading } = useQuery(
    VideoSourceProviderConfiguredDocument
  )
  const manualMode =
    !providerLoading && providerData?.videoSourceProviderConfigured === false

  const [period, setPeriod] = useState('')
  const [categoryId, setCategoryId] = useState(source.fixedCollectionId ?? '')
  const [cutMode, setCutMode] = useState<KbVideoCutMode>(KbVideoCutMode.Clip)
  const [namePattern, setNamePattern] = useState('')
  const [captionLanguage, setCaptionLanguage] = useState('de')
  const [courseTitle, setCourseTitle] = useState('')
  const [courseShortName, setCourseShortName] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [recipientLines, setRecipientLines] = useState('')
  const [rejectReason, setRejectReason] = useState('')

  const [resolve, { data, loading: resolving, error: resolveError }] =
    useLazyQuery(ResolveVideoSourceDocument, { fetchPolicy: 'network-only' })
  const [verify, { data: sent, loading: verifying, error: verifyError }] =
    useMutation(VerifyVideoSourceDocument)
  const [reject, { loading: rejecting, error: rejectError }] = useMutation(
    RejectVideoSourceDocument
  )
  const [finalApprove, { loading: approving, error: approveError }] =
    useMutation(AdminApproveVideoSourceRequestDocument)

  const resolution = data?.resolveVideoSource
  const reviewable =
    source.status === KbVideoSourceStatus.Submitted ||
    source.status === KbVideoSourceStatus.Verified
  const approvedRequest = source.requests.find(
    (r) => r.status === KbVideoApprovalRequestStatus.Approved
  )

  const lookUp = () => {
    resolve({
      variables: {
        sourceUrl: source.sourceUrl,
        directoryUrl: source.directoryUrl,
        period: period.trim() || null,
      },
    })
      .then(({ data: result }) => {
        const res = result?.resolveVideoSource
        const proposed =
          res?.collections.find((c) => c.recommended) ??
          (res?.collections.length === 1 ? res.collections[0] : undefined)
        setCategoryId(res?.fixedCollectionId ?? proposed?.id ?? categoryId)
      })
      .catch(() => undefined)
  }

  const manualRecipients = parseRecipientLines(recipientLines)
  // A date input yields midnight UTC of that day; the period ends after it.
  const manualPeriodEnd = periodEnd
    ? new Date(new Date(`${periodEnd}T00:00:00Z`).getTime() + 86_400_000)
    : null

  const verifyAndSend = () => {
    verify({
      variables: {
        sourceId: source.id,
        kalturaCategoryId: categoryId.trim(),
        cutMode,
        namePattern:
          cutMode === KbVideoCutMode.Edited ? namePattern.trim() : null,
        captionLanguage: captionLanguage.trim(),
        ...(manualMode
          ? {
              manual: {
                courseTitle: courseTitle.trim(),
                courseShortName: courseShortName.trim() || null,
                periodLabel: period.trim(),
                periodEnd: manualPeriodEnd,
              },
              additionalRecipients: manualRecipients,
            }
          : { period: resolution?.periodLabel ?? (period.trim() || null) }),
      },
    })
      .then(() => onChanged())
      .catch(() => undefined)
  }

  const canVerify =
    /^\d+$/.test(categoryId.trim()) &&
    Boolean(captionLanguage.trim()) &&
    (cutMode !== KbVideoCutMode.Edited || Boolean(namePattern.trim())) &&
    (manualMode
      ? Boolean(
          courseTitle.trim() &&
            period.trim() &&
            manualPeriodEnd &&
            manualRecipients.length > 0
        )
      : Boolean(resolution?.directory))
  const error = verifyError ?? rejectError ?? approveError

  return (
    <section
      className="flex flex-col gap-3 rounded border p-3"
      data-cy="video-source-review-detail"
    >
      <h3 className="font-bold">{source.name}</h3>
      <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-sm md:grid-cols-[12rem_1fr]">
        <dt className="font-bold">{t('manage.admin.videoSourceKb')}</dt>
        <dd>
          {source.kbName} ({source.kbOwnerEmail})
        </dd>
        <dt className="font-bold">{t('manage.admin.videoSourceUrl')}</dt>
        <dd className="break-all">
          <a
            href={source.sourceUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="text-primary-100 underline"
          >
            {source.sourceUrl}
          </a>{' '}
          ({source.sourceKind}
          {source.externalRef ? ` ${source.externalRef}` : ''})
        </dd>
        <dt className="font-bold">
          {t('manage.admin.videoSourceDirectoryUrl')}
        </dt>
        <dd className="break-all">
          <a
            href={source.directoryUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="text-primary-100 underline"
          >
            {source.directoryUrl}
          </a>
        </dd>
        <dt className="font-bold">{t('manage.admin.videoSourceSubmitted')}</dt>
        <dd>{date(source.createdAt)}</dd>
      </dl>

      {error && (
        <UserNotification type="error">{error.message}</UserNotification>
      )}

      {approvedRequest && (
        <div className="flex flex-col gap-2 rounded border p-2">
          <div className="text-sm">
            {t('manage.admin.videoSourceAwaitingFinal', {
              period: approvedRequest.periodLabel,
              course: approvedRequest.courseTitle,
            })}
          </div>
          {approvedRequest.decisions
            .filter((d) => d.kind === 'APPROVE' && !d.identityMatched)
            .map((d) => (
              <UserNotification key={d.id} type="warning">
                {t('manage.admin.videoSourceIdentityMismatch', {
                  email: d.userEmail,
                })}
              </UserNotification>
            ))}
          <div>
            <Button
              loading={approving}
              disabled={approving}
              onClick={() =>
                finalApprove({ variables: { requestId: approvedRequest.id } })
                  .then(() => onChanged())
                  .catch(() => undefined)
              }
              className={{ root: 'bg-primary-100 text-white' }}
              data={{ cy: 'video-source-final-approve' }}
            >
              {t('manage.admin.videoSourceFinalApprove')}
            </Button>
          </div>
        </div>
      )}

      {reviewable && (
        <>
          {manualMode && (
            <UserNotification type="info" data={{ cy: 'video-source-manual' }}>
              {t('manage.admin.videoSourceManualMode')}
            </UserNotification>
          )}
          <TextField
            label={t('manage.admin.videoSourcePeriod')}
            placeholder="HS26"
            value={period}
            onChange={(value: string) => setPeriod(value)}
            data={{ cy: 'video-source-period' }}
          />
          {!manualMode && (
            <div>
              <Button
                disabled={resolving || providerLoading}
                loading={resolving}
                onClick={lookUp}
                data={{ cy: 'video-source-resolve' }}
              >
                {t('manage.admin.videoSourceResolve')}
              </Button>
            </div>
          )}
          {resolveError && (
            <UserNotification type="error">
              {resolveError.message}
            </UserNotification>
          )}

          {resolution && (
            <div className="flex flex-col gap-2 rounded border p-2">
              <h4 className="font-bold">
                {t('manage.admin.videoSourceDirectory', {
                  period: resolution.periodLabel,
                })}
              </h4>
              {resolution.directoryError && (
                <UserNotification type="error">
                  {resolution.directoryError}
                </UserNotification>
              )}
              {resolution.directory && (
                <>
                  <div>
                    {resolution.directory.title} (
                    {resolution.directory.shortName})
                  </div>
                  <div className="text-sm">
                    {t('manage.admin.videoSourceRecipients')}
                  </div>
                  <ul className="list-disc pl-5 text-sm">
                    {resolution.directory.recipients.map((r) => (
                      <li key={r.email}>
                        {r.name} &lt;{r.email}&gt; · {r.roles.join(', ')}
                      </li>
                    ))}
                  </ul>
                  {resolution.directory.withoutEmail.length > 0 && (
                    <UserNotification type="warning">
                      {t('manage.admin.videoSourceWithoutEmail', {
                        names: resolution.directory.withoutEmail.join(', '),
                      })}
                    </UserNotification>
                  )}
                  {resolution.directory.warnings.map((w) => (
                    <UserNotification key={w} type="warning">
                      {w}
                    </UserNotification>
                  ))}
                </>
              )}
              <h4 className="font-bold">
                {t('manage.admin.videoSourceCategories')}
              </h4>
              {resolution.collectionsError && (
                <UserNotification type="warning">
                  {resolution.collectionsError}
                </UserNotification>
              )}
              {resolution.collections.map((c) => (
                <label
                  key={c.id}
                  className="flex cursor-pointer gap-3 rounded border p-2 has-[:checked]:border-primary-100"
                  data-cy={`video-source-candidate-${c.id}`}
                >
                  <input
                    type="radio"
                    name="video-source-category"
                    checked={categoryId === c.id}
                    onChange={() => setCategoryId(c.id)}
                  />
                  <div className="flex flex-col text-sm">
                    <span className="font-bold">
                      {c.name} · {c.id}
                      {c.recommended &&
                        ` · ${t('manage.admin.videoSourceRecommended')}`}
                    </span>
                    <span>
                      {t('manage.admin.videoSourceCandidateStats', {
                        created: date(c.createdAt),
                        entries: c.entriesCount,
                        inPeriod: c.recordingsInPeriod,
                      })}
                    </span>
                    <span>
                      {t('manage.admin.videoSourceLatest', {
                        name: c.latestRecordingName ?? '–',
                        date: date(c.latestRecordingAt),
                      })}
                    </span>
                    {c.sampleRecordingNames.length > 0 && (
                      <span className="text-gray-600">
                        {c.sampleRecordingNames.join(' · ')}
                      </span>
                    )}
                  </div>
                </label>
              ))}
            </div>
          )}

          {manualMode && (
            <>
              <TextField
                label={t('manage.admin.videoSourceCourseTitle')}
                value={courseTitle}
                onChange={(value: string) => setCourseTitle(value)}
                data={{ cy: 'video-source-course-title' }}
              />
              <TextField
                label={t('manage.admin.videoSourceCourseShortName')}
                value={courseShortName}
                onChange={(value: string) => setCourseShortName(value)}
              />
              <label className="flex flex-col gap-1 text-sm font-bold">
                {t('manage.admin.videoSourcePeriodEnd')}
                <input
                  type="date"
                  className="rounded border px-2 py-1 font-normal"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                  data-cy="video-source-period-end"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-bold">
                {t('manage.admin.videoSourceRecipientLines')}
                <textarea
                  className="min-h-24 rounded border px-2 py-1 font-normal"
                  placeholder="Ada Example <ada@example.org>"
                  value={recipientLines}
                  onChange={(e) => setRecipientLines(e.target.value)}
                  data-cy="video-source-recipients"
                />
              </label>
            </>
          )}

          <TextField
            label={t('manage.admin.videoSourceCategoryId')}
            value={categoryId}
            disabled={Boolean(source.fixedCollectionId)}
            onChange={(value: string) => setCategoryId(value)}
            data={{ cy: 'video-source-category-id' }}
          />
          <SelectField
            label={t('manage.admin.videoSourceCutMode')}
            value={cutMode}
            onChange={(value) => setCutMode(value as KbVideoCutMode)}
            items={[
              KbVideoCutMode.Clip,
              KbVideoCutMode.Edited,
              KbVideoCutMode.AsRecorded,
            ].map((mode) => ({
              value: mode,
              label: t(`manage.videoApproval.cutMode${mode}`),
            }))}
          />
          {cutMode === KbVideoCutMode.Edited && (
            <TextField
              label={t('manage.admin.videoSourceNamePattern')}
              placeholder="^\d{2}[a-z]?_"
              value={namePattern}
              onChange={(value: string) => setNamePattern(value)}
            />
          )}
          <TextField
            label={t('manage.admin.videoSourceCaptionLanguage')}
            value={captionLanguage}
            onChange={(value: string) => setCaptionLanguage(value)}
          />
          <p className="text-xs text-gray-600">
            {t('manage.admin.videoSourceConfirmHint')}
          </p>
          {sent?.verifyVideoSource ? (
            <UserNotification type="success" data={{ cy: 'video-source-sent' }}>
              {t('manage.admin.videoSourceSent', {
                count: sent.verifyVideoSource.recipients.filter((r) => r.sent)
                  .length,
                period: sent.verifyVideoSource.periodLabel,
              })}
            </UserNotification>
          ) : (
            <div>
              <Button
                disabled={!canVerify || verifying}
                loading={verifying}
                onClick={verifyAndSend}
                className={{ root: 'bg-primary-100 text-white' }}
                data={{ cy: 'video-source-verify' }}
              >
                {t('manage.admin.videoSourceVerify')}
              </Button>
            </div>
          )}

          <div className="flex flex-col gap-2 border-t pt-3">
            <TextField
              label={t('manage.admin.videoSourceRejectReason')}
              value={rejectReason}
              onChange={(value: string) => setRejectReason(value)}
              data={{ cy: 'video-source-reject-reason' }}
            />
            <div>
              <Button
                disabled={!rejectReason.trim() || rejecting}
                loading={rejecting}
                onClick={() =>
                  reject({
                    variables: {
                      sourceId: source.id,
                      reason: rejectReason.trim(),
                    },
                  })
                    .then(() => onChanged())
                    .catch(() => undefined)
                }
                data={{ cy: 'video-source-reject' }}
              >
                {t('manage.admin.videoSourceReject')}
              </Button>
            </div>
          </div>
        </>
      )}
    </section>
  )
}

export default VideoSourceReview
