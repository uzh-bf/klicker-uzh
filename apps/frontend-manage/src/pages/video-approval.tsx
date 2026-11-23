import { useMutation, useQuery } from '@apollo/client'
import {
  ApproveVideoSourceByLinkDocument,
  GetVideoApprovalLinkDocument,
  RevokeVideoSourceByLinkDocument,
  type VideoApprovalLinkDataFragment,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import {
  Button,
  Checkbox,
  H2,
  H3,
  TextField,
  UserNotification,
} from '@uzh-bf/design-system'
import type { GetStaticPropsContext } from 'next'
import { useRouter } from 'next/router'
import { useFormatter, useTranslations } from 'next-intl'
import { type ReactNode, useState } from 'react'
import Layout from '../components/Layout'

// Landing page of the lecturer approval link for lecture video sources. The
// token comes from the email; the page needs a signed-in (edu-ID) lecturer.
function VideoApproval() {
  const t = useTranslations()
  const router = useRouter()
  const token =
    typeof router.query.token === 'string' ? router.query.token : undefined

  const { data, loading, error } = useQuery(GetVideoApprovalLinkDocument, {
    variables: { token: token ?? '' },
    skip: !token,
    fetchPolicy: 'network-only',
  })

  return (
    <Layout displayName={t('manage.videoApproval.pageTitle')}>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <H2>{t('manage.videoApproval.pageTitle')}</H2>
        {!router.isReady || loading ? (
          <Loader />
        ) : !token || error || !data?.getVideoApprovalLink ? (
          <UserNotification type="error">
            {t('manage.videoApproval.invalidLink')}
          </UserNotification>
        ) : (
          <ApprovalDetails token={token} link={data.getVideoApprovalLink} />
        )}
      </div>
    </Layout>
  )
}

function ApprovalDetails({
  token,
  link,
}: {
  token: string
  link: VideoApprovalLinkDataFragment
}) {
  const t = useTranslations()
  const format = useFormatter()
  const [consented, setConsented] = useState(false)
  const [confirmRevoke, setConfirmRevoke] = useState(false)
  const [reason, setReason] = useState('')

  const [approve, { loading: approving, error: approveError }] = useMutation(
    ApproveVideoSourceByLinkDocument
  )
  const [revoke, { loading: revoking, error: revokeError }] = useMutation(
    RevokeVideoSourceByLinkDocument
  )

  const date = (value: string | Date | null | undefined) =>
    value
      ? format.dateTime(new Date(value), {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : ''
  const blockedByEduId = link.eduIdRequired && !link.eduIdSignedIn

  // Mutation errors surface through the hooks' error state rendered below, so
  // the handlers only swallow the rejection and never return a promise.
  const handleApprove = (): void => {
    approve({
      variables: { token, consentVersion: link.consentVersion },
    }).catch(() => undefined)
  }
  const handleRevoke = (): void => {
    revoke({ variables: { token, reason: reason.trim() || null } })
      .then(() => setConfirmRevoke(false))
      .catch(() => undefined)
  }
  const mutationError = approveError ?? revokeError

  const stateText = {
    AWAITING_APPROVAL: t('manage.videoApproval.stateAWAITING_APPROVAL', {
      date: date(link.grantExpiresAt),
    }),
    GRANT_EXPIRED: t('manage.videoApproval.stateGRANT_EXPIRED', {
      date: date(link.grantExpiresAt),
      requester: link.requestedByName,
    }),
    SUPERSEDED: t('manage.videoApproval.stateSUPERSEDED'),
    AWAITING_ADMIN: t('manage.videoApproval.stateAWAITING_ADMIN', {
      name: link.decidedByName ?? '',
      date: date(link.decidedAt),
    }),
    ACTIVE: t('manage.videoApproval.stateACTIVE', {
      name: link.decidedByName ?? '',
      date: date(link.validUntil),
    }),
    ENDED: t('manage.videoApproval.stateENDED', { semester: link.semester }),
    REVOKED: t('manage.videoApproval.stateREVOKED'),
  }[link.state]

  const facts: Array<[string, ReactNode]> = [
    [
      t('manage.videoApproval.course'),
      <a
        key="course"
        href={link.catalogUrl}
        target="_blank"
        rel="noreferrer noopener"
        className="text-primary-100 underline"
      >
        {link.courseTitle} ({link.courseShortName})
      </a>,
    ],
    [t('manage.videoApproval.semester'), link.semester],
    [
      t('manage.videoApproval.responsible'),
      link.responsibleNames.join(', ') || '–',
    ],
    [t('manage.videoApproval.chatbots'), link.chatbotNames.join(', ') || '–'],
    [
      t('manage.videoApproval.source'),
      <a
        key="source"
        href={link.sourceUrl}
        target="_blank"
        rel="noreferrer noopener"
        className="text-primary-100 underline"
      >
        {link.sourceName}
      </a>,
    ],
    [t('manage.videoApproval.channel'), link.kalturaCategoryId],
    [
      t('manage.videoApproval.cutMode'),
      t(`manage.videoApproval.cutMode${link.cutMode}`),
    ],
  ]

  return (
    <div className="flex flex-col gap-4" data-cy="video-approval">
      <UserNotification type="info" data={{ cy: 'video-approval-requester' }}>
        {t('manage.videoApproval.requestedBy', {
          name: link.requestedByName,
          email: link.requestedByEmail,
          date: date(link.requestedAt),
        })}
      </UserNotification>

      <dl className="grid grid-cols-1 gap-x-4 gap-y-2 md:grid-cols-[12rem_1fr]">
        {facts.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="font-bold">{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-sm text-gray-600">
        {t('manage.videoApproval.recordingsScope', {
          semester: link.semester,
        })}
      </p>

      <UserNotification
        type={link.state === 'REVOKED' ? 'warning' : 'default'}
        data={{ cy: 'video-approval-state' }}
      >
        {stateText}
      </UserNotification>

      {!link.identityMatched && (link.canApprove || link.canRevoke) && (
        <UserNotification type="warning">
          {t('manage.videoApproval.identityMismatch', {
            recipient: link.recipientEmail,
            signedIn: link.signedInEmail,
          })}
        </UserNotification>
      )}
      {blockedByEduId && (link.canApprove || link.canRevoke) && (
        <UserNotification type="error">
          {t('manage.videoApproval.eduIdRequired')}
        </UserNotification>
      )}
      {mutationError && (
        <UserNotification type="error">
          {mutationError.message}
        </UserNotification>
      )}

      {link.canApprove && (
        <section className="flex flex-col gap-3 rounded border p-4">
          <H3>{t('manage.videoApproval.consentTitle')}</H3>
          <p className="whitespace-pre-line">{link.consentText}</p>
          <div className="flex items-center gap-2">
            <Checkbox
              id="video-approval-consent"
              checked={consented}
              onCheck={() => setConsented((value) => !value)}
              disabled={blockedByEduId}
              data={{ cy: 'video-approval-consent' }}
            />
            <label htmlFor="video-approval-consent">
              {t('manage.videoApproval.consentCheck')}
            </label>
          </div>
          <div className="flex gap-2">
            <Button
              disabled={!consented || blockedByEduId || approving}
              loading={approving}
              onClick={handleApprove}
              className={{ root: 'bg-primary-100 text-white' }}
              data={{ cy: 'video-approval-approve' }}
            >
              {t('manage.videoApproval.approve')}
            </Button>
          </div>
        </section>
      )}

      {link.canRevoke && !confirmRevoke && (
        <div>
          <Button
            disabled={blockedByEduId}
            onClick={() => setConfirmRevoke(true)}
            data={{ cy: 'video-approval-revoke' }}
          >
            {link.state === 'AWAITING_APPROVAL' ||
            link.state === 'GRANT_EXPIRED'
              ? t('manage.videoApproval.decline')
              : t('manage.videoApproval.revoke')}
          </Button>
        </div>
      )}

      {link.canRevoke && confirmRevoke && (
        <section className="flex flex-col gap-3 rounded border border-red-300 p-4">
          <H3>{t('manage.videoApproval.revokeConfirmTitle')}</H3>
          <p>{t('manage.videoApproval.revokeConfirmText')}</p>
          <TextField
            id="video-approval-reason"
            label={t('manage.videoApproval.revokeReason')}
            value={reason}
            onChange={(value: string) => setReason(value)}
            data={{ cy: 'video-approval-reason' }}
          />
          <div className="flex gap-2">
            <Button
              disabled={revoking || blockedByEduId}
              loading={revoking}
              onClick={handleRevoke}
              className={{ root: 'bg-red-600 text-white' }}
              data={{ cy: 'video-approval-revoke-confirm' }}
            >
              {t('manage.videoApproval.revokeConfirm')}
            </Button>
            <Button onClick={() => setConfirmRevoke(false)}>
              {t('manage.videoApproval.cancel')}
            </Button>
          </div>
        </section>
      )}

      <p className="text-xs text-gray-500">
        {t('manage.videoApproval.sentTo', {
          name: link.recipientName,
          email: link.recipientEmail,
        })}
      </p>
    </div>
  )
}

export async function getStaticProps({ locale }: GetStaticPropsContext) {
  return {
    props: {
      messages: (await import(`@klicker-uzh/i18n/messages/${locale}`)).default,
    },
  }
}

export default VideoApproval
