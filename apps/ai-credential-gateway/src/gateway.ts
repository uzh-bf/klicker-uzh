/**
 * AI Credential Gateway — standalone internal service.
 *
 * This gateway is the only component that reads provider secret values from
 * the tenant vault. It has NO database access, accepts only product-issued
 * opaque capabilities and static profile aliases, and refuses any caller-
 * supplied endpoint, handle, fallback, or model configuration.
 */

import { getProviderProfileManifest } from '@klicker-uzh/util'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Opaque bearer token issued by the product; carries no vault data. */
export interface CapabilityBearer {
  token: string
}

/** The full scope stored server-side by the product for one capability. */
export interface CapabilityScope {
  tokenId: string
  ownerId: string
  bindingId: string
  profileKey: string
  allowedModelAlias: string
  vaultSecretVersion: number
  expiresAtMs: number
}

/** What a consume endpoint returns to the gateway after scope verification. */
export type ConsumeResult =
  | { ok: true; scope: CapabilityScope }
  | { ok: false; reason: string }

/** Vault adapter contract. */
export interface VaultAdapter {
  storeSecret(input: {
    secretName: string
    secretValue: string
  }): Promise<{ version: number }>
  stageRotation(input: {
    secretName: string
    secretValue: string
  }): Promise<{ version: number }>
  revokeSecret(input: { secretName: string }): Promise<void>
  readActive(input: {
    secretName: string
  }): Promise<{ version: number; value: string }>
  activateVersion(input: { secretName: string; version: number }): Promise<void>
  deleteSecret(input: { secretName: string }): Promise<void>
}

/** Provider adapter contract. */
export interface ProviderAdapter {
  validateCapability(input: {
    endpointAlias: string
  }): Promise<{ valid: boolean }>
  forwardRequest(input: {
    endpointAlias: string
    credential: string
    modelAlias: string
    body: unknown
    traceContext?: Record<string, string>
  }): Promise<Response>
}

// ---------------------------------------------------------------------------
// Fake adapters (K3 proof-of-contract; replaced by KeyVault/HTTP clients)
// ---------------------------------------------------------------------------

const activePointers = new Map<string, number>()
const fakeVaultStore = new Map<string, { value: string; revoked: boolean }>()
let fakeVersionCounter = 0

function vaultKey(secretName: string, version: number): string {
  return secretName + ':' + version
}

export function resetFakeVault(): void {
  fakeVaultStore.clear()
  activePointers.clear()
  fakeVersionCounter = 0
}

export const FakeVaultAdapter: VaultAdapter = {
  async storeSecret({ secretName, secretValue }) {
    fakeVersionCounter += 1
    const version = fakeVersionCounter
    fakeVaultStore.set(vaultKey(secretName, version), {
      value: secretValue,
      revoked: false,
    })
    if (!activePointers.has(secretName)) {
      activePointers.set(secretName, version)
    }
    return { version }
  },
  async stageRotation({ secretName, secretValue }) {
    // Staged but not yet active; caller switches after validation succeeds.
    fakeVersionCounter += 1
    const version = fakeVersionCounter
    fakeVaultStore.set(vaultKey(secretName, version), {
      value: secretValue,
      revoked: false,
    })
    return { version }
  },
  async revokeSecret({ secretName }) {
    for (const [key, entry] of fakeVaultStore) {
      if (key.startsWith(secretName + ':')) entry.revoked = true
    }
  },
  async readActive({ secretName }) {
    const activePtr = activePointers.get(secretName)
    if (!activePtr) throw new Error('No active secret version found')
    const key = vaultKey(secretName, activePtr)
    const entry = fakeVaultStore.get(key)
    if (!entry || entry.revoked)
      throw new Error('No active secret version found')
    return { version: activePtr, value: entry.value }
  },
  async activateVersion(input: { secretName: string; version: number }) {
    const key = vaultKey(input.secretName, input.version)
    if (!fakeVaultStore.has(key)) throw new Error('Version not found in vault')
    activePointers.set(input.secretName, input.version)
  },
  async deleteSecret({ secretName }) {
    for (const key of [...fakeVaultStore.keys()]) {
      if (key.startsWith(secretName + ':')) fakeVaultStore.delete(key)
    }
    activePointers.delete(secretName)
  },
}

export const FakeProviderAdapter: ProviderAdapter = {
  async validateCapability() {
    return { valid: true }
  },
  async forwardRequest({ endpointAlias, credential, modelAlias, body }) {
    void endpointAlias
    void credential
    void modelAlias
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  },
}

// ---------------------------------------------------------------------------
// Gateway operations
// ---------------------------------------------------------------------------

export interface RegisterInput {
  profileKey: string
  secretValue: string
  vaultSecretName: string
}

export interface GatewayRegisterResult {
  version: number
  fingerprint: string
}

export interface RotationResult {
  stagedVersion: number
}

export async function registerSecret(
  input: RegisterInput,
  vault: VaultAdapter
): Promise<GatewayRegisterResult> {
  if (!input.vaultSecretName || !input.secretValue) {
    throw new Error('vaultSecretName and secretValue are required')
  }
  const manifest = getProviderProfileManifest(input.profileKey)
  if (!manifest) throw new Error('Unknown profile: ' + input.profileKey)

  const stored = await vault.storeSecret({
    secretName: input.vaultSecretName,
    secretValue: input.secretValue,
  })

  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(input.secretValue)
  )
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  const fingerprint = 'fp_' + hex.slice(0, 16)

  return { version: stored.version, fingerprint }
}

export async function rotateSecret(
  input: { vaultSecretName: string; secretValue: string },
  vault: VaultAdapter
): Promise<RotationResult> {
  const staged = await vault.stageRotation({
    secretName: input.vaultSecretName,
    secretValue: input.secretValue,
  })
  return { stagedVersion: staged.version }
}

export async function revokeSecret(
  input: { vaultSecretName: string },
  vault: VaultAdapter
): Promise<void> {
  await vault.revokeSecret({ secretName: input.vaultSecretName })
}

export async function deleteSecret(
  input: { vaultSecretName: string },
  vault: VaultAdapter
): Promise<void> {
  await vault.deleteSecret({ secretName: input.vaultSecretName })
}

export interface ForwardInput {
  capabilityToken: string
  requestBody: unknown
  traceContext?: Record<string, string>
}

export interface ForwardDeps {
  vault: VaultAdapter
  provider: ProviderAdapter
  consumeCapability: (token: string) => Promise<ConsumeResult>
  resolveVaultName?: (scope: CapabilityScope) => string
}

export async function authorizeAndForward(
  input: ForwardInput,
  deps: ForwardDeps
): Promise<Response> {
  const consumed = await deps.consumeCapability(input.capabilityToken)
  if (!consumed.ok) {
    return new Response(
      JSON.stringify({
        error: 'Authorization failed',
        detail: consumed.reason,
      }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    )
  }
  const scope = consumed.scope
  if (Date.now() >= scope.expiresAtMs) {
    return new Response(JSON.stringify({ error: 'Capability expired' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  const manifest = getProviderProfileManifest(scope.profileKey)
  if (!manifest) {
    return new Response(JSON.stringify({ error: 'Unknown profile' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  if (scope.allowedModelAlias !== manifest.deploymentAliases[0]) {
    return new Response(JSON.stringify({ error: 'Model not approved' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  let credential = ''
  try {
    const vaultName = deps.resolveVaultName
      ? deps.resolveVaultName(scope)
      : 'byok/' + scope.ownerId + '/credential'
    const active = await deps.vault.readActive({ secretName: vaultName })
    credential = active.value
    if (active.version !== scope.vaultSecretVersion) {
      return new Response(
        JSON.stringify({ error: 'Credential version mismatch' }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      )
    }
  } catch {
    return new Response(JSON.stringify({ error: 'Vault read failed' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  try {
    const response = await deps.provider.forwardRequest({
      endpointAlias: manifest.endpointAlias,
      credential,
      modelAlias: scope.allowedModelAlias,
      body: input.requestBody,
      traceContext: input.traceContext,
    })
    credential = ''
    void credential
    return response
  } catch {
    return new Response(JSON.stringify({ error: 'Upstream unavailable' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
