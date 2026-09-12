import { useMutation, useQuery } from '@apollo/client'
import {
  GetParticipantAccountDataUseDocument,
  SetLearningAnalyticsConsentWithRevisionDocument,
  SetResearchConsentWithRevisionDocument,
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
import { useState } from 'react'

function getGraphQLErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined

  const candidate = error as {
    extensions?: { code?: unknown }
    graphQLErrors?: unknown
    errors?: unknown
    cause?: unknown
  }
  if (typeof candidate.extensions?.code === 'string') {
    return candidate.extensions.code
  }

  for (const nestedErrors of [candidate.graphQLErrors, candidate.errors]) {
    if (!Array.isArray(nestedErrors)) continue
    for (const nestedError of nestedErrors) {
      const code = getGraphQLErrorCode(nestedError)
      if (code) return code
    }
  }

  return candidate.cause ? getGraphQLErrorCode(candidate.cause) : undefined
}

function isDataUseConflict(error: unknown) {
  const code = getGraphQLErrorCode(error)
  return (
    code === 'PARTICIPANT_DATA_USE_STALE_REVISION' ||
    code === 'PARTICIPANT_DATA_USE_STALE_DISCLOSURE' ||
    code === 'PARTICIPANT_DATA_USE_INVALID_INPUT'
  )
}

function DataUseSettings() {
  const t = useTranslations()
  const [conflict, setConflict] = useState(false)
  const [reloading, setReloading] = useState(false)
  const { data, loading, error, refetch } = useQuery(
    GetParticipantAccountDataUseDocument,
    { fetchPolicy: 'network-only' }
  )
  const [setResearchConsent, { loading: savingResearchConsent }] = useMutation(
    SetResearchConsentWithRevisionDocument
  )
  const [
    setLearningAnalyticsConsent,
    { loading: savingLearningAnalyticsConsent },
  ] = useMutation(SetLearningAnalyticsConsentWithRevisionDocument)

  const dataUse = data?.selfAccountDataUse
  const saving = savingResearchConsent || savingLearningAnalyticsConsent

  async function reloadDataUse() {
    setReloading(true)
    try {
      await refetch()
      setConflict(false)
    } catch {
      toast({
        type: 'error',
        message: t('pwa.profile.dataUseLoadFailed'),
        options: { duration: 6000 },
      })
    } finally {
      setReloading(false)
    }
  }

  async function updateResearchConsent(consent: boolean) {
    if (!dataUse || saving || conflict) return

    try {
      const result = await setResearchConsent({
        variables: {
          consent,
          expectedRevision: dataUse.dataUseRevision,
          disclosureVersion: dataUse.currentDisclosureVersion,
        },
      })

      if (!result.data?.setResearchConsent) throw new Error('Save failed')
      await refetch()
      setConflict(false)

      toast({
        type: 'success',
        message: t('pwa.profile.researchConsentSaved'),
        options: { duration: 3500 },
      })
    } catch (error) {
      if (isDataUseConflict(error)) {
        setConflict(true)
        toast({
          type: 'error',
          message: t('pwa.profile.dataUseConflict'),
          options: { duration: 6000 },
        })
        return
      }

      toast({
        type: 'error',
        message: t('pwa.profile.researchConsentFailed'),
        options: { duration: 6000 },
      })
    }
  }

  async function updateLearningAnalyticsConsent(consent: boolean) {
    if (!dataUse || saving || conflict) return

    try {
      const result = await setLearningAnalyticsConsent({
        variables: {
          consent,
          expectedRevision: dataUse.dataUseRevision,
          disclosureVersion: dataUse.currentDisclosureVersion,
        },
      })

      if (!result.data?.setLearningAnalyticsConsent)
        throw new Error('Save failed')
      await refetch()
      setConflict(false)

      toast({
        type: 'success',
        message: t('pwa.profile.learningAnalyticsConsentSaved'),
        options: { duration: 3500 },
      })
    } catch (error) {
      if (isDataUseConflict(error)) {
        setConflict(true)
        toast({
          type: 'error',
          message: t('pwa.profile.dataUseConflict'),
          options: { duration: 6000 },
        })
        return
      }

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
            onClick={() => void reloadDataUse()}
            disabled={reloading}
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

      {conflict && (
        <UserNotification type="error">
          <div className="flex flex-col items-start gap-2">
            <span>{t('pwa.profile.dataUseConflict')}</span>
            <Button
              basic
              onClick={() => void reloadDataUse()}
              disabled={reloading}
              data={{ cy: 'participant-data-use-conflict-reload' }}
            >
              <Button.Label>{t('shared.generic.tryAgain')}</Button.Label>
            </Button>
          </div>
        </UserNotification>
      )}

      <div className="flex flex-col gap-2 rounded border bg-white p-3">
        <Switch
          checked={dataUse.researchConsent}
          disabled={saving || conflict}
          onCheckedChange={(consent) => void updateResearchConsent(consent)}
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
          {t('pwa.profile.researchConsentDescription')}{' '}
          <a
            href={t('auth.privacyUrl')}
            target="_blank"
            rel="noopener noreferrer"
            data-cy="participant-research-privacy-policy"
          >
            {t('pwa.profile.dataUsePrivacyPolicy')}
          </a>
        </Prose>
      </div>

      <div className="flex flex-col gap-2 rounded border bg-white p-3">
        <Switch
          checked={dataUse.learningAnalyticsConsent}
          disabled={saving || conflict}
          onCheckedChange={(consent) =>
            void updateLearningAnalyticsConsent(consent)
          }
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
          {t('pwa.profile.learningAnalyticsConsentDescription')}{' '}
          <a
            href={t('auth.privacyUrl')}
            target="_blank"
            rel="noopener noreferrer"
            data-cy="participant-learning-analytics-privacy-policy"
          >
            {t('pwa.profile.dataUsePrivacyPolicy')}
          </a>
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
