import { useMutation, useQuery } from '@apollo/client'
import Layout from '@components/Layout'
import ParticipantDataDisclosure from '@components/participant/ParticipantDataDisclosure'
import {
  CompleteParticipantDataUseDocument,
  GetParticipantAccountDataUseDocument,
  SelfDocument,
} from '@klicker-uzh/graphql/dist/ops'
import DynamicMarkdown from '@klicker-uzh/shared-components/src/evaluation/DynamicMarkdown'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import ParticipantDataUseChoices from '@klicker-uzh/shared-components/src/participant/ParticipantDataUseChoices'
import { PARTICIPANT_DATA_USE_DISCLOSURE_VERSION } from '@klicker-uzh/util/participant-account-data-use'
import { isDataUseConflict } from '@lib/participantDataUseConflicts'
import {
  clearDataUseReturnTarget,
  participantDataUseReturn,
  readDataUseReturnTarget,
} from '@lib/participantDataUseReturn'
import {
  Button,
  Checkbox,
  H1,
  H3,
  UserNotification,
} from '@uzh-bf/design-system'
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
  const [conflict, setConflict] = useState(false)
  const state = data?.selfAccountDataUse
  // The disclosure text is bundled with this frontend build; a server-side
  // newer required version means the displayed content cannot record choices.
  const versionMismatch =
    state != null &&
    state.currentDisclosureVersion !== PARTICIPANT_DATA_USE_DISCLOSURE_VERSION
  const { data: selfData } = useQuery(SelfDocument, { skip: !isAssessment })
  const identity =
    selfData?.self?.email ??
    selfData?.self?.institutionalEmail ??
    selfData?.self?.username
  const researchChoice =
    research ?? (state?.researchChoiceRecorded ? state.researchConsent : true)
  const analyticsChoice =
    analytics ??
    (state?.learningAnalyticsChoiceRecorded
      ? state.learningAnalyticsConsent
      : undefined)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (
      !state ||
      !acknowledged ||
      analyticsChoice === undefined ||
      saving ||
      conflict ||
      versionMismatch
    ) {
      return
    }
    setFailed(false)
    try {
      const result = await complete({
        variables: {
          expectedRevision: state.dataUseRevision,
          disclosureVersion: PARTICIPANT_DATA_USE_DISCLOSURE_VERSION,
          researchConsent: researchChoice,
          learningAnalyticsConsent: analyticsChoice,
          acknowledged,
        },
      })
      if (!result.data?.completeParticipantDataUse.isComplete)
        throw new Error('Completion failed')
    } catch (error) {
      if (isDataUseConflict(error)) {
        // The persisted state changed elsewhere; reset to the reloaded
        // choices so a plain retry cannot overwrite the newer decision.
        setConflict(true)
        setAcknowledged(false)
        setResearch(undefined)
        setAnalytics(undefined)
        await refetch()
        return
      }
      // The write outcome is unknown. Reload the persisted choices and drop
      // the local intent and acknowledgement, so the next attempt submits the
      // reloaded choices against their own revision and the participant must
      // acknowledge them again. A retry can then no longer pair old form
      // intent with a newer revision produced by another tab.
      setFailed(true)
      setAcknowledged(false)
      setResearch(undefined)
      setAnalytics(undefined)
      await refetch()
      return
    }

    // The choices are persisted now. Reading or clearing the optional return
    // target and navigating must never be reported as a failed save, so this
    // runs outside the mutation's error handling.
    const saved = readDataUseReturnTarget()
    clearDataUseReturnTarget()
    try {
      await router.replace(
        participantDataUseReturn(saved ?? '/', window.location.origin)
      )
    } catch {
      // A navigation failure must not read as a persistence failure.
    }
  }

  return (
    <Layout>
      <div className="mx-auto w-full max-w-2xl space-y-4 md:max-w-[1090px]">
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
            <div className="flex flex-col gap-4 md:grid md:grid-cols-2">
              <div className="space-y-4">
                {isAssessment && (
                  <section className="space-y-2 rounded bg-slate-50 p-4">
                    <H3 className={{ root: 'mb-0 border-b' }}>
                      {t('pwa.createAccount.signup.accessTitle')}
                    </H3>
                    {identity && (
                      <>
                        <p className="font-medium">{identity}</p>
                        <p className="text-sm text-slate-600">
                          {t('pwa.createAccount.signup.accessNoPassword')}
                        </p>
                      </>
                    )}
                  </section>
                )}
                <ParticipantDataDisclosure isAssessment={isAssessment} />
              </div>
              <div className="space-y-2 rounded md:bg-slate-50 md:p-4">
                <H3 className={{ root: 'mb-0 border-b' }}>
                  {t('pwa.createAccount.signup.dataUseTitle')}
                </H3>
                <ParticipantDataUseChoices
                  disabled={saving}
                  isAssessment={isAssessment}
                  researchConsent={researchChoice}
                  learningAnalyticsConsent={analyticsChoice}
                  onResearchConsentChange={setResearch}
                  onLearningAnalyticsConsentChange={setAnalytics}
                  dataCy={{
                    researchYes: 'account-data-use-research-true',
                    researchNo: 'account-data-use-research-false',
                    researchToggle: 'account-data-use-research-toggle',
                    learningAnalyticsYes: 'account-data-use-analytics-true',
                    learningAnalyticsNo: 'account-data-use-analytics-false',
                    learningAnalyticsToggle:
                      'account-data-use-analytics-toggle',
                    learningAnalyticsPrivacy: 'account-data-use-privacy-policy',
                  }}
                />
              </div>
            </div>
            {failed && (
              <UserNotification type="error">
                {t('shared.generic.systemError')}
              </UserNotification>
            )}
            {(conflict || versionMismatch) && (
              <UserNotification type="error">
                {t('pwa.profile.dataUseConflict')}
              </UserNotification>
            )}
            <div className="flex flex-col items-start justify-between gap-2 rounded bg-slate-100 p-4 md:flex-row md:items-center md:gap-4">
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
              <Button
                primary
                type="submit"
                loading={saving}
                disabled={
                  !acknowledged ||
                  analyticsChoice === undefined ||
                  conflict ||
                  versionMismatch
                }
                className={{ root: 'w-full flex-none md:w-max' }}
                data={{ cy: 'account-data-use-submit' }}
              >
                {t(
                  isAssessment
                    ? 'pwa.createAccount.signup.assessmentSubmit'
                    : 'shared.generic.continue'
                )}
              </Button>
            </div>
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
