import * as DB from '@klicker-uzh/prisma/client'
import { getProviderProfileManifest } from '@klicker-uzh/util'
import { z } from 'zod'
import type { ContextWithUser } from '../lib/context.js'

// ---------------------------------------------------------------------------
// Fake gateway adapter
//
// The real gateway is a separately deployed app with its own Key Vault.
// This adapter proves the product-side contract without any secret custody
// in PostgreSQL. It stores values in process memory only and is replaced
// by the HTTP client in K3.
// ---------------------------------------------------------------------------

export interface ProviderCredentialGatewayAdapter {
  /** Store the initial version of a provider secret; returns the version. */
  storeSecret(input: {
    secretName: string
    secretValue: string
  }): Promise<{ version: number }>
  /** Store a new version without switching the active pointer yet. */
  stageRotation(input: {
    secretName: string
    secretValue: string
  }): Promise<{ version: number }>
  /** Mark the secret as revoked so gateway reads fail closed. */
  revokeSecret(input: { secretName: string }): Promise<void>
}

const fakeVault = new Map<string, { value: string; revoked: boolean }>()
let fakeVersionCounter = 0

function vaultKey(secretName: string, version: number): string {
  return `${secretName}:${version}`
}

export function resetFakeGateway(): void {
  fakeVault.clear()
  fakeVersionCounter = 0
}

export const FakeGatewayAdapter: ProviderCredentialGatewayAdapter = {
  async storeSecret({ secretName, secretValue }) {
    fakeVersionCounter += 1
    const version = fakeVersionCounter
    fakeVault.set(vaultKey(secretName, version), {
      value: secretValue,
      revoked: false,
    })
    return { version }
  },
  async stageRotation({ secretName, secretValue }) {
    // Staged but NOT active: the active pointer is only bumped in product state
    // after validation succeeds. A failed rotation leaves the current version intact.
    fakeVersionCounter += 1
    const version = fakeVersionCounter
    fakeVault.set(vaultKey(secretName, version), {
      value: secretValue,
      revoked: false,
    })
    return { version }
  },
  async revokeSecret({ secretName }) {
    for (const [key, entry] of fakeVault.entries()) {
      if (key.startsWith(`${secretName}:`)) {
        entry.revoked = true
      }
    }
  },
}

// ---------------------------------------------------------------------------
// Zod input schemas
// ---------------------------------------------------------------------------

const registerCredentialSchema = z.object({
  profileKey: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/),
  secret: z.string().min(8).max(4096),
})

const rotateCredentialSchema = z.object({
  credentialId: z.string().uuid(),
  secret: z.string().min(8).max(4096),
})

const bindingInputSchema = z.object({
  credentialId: z.string().uuid(),
  chatbotId: z.string().uuid(),
  allowedModelAlias: z.string().min(1),
  participantQuotaLimit: z.number().positive(),
  aggregateQuotaLimit: z.number().positive(),
})

// ---------------------------------------------------------------------------
// Safe projections returned to callers; never contain secret material.
// ---------------------------------------------------------------------------

type CredentialStatusProjection = {
  id: string
  profileKey: string
  profileVersion: number
  status: DB.ProviderCredentialStatus
  validatedModelAlias: string | null
  vaultSecretName: string
  vaultSecretVersion: number
  safeFingerprint: string | null
  bindings: Array<{
    id: string
    chatbotId: string
    allowedModelAlias: string
    isActive: boolean
    participantQuotaLimit: string
    aggregateQuotaLimit: string
    currentNoticeVersion: number
  }>
  createdAt: Date
  updatedAt: Date
}

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

async function ensureProfileRow(
  prisma: ContextWithUser['prisma'],
  profileKey: string
) {
  const manifest = getProviderProfileManifest(profileKey)
  if (!manifest) throw new Error(`Unknown provider profile: ${profileKey}`)

  const existing = await prisma.providerProfile.findUnique({
    where: { key: profileKey },
  })
  if (existing) {
    // Sync version/notice facts from the code manifest so runtime reads stay current.
    return await prisma.providerProfile.update({
      where: { id: existing.id },
      data: {
        version: manifest.version,
        noticeVersion: manifest.noticeVersion,
        isActive: true,
      },
    })
  }
  return await prisma.providerProfile.create({
    data: {
      key: manifest.key,
      version: manifest.version,
      providerKind: manifest.providerKind,
      endpointAlias: manifest.endpointAlias,
      deploymentAliases: [...manifest.deploymentAliases],
      autoManifestVersion: manifest.autoManifestVersion,
      pricingSource: manifest.pricingSource,
      currency: manifest.currency,
      noticeVersion: manifest.noticeVersion,
      isActive: true,
    },
  })
}

/** Compute a truncated display fingerprint from the raw secret material. */
function computeFingerprint(secret: string): string {
  // Simple hash-based fingerprint; never reversible to the original value.
  let hash = 0x811c9dc5
  for (let i = 0; i < secret.length; i++) {
    hash ^= secret.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return `fp_${(hash >>> 0).toString(16).padStart(8, '0')}`
}

export async function registerCredential(
  args: unknown,
  ctx: ContextWithUser,
  adapter: ProviderCredentialGatewayAdapter = FakeGatewayAdapter
): Promise<CredentialStatusProjection> {
  const parsed = registerCredentialSchema.parse(args)

  // Validate the profile exists in the platform manifest before any custody call.
  const manifest = getProviderProfileManifest(parsed.profileKey)
  if (!manifest)
    throw new Error(`Unknown provider profile: ${parsed.profileKey}`)

  const profile = await ensureProfileRow(ctx.prisma, parsed.profileKey)

  // Generate an opaque vault name; the caller never chooses it.
  const vaultSecretName = `byok/${ctx.user.sub}/${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`

  // Store the initial secret version through the gateway adapter.
  const stored = await adapter.storeSecret({
    secretName: vaultSecretName,
    secretValue: parsed.secret,
  })

  const fingerprint = computeFingerprint(parsed.secret)

  let credential
  try {
    credential = await ctx.prisma.providerCredential.create({
      data: {
        ownerId: ctx.user.sub,
        profileId: profile.id,
        vaultSecretName,
        vaultSecretVersion: stored.version,
        safeFingerprint: fingerprint,
        status: 'PENDING_VALIDATION',
      },
    })
  } catch (error) {
    // If the DB write fails, clean up the vault entry to avoid orphaned custody.
    adapter.revokeSecret({ secretName: vaultSecretName }).catch(() => {})
    throw error
  }

  await recordOutboxEvent(ctx.prisma, credential.id, 'CREDENTIAL_REGISTERED', {
    vaultSecretVersion: stored.version,
    status: credential.status,
  })

  return projectCredential(credential, profile)
}

export async function validateCredential(
  credentialId: string,
  ctx: ContextWithUser
): Promise<CredentialStatusProjection | null> {
  const credential = await ctx.prisma.providerCredential.findFirst({
    where: { id: credentialId, ownerId: ctx.user.sub },
    include: { profile: true },
  })
  if (
    !credential ||
    credential.status !== DB.ProviderCredentialStatus.PENDING_VALIDATION
  ) {
    return null
  }

  const updated = await ctx.prisma.providerCredential.update({
    where: { id: credential.id },
    data: {
      status: DB.ProviderCredentialStatus.ACTIVE,
      validatedAt: new Date(),
      validatedModelAlias: credential.profile.deploymentAliases[0] ?? null,
    },
    include: { profile: true },
  })

  await recordOutboxEvent(ctx.prisma, credential.id, 'CREDENTIAL_VALIDATED', {
    status: updated.status,
    vaultSecretVersion: updated.vaultSecretVersion,
  })

  return projectCredential(updated, updated.profile)
}

export async function suspendCredential(
  credentialId: string,
  ctx: ContextWithUser
): Promise<CredentialStatusProjection | null> {
  const credential = await ctx.prisma.providerCredential.findFirst({
    where: {
      id: credentialId,
      ownerId: ctx.user.sub,
      status: DB.ProviderCredentialStatus.ACTIVE,
    },
    include: { profile: true },
  })
  if (!credential) return null

  // Synchronously deactivate bindings so new use fails closed immediately.
  await ctx.prisma.chatbotProviderBinding.updateMany({
    where: { credentialId: credential.id, isActive: true },
    data: { isActive: false },
  })
  const updated = await ctx.prisma.providerCredential.update({
    where: { id: credential.id },
    data: { status: DB.ProviderCredentialStatus.SUSPENDED },
    include: { profile: true },
  })

  await recordOutboxEvent(ctx.prisma, credential.id, 'CREDENTIAL_SUSPENDED', {
    status: updated.status,
  })
  return projectCredential(updated, updated.profile)
}

export async function resumeCredential(
  credentialId: string,
  ctx: ContextWithUser
): Promise<CredentialStatusProjection | null> {
  const credential = await ctx.prisma.providerCredential.findFirst({
    where: {
      id: credentialId,
      ownerId: ctx.user.sub,
      status: DB.ProviderCredentialStatus.SUSPENDED,
    },
    include: { profile: true },
  })
  if (!credential) return null

  const updated = await ctx.prisma.providerCredential.update({
    where: { id: credential.id },
    data: { status: DB.ProviderCredentialStatus.ACTIVE },
    include: { profile: true },
  })
  await recordOutboxEvent(ctx.prisma, credential.id, 'CREDENTIAL_RESUMED', {
    status: updated.status,
  })
  return projectCredential(updated, updated.profile)
}

export async function revokeCredential(
  credentialId: string,
  ctx: ContextWithUser,
  adapter: ProviderCredentialGatewayAdapter = FakeGatewayAdapter
): Promise<CredentialStatusProjection | null> {
  const credential = await ctx.prisma.providerCredential.findFirst({
    where: {
      id: credentialId,
      ownerId: ctx.user.sub,
      status: { in: ['ACTIVE', 'SUSPENDED'] },
    },
    include: { profile: true },
  })
  if (!credential) return null

  // Tell the gateway to fail closed before updating product state.
  await adapter.revokeSecret({ secretName: credential.vaultSecretName })

  await ctx.prisma.chatbotProviderBinding.updateMany({
    where: { credentialId: credential.id, isActive: true },
    data: { isActive: false },
  })
  const updated = await ctx.prisma.providerCredential.update({
    where: { id: credential.id },
    data: { status: DB.ProviderCredentialStatus.REVOKED },
    include: { profile: true },
  })

  await recordOutboxEvent(ctx.prisma, credential.id, 'CREDENTIAL_REVOKED', {
    status: updated.status,
  })
  return projectCredential(updated, updated.profile)
}

export async function deleteCredential(
  credentialId: string,
  ctx: ContextWithUser,
  adapter: ProviderCredentialGatewayAdapter = FakeGatewayAdapter
): Promise<boolean> {
  const credential = await ctx.prisma.providerCredential.findFirst({
    where: {
      id: credentialId,
      ownerId: ctx.user.sub,
      status: { in: ['REVOKED', 'SUSPENDED'] },
    },
  })
  if (!credential) return false

  // Revoke at the gateway before marking DELETION_PENDING.
  await adapter.revokeSecret({ secretName: credential.vaultSecretName })

  await ctx.prisma.providerCredential.update({
    where: { id: credential.id },
    data: { status: DB.ProviderCredentialStatus.DELETION_PENDING },
  })
  await recordOutboxEvent(
    ctx.prisma,
    credential.id,
    'CREDENTIAL_DELETION_PENDING',
    {
      vaultSecretName: credential.vaultSecretName,
    }
  )
  return true
}

export async function rotateCredential(
  args: unknown,
  ctx: ContextWithUser,
  adapter: ProviderCredentialGatewayAdapter = FakeGatewayAdapter
): Promise<CredentialStatusProjection | null> {
  const parsed = rotateCredentialSchema.parse(args)

  const credential = await ctx.prisma.providerCredential.findFirst({
    where: {
      id: parsed.credentialId,
      ownerId: ctx.user.sub,
      status: DB.ProviderCredentialStatus.ACTIVE,
    },
    include: { profile: true },
  })
  if (!credential) return null

  // Stage the new version at the gateway without switching the active pointer.
  const staged = await adapter.stageRotation({
    secretName: credential.vaultSecretName,
    secretValue: parsed.secret,
  })

  // Only after successful staging, switch the active version in product state.
  const updated = await ctx.prisma.providerCredential.update({
    where: { id: credential.id },
    data: { vaultSecretVersion: staged.version },
    include: { profile: true },
  })

  await recordOutboxEvent(ctx.prisma, credential.id, 'CREDENTIAL_ROTATED', {
    previousVersion: credential.vaultSecretVersion,
    newVersion: staged.version,
  })
  return projectCredential(updated, updated.profile)
}

export async function createBinding(
  args: unknown,
  ctx: ContextWithUser
): Promise<DB.ChatbotProviderBinding | null> {
  const parsed = bindingInputSchema.parse(args)

  // Verify both the credential AND the chatbot belong to this owner.
  const [credential, chatbot] = await Promise.all([
    ctx.prisma.providerCredential.findFirst({
      where: {
        id: parsed.credentialId,
        ownerId: ctx.user.sub,
        status: DB.ProviderCredentialStatus.ACTIVE,
      },
      include: { profile: true },
    }),
    ctx.prisma.chatbot.findFirst({
      where: { id: parsed.chatbotId, ownerId: ctx.user.sub },
    }),
  ])

  if (!credential || !chatbot) return null

  // The model alias must be approved in the profile manifest.
  const manifest = getProviderProfileManifest(credential.profile.key)
  if (!manifest?.deploymentAliases.includes(parsed.allowedModelAlias)) {
    throw new Error(
      `Model alias "${parsed.allowedModelAlias}" is not approved for profile "${credential.profile.key}"`
    )
  }

  const binding = await ctx.prisma.chatbotProviderBinding.create({
    data: {
      credentialId: credential.id,
      chatbotId: chatbot.id,
      ownerId: ctx.user.sub,
      allowedModelAlias: parsed.allowedModelAlias,
      isActive: false,
      participantQuotaLimit: parsed.participantQuotaLimit,
      aggregateQuotaLimit: parsed.aggregateQuotaLimit,
      currentNoticeVersion: credential.profile.noticeVersion,
    },
  })

  await recordOutboxEvent(ctx.prisma, credential.id, 'BINDING_CREATED', {
    bindingId: binding.id,
    chatbotId: chatbot.id,
  })

  return binding
}

export async function activateBinding(
  bindingId: string,
  ctx: ContextWithUser
): Promise<DB.ChatbotProviderBinding | null> {
  const binding = await ctx.prisma.chatbotProviderBinding.findFirst({
    where: { id: bindingId, ownerId: ctx.user.sub, isActive: false },
    include: { credential: true },
  })
  if (
    !binding ||
    binding.credential.status !== DB.ProviderCredentialStatus.ACTIVE
  ) {
    return null
  }
  return await ctx.prisma.chatbotProviderBinding.update({
    where: { id: binding.id },
    data: { isActive: true },
  })
}

export async function deactivateBinding(
  bindingId: string,
  ctx: ContextWithUser
): Promise<DB.ChatbotProviderBinding | null> {
  const binding = await ctx.prisma.chatbotProviderBinding.findFirst({
    where: { id: bindingId, ownerId: ctx.user.sub, isActive: true },
  })
  if (!binding) return null
  return await ctx.prisma.chatbotProviderBinding.update({
    where: { id: binding.id },
    data: { isActive: false },
  })
}

export async function getOwnerCredentials(
  ctx: ContextWithUser
): Promise<CredentialStatusProjection[]> {
  const credentials = await ctx.prisma.providerCredential.findMany({
    where: { ownerId: ctx.user.sub },
    include: {
      profile: true,
      bindings: {
        select: {
          id: true,
          chatbotId: true,
          allowedModelAlias: true,
          isActive: true,
          participantQuotaLimit: true,
          aggregateQuotaLimit: true,
          currentNoticeVersion: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })
  return credentials.map((c) => projectCredential(c, c.profile))
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function recordOutboxEvent(
  prisma: ContextWithUser['prisma'],
  credentialId: string,
  eventType: string,
  payload: Record<string, unknown>
): Promise<void> {
  await prisma.providerCredentialOutbox.create({
    data: {
      credentialId,
      eventType,
      payload: payload as DB.Prisma.InputJsonValue,
    },
  })
}

type CredentialWithProfile = DB.ProviderCredential & {
  profile: DB.ProviderProfile
  bindings?: Array<{
    id: string
    chatbotId: string
    allowedModelAlias: string
    isActive: boolean
    participantQuotaLimit: DB.Prisma.Decimal
    aggregateQuotaLimit: DB.Prisma.Decimal
    currentNoticeVersion: number
  }>
}

function projectCredential(
  credential: CredentialWithProfile | DB.ProviderCredential,
  profile: DB.ProviderProfile
): CredentialStatusProjection {
  const bindings = ((credential as CredentialWithProfile).bindings ??
    []) as Array<{
    id: string
    chatbotId: string
    allowedModelAlias: string
    isActive: boolean
    participantQuotaLimit: DB.Prisma.Decimal
    aggregateQuotaLimit: DB.Prisma.Decimal
    currentNoticeVersion: number
  }>
  return {
    id: credential.id,
    profileKey: profile.key,
    profileVersion: profile.version,
    status: credential.status,
    validatedModelAlias: credential.validatedModelAlias,
    vaultSecretName: credential.vaultSecretName,
    vaultSecretVersion: credential.vaultSecretVersion,
    safeFingerprint: credential.safeFingerprint,
    bindings: bindings.map((b) => ({
      id: b.id,
      chatbotId: b.chatbotId,
      allowedModelAlias: b.allowedModelAlias,
      isActive: b.isActive,
      participantQuotaLimit: String(b.participantQuotaLimit),
      aggregateQuotaLimit: String(b.aggregateQuotaLimit),
      currentNoticeVersion: b.currentNoticeVersion,
    })),
    createdAt: credential.createdAt,
    updatedAt: credential.updatedAt,
  }
}
