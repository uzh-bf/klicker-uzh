import { useMutation, useQuery } from '@apollo/client'
import {
  GetParticipantAccountDataUseDocument,
  SetLearningAnalyticsConsentDocument,
  SetResearchConsentDocument,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { PARTICIPANT_DATA_USE_DISCLOSURE_VERSION } from '@klicker-uzh/util/dist/participantAccountDataUse'
import { isDataUseConflict } from '@lib/participantDataUseConflicts'
import {
  Button,
  H3,
  Modal,
  Prose,
  Switch,
  toast,
  UserNotification,
} from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

function DataUseSettings() {
  const t = useTranslations()
  const [withdrawalConfirmationOpen, setWithdrawalConfirmationOpen] =
    useState(false)
  const [conflict, setConflict] = useState(false)
  const [reloading, setReloading] = useState(false)
  const { data, loading, error, refetch } = useQuery(
    GetParticipantAccountDataUseDocument,
    { fetchPolicy: 'network-only' }
  )
  const [setResearchConsent, { loading: savingResearchConsent }] = useMutation(
    SetResearchConsentDocument
  )
  const [
    setLearningAnalyticsConsent,
    { loading: savingLearningAnalyticsConsent },
  ] = useMutation(SetLearningAnalyticsConsentDocument)

  const dataUse = data?.selfAccountDataUse
  const saving =
    savingResearchConsent || savingLearningAnalyticsConsent || reloading
  // The disclosure text is bundled with this frontend build; if the server
  // already requires a newer version, the displayed content cannot record
  // choices until the page has been reloaded with matching content.
  const versionMismatch =
    dataUse != null &&
    dataUse.currentDisclosureVersion !== PARTICIPANT_DATA_USE_DISCLOSURE_VERSION

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
    if (!dataUse || saving || conflict || versionMismatch) return

    try {
      const result = await setResearchConsent({
        variables: {
          consent,
          expectedRevision: dataUse.dataUseRevision,
          disclosureVersion: PARTICIPANT_DATA_USE_DISCLOSURE_VERSION,
        },
      })

      if (!result.data?.setResearchConsent) throw new Error('Save failed')
      toast({
        type: 'success',
        message: t('pwa.profile.researchConsentSaved'),
        options: { duration: 3500 },
      })
      await reloadDataUse()
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

  async function updateLearningAnalyticsConsent(
    consent: boolean
  ): Promise<boolean> {
    if (!dataUse || saving || conflict || versionMismatch) return false

    try {
      const result = await setLearningAnalyticsConsent({
        variables: {
          consent,
          expectedRevision: dataUse.dataUseRevision,
          disclosureVersion: PARTICIPANT_DATA_USE_DISCLOSURE_VERSION,
        },
      })

      if (!result.data?.setLearningAnalyticsConsent)
        throw new Error('Save failed')
      toast({
        type: 'success',
        message: t('pwa.profile.learningAnalyticsConsentSaved'),
        options: { duration: 3500 },
      })
      await reloadDataUse()
      return true
    } catch (error) {
      if (isDataUseConflict(error)) {
        setConflict(true)
        toast({
          type: 'error',
          message: t('pwa.profile.dataUseConflict'),
          options: { duration: 6000 },
        })
        return false
      }

      toast({
        type: 'error',
        message: t('pwa.profile.learningAnalyticsConsentFailed'),
        options: { duration: 6000 },
      })
      return false
    }
  }

  async function confirmLearningAnalyticsWithdrawal() {
    if (saving) return
    const saved = await updateLearningAnalyticsConsent(false)
    if (saved) {
      setWithdrawalConfirmationOpen(false)
    }
  }

  function handleLearningAnalyticsChange(consent: boolean) {
    if (dataUse?.learningAnalyticsConsent && !consent) {
      setWithdrawalConfirmationOpen(true)
      return
    }

    void updateLearningAnalyticsConsent(consent)
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

      {(conflict || versionMismatch) && (
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
          disabled={saving || conflict || versionMismatch}
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
          disabled={saving || conflict || versionMismatch}
          onCheckedChange={handleLearningAnalyticsChange}
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

      <Modal
        open={withdrawalConfirmationOpen}
        hideCloseButton
        escapeDisabled={saving}
        title={t('pwa.profile.learningAnalyticsWithdrawalTitle')}
        primaryLabel={t('shared.generic.confirm')}
        primaryButtonStyle="destructive"
        primaryLoading={saving}
        onPrimaryAction={() => void confirmLearningAnalyticsWithdrawal()}
        dataPrimaryAction={{ cy: 'confirm-learning-analytics-withdrawal' }}
        secondaryLabel={t('shared.generic.cancel')}
        onSecondaryAction={() => {
          if (!saving) setWithdrawalConfirmationOpen(false)
        }}
        dataSecondaryAction={{ cy: 'cancel-learning-analytics-withdrawal' }}
        onClose={() => {
          if (!saving) setWithdrawalConfirmationOpen(false)
        }}
        className={{ content: 'max-w-md' }}
      >
        <div>{t('pwa.profile.learningAnalyticsWithdrawalConfirmation')}</div>
      </Modal>

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
