import { useMutation, useQuery } from '@apollo/client'
import Layout from '@components/Layout'
import ParticipantDataDisclosure from '@components/participant/ParticipantDataDisclosure'
import {
  CompleteParticipantDataUseDocument,
  GetParticipantAccountDataUseDocument,
} from '@klicker-uzh/graphql/dist/ops'
import DynamicMarkdown from '@klicker-uzh/shared-components/src/evaluation/DynamicMarkdown'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { participantDataUseReturn } from '@lib/participantDataUseReturn'
import { Button, Checkbox, H1, UserNotification } from '@uzh-bf/design-system'
import type { GetStaticPropsContext } from 'next'
import { useRouter } from 'next/router'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

function AccountDataUse() {
  const t = useTranslations()
  const router = useRouter()
  const isAssessment = process.env.NEXT_PUBLIC_IS_ASSESSMENT === 'true'
  const { data, loading, error, refetch } = useQuery(
    GetParticipantAccountDataUseDocument,
    { fetchPolicy: 'network-only' }
  )
  const [complete, { loading: saving }] = useMutation(
    CompleteParticipantDataUseDocument
  )
  const [research, setResearch] = useState<boolean>()
  const [analytics, setAnalytics] = useState<boolean>()
  const [acknowledged, setAcknowledged] = useState(false)
  const [failed, setFailed] = useState(false)
  const state = data?.selfAccountDataUse
  const researchChoice =
    research ?? (state?.researchChoiceRecorded ? state.researchConsent : true)
  const analyticsChoice =
    analytics ??
    (state?.learningAnalyticsChoiceRecorded
      ? state.learningAnalyticsConsent
      : undefined)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!state || !acknowledged || analyticsChoice === undefined || saving)
      return
    setFailed(false)
    try {
      const result = await complete({
        variables: {
          expectedRevision: state.dataUseRevision,
          disclosureVersion: state.currentDisclosureVersion,
          researchConsent: researchChoice,
          learningAnalyticsConsent: analyticsChoice,
          acknowledged,
        },
      })
      if (!result.data?.completeParticipantDataUse.isComplete)
        throw new Error('Completion failed')
      const saved = sessionStorage.getItem('participant_data_use_return')
      sessionStorage.removeItem('participant_data_use_return')
      await router.replace(
        participantDataUseReturn(saved ?? '/', window.location.origin)
      )
    } catch {
      setFailed(true)
      await refetch()
    }
  }

  return (
    <Layout>
      <div className="mx-auto w-full max-w-2xl space-y-4">
        <H1>
          {t(
            isAssessment
              ? 'pwa.createAccount.signup.assessmentTitle'
              : 'pwa.createAccount.dataProcessingTitle'
          )}
        </H1>
        {loading ? (
          <Loader />
        ) : error || !state ? (
          <UserNotification type="error">
            {t('shared.generic.systemError')}
          </UserNotification>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <ParticipantDataDisclosure isAssessment={isAssessment} />
            {[
              {
                name: 'research',
                title: t('pwa.createAccount.signup.researchConsentTitle'),
                description: t(
                  'pwa.createAccount.signup.researchConsentDescription'
                ),
                value: researchChoice,
                set: setResearch,
                yes: t('pwa.createAccount.signup.researchConsentYes'),
                no: t('pwa.createAccount.signup.researchConsentNo'),
              },
              {
                name: 'analytics',
                title: t(
                  'pwa.createAccount.signup.learningAnalyticsConsentTitle'
                ),
                description: t(
                  'pwa.createAccount.signup.learningAnalyticsConsentDescription'
                ),
                value: analyticsChoice,
                set: setAnalytics,
                yes: t('pwa.createAccount.signup.learningAnalyticsConsentYes'),
                no: t('pwa.createAccount.signup.learningAnalyticsConsentNo'),
              },
            ].map((choice) => (
              <fieldset
                key={choice.name}
                className="space-y-2 rounded bg-slate-50 p-4"
              >
                <legend className="font-bold">{choice.title}</legend>
                <DynamicMarkdown
                  withProse
                  withLinkButtons={false}
                  className={{ root: 'prose-sm' }}
                  content={choice.description}
                />
                {[true, false].map((value) => (
                  <label
                    key={String(value)}
                    className="flex items-center gap-2"
                  >
                    <input
                      type="radio"
                      name={choice.name}
                      required
                      checked={choice.value === value}
                      onChange={() => choice.set(value)}
                      data-cy={`account-data-use-${choice.name}-${value}`}
                    />
                    {value ? choice.yes : choice.no}
                  </label>
                ))}
              </fieldset>
            ))}
            <a
              className="underline"
              href={t('auth.privacyUrl')}
              target="_blank"
              rel="noreferrer"
              data-cy="account-data-use-privacy-policy"
            >
              {t('pwa.profile.dataUsePrivacyPolicy')}
            </a>
            <Checkbox
              checked={acknowledged}
              onCheck={() => setAcknowledged(!acknowledged)}
              data={{ cy: 'account-data-use-acknowledged' }}
              label={
                <DynamicMarkdown
                  withProse
                  withLinkButtons={false}
                  content={t(
                    isAssessment
                      ? 'pwa.createAccount.signup.assessmentAcknowledgement'
                      : 'pwa.createAccount.signup.acknowledgement'
                  )}
                />
              }
            />
            {failed && (
              <UserNotification type="error">
                {t('shared.generic.systemError')}
              </UserNotification>
            )}
            <Button
              primary
              type="submit"
              loading={saving}
              disabled={!acknowledged || analyticsChoice === undefined}
              data={{ cy: 'account-data-use-submit' }}
            >
              {t(
                isAssessment
                  ? 'pwa.createAccount.signup.assessmentSubmit'
                  : 'shared.generic.continue'
              )}
            </Button>
          </form>
        )}
      </div>
    </Layout>
  )
}

export async function getStaticProps({ locale }: GetStaticPropsContext) {
  return {
    props: {
      messages: (await import(`@klicker-uzh/i18n/messages/${locale}`)).default,
    },
  }
}

export default AccountDataUse
