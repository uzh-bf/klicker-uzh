import { useMutation, useQuery } from '@apollo/client'
import {
  GetParticipantDataUseDocument,
  SetLearningAnalyticsConsentDocument,
  SetResearchConsentDocument,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import {
  Button,
  H3,
  Prose,
  Switch,
  UserNotification,
  toast,
} from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

function DataUseSettings() {
  const t = useTranslations()
  const { data, loading, error, refetch } = useQuery(
    GetParticipantDataUseDocument
  )
  const [setResearchConsent, { loading: savingResearchConsent }] = useMutation(
    SetResearchConsentDocument
  )
  const [
    setLearningAnalyticsConsent,
    { loading: savingLearningAnalyticsConsent },
  ] = useMutation(SetLearningAnalyticsConsentDocument)

  const dataUse = data?.selfDataUse

  async function updateResearchConsent(consent: boolean) {
    try {
      const result = await setResearchConsent({
        variables: { consent },
        refetchQueries: [GetParticipantDataUseDocument],
        awaitRefetchQueries: true,
      })

      if (!result.data?.setResearchConsent) throw new Error('Save failed')

      toast({
        type: 'success',
        message: t('pwa.profile.researchConsentSaved'),
        options: { duration: 3500 },
      })
    } catch {
      toast({
        type: 'error',
        message: t('pwa.profile.researchConsentFailed'),
        options: { duration: 6000 },
      })
    }
  }

  async function updateLearningAnalyticsConsent(consent: boolean) {
    try {
      const result = await setLearningAnalyticsConsent({
        variables: { consent },
        refetchQueries: [GetParticipantDataUseDocument],
        awaitRefetchQueries: true,
      })

      if (!result.data?.setLearningAnalyticsConsent)
        throw new Error('Save failed')

      toast({
        type: 'success',
        message: t('pwa.profile.learningAnalyticsConsentSaved'),
        options: { duration: 3500 },
      })
    } catch {
      toast({
        type: 'error',
        message: t('pwa.profile.learningAnalyticsConsentFailed'),
        options: { duration: 6000 },
      })
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-40 items-center justify-center rounded-md md:bg-slate-50 md:p-4">
        <Loader />
      </div>
    )
  }

  if (error || !dataUse) {
    return (
      <UserNotification type="error">
        <div className="flex flex-col items-start gap-2">
          <span>{t('pwa.profile.dataUseLoadFailed')}</span>
          <Button
            basic
            onClick={() => void refetch()}
            data={{ cy: 'participant-data-use-retry' }}
          >
            <Button.Label>{t('shared.generic.tryAgain')}</Button.Label>
          </Button>
        </div>
      </UserNotification>
    )
  }

  return (
    <section
      className="flex flex-col gap-4 rounded-md md:bg-slate-50 md:p-4"
      aria-labelledby="participant-data-use-title"
    >
      <div>
        <H3
          id="participant-data-use-title"
          className={{ root: 'mb-1 border-b' }}
        >
          {t('pwa.profile.dataUseTitle')}
        </H3>
        <Prose className={{ root: 'prose-sm' }}>
          {t('pwa.profile.dataUseDescription')}
        </Prose>
      </div>

      <div className="flex flex-col gap-2 rounded border bg-white p-3">
        <Switch
          checked={dataUse.researchConsent}
          disabled={savingResearchConsent}
          onCheckedChange={updateResearchConsent}
          label={`${t('pwa.profile.researchConsentTitle')}: ${
            dataUse.researchConsent
              ? t('shared.generic.yes')
              : t('shared.generic.no')
          }`}
          className={{
            root: 'flex flex-row-reverse justify-end gap-3',
            label: 'mr-0 font-semibold',
          }}
          data={{ cy: 'participant-research-consent' }}
        />
        <Prose className={{ root: 'prose-sm' }}>
          {t('pwa.profile.researchConsentDescription')}
        </Prose>
      </div>

      <div className="flex flex-col gap-2 rounded border bg-white p-3">
        <Switch
          checked={dataUse.learningAnalyticsConsent}
          disabled={savingLearningAnalyticsConsent}
          onCheckedChange={updateLearningAnalyticsConsent}
          label={`${t('pwa.profile.learningAnalyticsConsentTitle')}: ${
            dataUse.learningAnalyticsConsent
              ? t('shared.generic.yes')
              : t('shared.generic.no')
          }`}
          className={{
            root: 'flex flex-row-reverse justify-end gap-3',
            label: 'mr-0 font-semibold',
          }}
          data={{ cy: 'participant-learning-analytics-consent' }}
        />
        <Prose className={{ root: 'prose-sm' }}>
          {t('pwa.profile.learningAnalyticsConsentDescription')}
        </Prose>
      </div>

      <Prose className={{ root: 'prose-sm' }}>
        {t('pwa.profile.dataUseCanonicalDataNotice')}{' '}
        <a
          href={t('auth.privacyUrl')}
          target="_blank"
          rel="noopener noreferrer"
          data-cy="participant-data-use-privacy-policy"
        >
          {t('pwa.profile.dataUsePrivacyPolicy')}
        </a>
      </Prose>
    </section>
  )
}

export default DataUseSettings
