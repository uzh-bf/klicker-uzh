import * as DB from '@klicker-uzh/prisma/client'
import builder from '../builder.js'

export const ProviderCredentialStatusType = builder.enumType(
  'ProviderCredentialStatus',
  {
    values: Object.values(DB.ProviderCredentialStatus),
  }
)

export interface IProviderCredentialBindingProjection {
  id: string
  chatbotId: string
  allowedModelAlias: string
  isActive: boolean
  participantQuotaLimit: string
  aggregateQuotaLimit: string
  currentNoticeVersion: number
}

export const ProviderCredentialBindingProjection =
  builder.objectRef<IProviderCredentialBindingProjection>(
    'ProviderCredentialBindingProjection'
  )
export const ProviderCredentialBindingProjectionImpl =
  ProviderCredentialBindingProjection.implement({
    fields: (t) => ({
      id: t.exposeID('id'),
      chatbotId: t.exposeString('chatbotId'),
      allowedModelAlias: t.exposeString('allowedModelAlias'),
      isActive: t.exposeBoolean('isActive'),
      participantQuotaLimit: t.exposeString('participantQuotaLimit'),
      aggregateQuotaLimit: t.exposeString('aggregateQuotaLimit'),
      currentNoticeVersion: t.exposeInt('currentNoticeVersion'),
    }),
  })

export interface IProviderCredentialProjection {
  id: string
  profileKey: string
  profileVersion: number
  status: DB.ProviderCredentialStatus
  validatedModelAlias: string | null
  vaultSecretName: string
  vaultSecretVersion: number
  safeFingerprint: string | null
  bindings: IProviderCredentialBindingProjection[]
  createdAt: Date
  updatedAt: Date
}

export const ProviderCredentialProjection =
  builder.objectRef<IProviderCredentialProjection>(
    'ProviderCredentialProjection'
  )
export const ProviderCredentialProjectionImpl =
  ProviderCredentialProjection.implement({
    fields: (t) => ({
      id: t.exposeID('id'),
      profileKey: t.exposeString('profileKey'),
      profileVersion: t.exposeInt('profileVersion'),
      status: t.expose('status', { type: ProviderCredentialStatusType }),
      validatedModelAlias: t.exposeString('validatedModelAlias', {
        nullable: true,
      }),
      // Vault handle is opaque metadata; never a secret value.
      vaultSecretName: t.exposeString('vaultSecretName'),
      vaultSecretVersion: t.exposeInt('vaultSecretVersion'),
      safeFingerprint: t.exposeString('safeFingerprint', { nullable: true }),
      bindings: t.field({
        type: [ProviderCredentialBindingProjection],
        resolve: (credential) => credential.bindings,
      }),
      createdAt: t.expose('createdAt', { type: 'Date' }),
      updatedAt: t.expose('updatedAt', { type: 'Date' }),
    }),
  })
