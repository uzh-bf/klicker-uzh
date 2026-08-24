'use client'

import { useMutation, useQuery } from '@apollo/client'
import {
  GetOwnerProviderCredentialsDocument,
  RevokeProviderCredentialDocument,
  ResumeProviderCredentialDocument,
  SuspendProviderCredentialDocument,
  type ProviderCredentialStatus,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { Button } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

const SECRET_INGRESS_ENDPOINT = '/api/provider-credentials/secret'

function statusColor(status: string): string {
  switch (status) {
    case 'ACTIVE':
      return 'text-green-700'
    case 'PENDING_VALIDATION':
      return 'text-orange-600'
    case 'SUSPENDED':
      return 'text-yellow-600'
    default:
      return 'text-red-600'
  }
}

function ProviderCredentialSettings() {
  const t = useTranslations()
  const { data, loading, refetch } = useQuery(
    GetOwnerProviderCredentialsDocument
  )
  const [suspend] = useMutation(SuspendProviderCredentialDocument)
  const [resume] = useMutation(ResumeProviderCredentialDocument)
  const [revoke] = useMutation(RevokeProviderCredentialDocument)

  // Registration form state
  const [showRegister, setShowRegister] = useState(false)
  const [secretInput, setSecretInput] = useState('')
  const [registerError, setRegisterError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [registeredId, setRegisteredId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  if (loading) return <Loader />

  const credentials = data?.getOwnerProviderCredentials ?? []

  async function handleRegister() {
    setRegisterError(null)
    setSubmitting(true)
    try {
      // Step 1: POST the secret to the dedicated ingress route (not GraphQL).
      // The route generates the vault name server-side and stores it in the
      // lifecycle service with PENDING_VALIDATION status.
      const res = await fetch(SECRET_INGRESS_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileKey: 'uzh-azure-openai',
          secret: secretInput,
        }),
        credentials: 'include',
      })
      if (!res.ok) {
        setRegisterError(
          t('manage.settings.providerCredentials.registerFailed')
        )
        return
      }
      const body = await res.json()
      if (!body.ok || !body.credentialId) {
        setRegisterError(
          t('manage.settings.providerCredentials.registerFailed')
        )
        return
      }
      setRegisteredId(body.credentialId as string)
      setSecretInput('')
      setShowRegister(false)
      await refetch()
    } catch {
      setRegisterError(t('manage.settings.providerCredentials.registerFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleLifecycleAction(
    credentialId: string,
    action: 'suspend' | 'resume' | 'revoke'
  ) {
    setActionError(null)
    const mutation =
      action === 'suspend' ? suspend : action === 'resume' ? resume : revoke
    try {
      await mutation({ variables: { credentialId } })
      await refetch()
    } catch {
      setActionError(t('manage.settings.providerCredentials.actionFailed'))
    }
  }

  return (
    <div className="mt-6">
      <div className="mb-2 flex items-center justify-between">
        <div className="font-bold">
          {t('manage.settings.providerCredentials.title')}
        </div>
        <Button primary onClick={() => setShowRegister(!showRegister)}>
          {t('manage.settings.providerCredentials.addCredential')}
        </Button>
      </div>

      {showRegister && (
        <div className="border-uzh-grey-100 mb-4 rounded border border-solid p-3">
          <label className="mb-1 block text-sm font-semibold">
            {t('manage.settings.providerCredentials.secretLabel')}
          </label>
          <input
            type="password"
            value={secretInput}
            onChange={(e) => setSecretInput(e.target.value)}
            className="border-uzh-grey-300 w-full rounded border border-solid px-2 py-1 text-sm"
            placeholder={t(
              'manage.settings.providerCredentials.secretPlaceholder'
            )}
          />
          <p className="text-uzh-grey-600 mt-1 text-xs">
            {t('manage.settings.providerCredentials.secretNote')}
          </p>
          {registerError && (
            <p className="mt-1 text-sm text-red-600">{registerError}</p>
          )}
          <Button
            onClick={handleRegister}
            primary
            disabled={!secretInput.trim() || submitting}
          >
            {submitting
              ? t('shared.generic.loading')
              : t('manage.settings.providerCredentials.submitSecret')}
          </Button>
        </div>
      )}

      {registeredId && (
        <div className="mb-4 rounded bg-green-50 p-3 text-sm text-green-800">
          {t('manage.settings.providerCredentials.registerSuccess')}
        </div>
      )}

      {credentials.length === 0 && (
        <p className="text-uzh-grey-600 text-sm">
          {t('manage.settings.providerCredentials.noCredentials')}
        </p>
      )}

      {actionError && (
        <p className="mb-2 text-sm text-red-600">{actionError}</p>
      )}

      <div className="flex flex-col gap-3">
        {credentials.map((credential) => (
          <div
            key={credential.id}
            className="border-uzh-grey-200 rounded border border-solid p-3"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="font-semibold">{credential.profileKey}</span>
              <span className={statusColor(credential.status)}>
                {credential.status}
              </span>
            </div>

            {credential.safeFingerprint && (
              <p className="text-uzh-grey-600 mb-1 text-xs">
                {t('manage.settings.providerCredentials.fingerprint')}:{' '}
                {credential.safeFingerprint}
              </p>
            )}
            {credential.validatedModelAlias && (
              <p className="text-uzh-grey-600 mb-1 text-xs">
                {t('manage.settings.providerCredentials.model')}:{' '}
                {credential.validatedModelAlias}
              </p>
            )}

            <div className="mt-2 flex gap-2">
              {(credential.status === 'ACTIVE' ||
                credential.status === 'PENDING_VALIDATION') && (
                <Button
                  onClick={() =>
                    handleLifecycleAction(credential.id, 'suspend')
                  }
                >
                  {t('manage.settings.providerCredentials.suspend')}
                </Button>
              )}
              {credential.status === 'SUSPENDED' && (
                <Button
                  onClick={() => handleLifecycleAction(credential.id, 'resume')}
                >
                  {t('manage.settings.providerCredentials.resume')}
                </Button>
              )}
              {(credential.status === 'ACTIVE' ||
                credential.status === 'SUSPENDED') && (
                <Button
                  onClick={() => handleLifecycleAction(credential.id, 'revoke')}
                >
                  {t('manage.settings.providerCredentials.revoke')}
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default ProviderCredentialSettings
