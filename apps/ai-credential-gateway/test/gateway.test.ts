import { describe, expect, test, beforeEach } from 'vitest'
import {
  FakeVaultAdapter,
  FakeProviderAdapter,
  resetFakeVault,
  registerSecret,
  rotateSecret,
  revokeSecret,
  deleteSecret,
  authorizeAndForward,
} from '../src/gateway.js'

function makeConsumeEndpoint() {
  const consumed = new Set<string>()
  return function consumeCapability(token: string) {
    if (consumed.has(token)) {
      return Promise.resolve({ ok: false as const, reason: 'Replay detected' })
    }
    if (token === 'valid-capability-token') {
      consumed.add(token)
      return Promise.resolve({
        ok: true as const,
        scope: {
          tokenId: 'tok_1',
          ownerId: 'user-1',
          bindingId: 'binding-1',
          profileKey: 'uzh-azure-openai',
          allowedModelAlias: 'gpt-5.6-luna',
          vaultSecretVersion: 1,
          expiresAtMs: Date.now() + 30000,
        },
      })
    }
    return Promise.resolve({ ok: false as const, reason: 'Unknown token' })
  }
}

describe('AI Credential Gateway', () => {
  beforeEach(() => {
    resetFakeVault()
  })

  test('register stores secret without DB dependency', async () => {
    const result = await registerSecret(
      {
        profileKey: 'uzh-azure-openai',
        secretValue: 'test-secret-value-1',
        vaultSecretName: 'byok/user-1/abc123',
      },
      FakeVaultAdapter
    )
    expect(result.version).toBe(1)
    expect(result.fingerprint).toMatch(/^fp_/)
  })

  test('register rejects unknown profile keys', async () => {
    await expect(
      registerSecret(
        {
          profileKey: 'nonexistent',
          secretValue: 's3cret',
          vaultSecretName: 'n',
        },
        FakeVaultAdapter
      )
    ).rejects.toThrow(/Unknown profile/)
  })

  test('rotate stages new version without switching active pointer', async () => {
    await registerSecret(
      {
        profileKey: 'uzh-azure-openai',
        secretValue: 'original-secret',
        vaultSecretName: 'byok/user-1/test',
      },
      FakeVaultAdapter
    )
    const staged = await rotateSecret(
      { vaultSecretName: 'byok/user-1/test', secretValue: 'rotated-secret' },
      FakeVaultAdapter
    )
    expect(staged.stagedVersion).toBe(2)
    const active = await FakeVaultAdapter.readActive({
      secretName: 'byok/user-1/test',
    })
    expect(active.version).toBe(1)
    expect(active.value).toBe('original-secret')
  })

  test('revoke makes all versions fail closed', async () => {
    await registerSecret(
      {
        profileKey: 'uzh-azure-openai',
        secretValue: 'test-secret',
        vaultSecretName: 'byok/u/rv',
      },
      FakeVaultAdapter
    )
    await revokeSecret({ vaultSecretName: 'byok/u/rv' }, FakeVaultAdapter)
    await expect(
      FakeVaultAdapter.readActive({ secretName: 'byok/u/rv' })
    ).rejects.toThrow(/No active secret version found/)
  })

  test('delete removes all versions permanently', async () => {
    await registerSecret(
      {
        profileKey: 'uzh-azure-openai',
        secretValue: 'test-secret',
        vaultSecretName: 'byok/u/del',
      },
      FakeVaultAdapter
    )
    await deleteSecret({ vaultSecretName: 'byok/u/del' }, FakeVaultAdapter)
    await expect(
      FakeVaultAdapter.readActive({ secretName: 'byok/u/del' })
    ).rejects.toThrow(/No active secret version found/)
  })

  test('authorizeAndForward happy path returns provider response', async () => {
    await registerSecret(
      {
        profileKey: 'uzh-azure-openai',
        secretValue: 'real-secret-value',
        vaultSecretName: 'byok/user-1/credential',
      },
      FakeVaultAdapter
    )
    const response = await authorizeAndForward(
      {
        capabilityToken: 'valid-capability-token',
        requestBody: { prompt: 'hello' },
      },
      {
        vault: FakeVaultAdapter,
        provider: FakeProviderAdapter,
        consumeCapability: makeConsumeEndpoint(),
        resolveVaultName: (scope) => 'byok/' + scope.ownerId + '/credential',
      }
    )
    expect(response.status).toBe(200)
  })

  test('replay of same capability token fails closed', async () => {
    await registerSecret(
      {
        profileKey: 'uzh-azure-openai',
        secretValue: 'secret-val',
        vaultSecretName: 'byok/user-1/credential',
      },
      FakeVaultAdapter
    )
    const consumer = makeConsumeEndpoint()
    const opts = {
      vault: FakeVaultAdapter,
      provider: FakeProviderAdapter,
      consumeCapability: consumer,
      resolveVaultName: (scope: { ownerId: string }) =>
        'byok/' + scope.ownerId + '/credential',
    }
    const first = await authorizeAndForward(
      { capabilityToken: 'valid-capability-token', requestBody: {} },
      opts
    )
    expect(first.status).toBe(200)
    const second = await authorizeAndForward(
      { capabilityToken: 'valid-capability-token', requestBody: {} },
      opts
    )
    expect(second.status).toBe(403)
  })

  test('unknown token fails closed without reading the vault', async () => {
    const response = await authorizeAndForward(
      { capabilityToken: 'bad-token', requestBody: {} },
      {
        vault: FakeVaultAdapter,
        provider: FakeProviderAdapter,
        consumeCapability: makeConsumeEndpoint(),
        resolveVaultName: (scope) => 'byok/' + scope.ownerId + '/credential',
      }
    )
    expect(response.status).toBe(403)
  })

  test('expired capability fails closed', async () => {
    await registerSecret(
      {
        profileKey: 'uzh-azure-openai',
        secretValue: 'secret-val',
        vaultSecretName: 'byok/user-1/credential',
      },
      FakeVaultAdapter
    )
    const expiredConsumer = function () {
      return Promise.resolve({
        ok: true as const,
        scope: {
          tokenId: 'tok_x',
          ownerId: 'user-1',
          bindingId: 'b1',
          profileKey: 'uzh-azure-openai',
          allowedModelAlias: 'gpt-5.6-luna',
          vaultSecretVersion: 1,
          expiresAtMs: Date.now() - 1000,
        },
      })
    }
    const response = await authorizeAndForward(
      { capabilityToken: 'any-token', requestBody: {} },
      {
        vault: FakeVaultAdapter,
        provider: FakeProviderAdapter,
        consumeCapability: expiredConsumer,
        resolveVaultName: (s) => 'byok/' + s.ownerId + '/credential',
      }
    )
    expect(response.status).toBe(403)
  })

  test('model not in manifest is rejected', async () => {
    await registerSecret(
      {
        profileKey: 'uzh-azure-openai',
        secretValue: 'secret-val',
        vaultSecretName: 'byok/user-1/credential',
      },
      FakeVaultAdapter
    )
    const badModelConsumer = function () {
      return Promise.resolve({
        ok: true as const,
        scope: {
          tokenId: 'tok_bad',
          ownerId: 'user-1',
          bindingId: 'b1',
          profileKey: 'uzh-azure-openai',
          allowedModelAlias: 'not-approved-model',
          vaultSecretVersion: 1,
          expiresAtMs: Date.now() + 30000,
        },
      })
    }
    const response = await authorizeAndForward(
      { capabilityToken: 'any-token', requestBody: {} },
      {
        vault: FakeVaultAdapter,
        provider: FakeProviderAdapter,
        consumeCapability: badModelConsumer,
        resolveVaultName: (s) => 'byok/' + s.ownerId + '/credential',
      }
    )
    expect(response.status).toBe(403)
  })

  test('staged-but-not-activated rotation still serves the old active version', async () => {
    await registerSecret(
      {
        profileKey: 'uzh-azure-openai',
        secretValue: 'v1-secret',
        vaultSecretName: 'byok/user-1/credential',
      },
      FakeVaultAdapter
    )
    await rotateSecret(
      { vaultSecretName: 'byok/user-1/credential', secretValue: 'v2-secret' },
      FakeVaultAdapter
    )
    // Scope references v1; the active pointer is still on v1 after staging only.
    const consumer = function () {
      return Promise.resolve({
        ok: true as const,
        scope: {
          tokenId: 'tok_stale',
          ownerId: 'user-1',
          bindingId: 'b1',
          profileKey: 'uzh-azure-openai',
          allowedModelAlias: 'gpt-5.6-luna',
          vaultSecretVersion: 1,
          expiresAtMs: Date.now() + 30000,
        },
      })
    }
    const response = await authorizeAndForward(
      { capabilityToken: 'any-token', requestBody: {} },
      {
        vault: FakeVaultAdapter,
        provider: FakeProviderAdapter,
        consumeCapability: consumer,
        resolveVaultName: (s) => 'byok/' + s.ownerId + '/credential',
      }
    )
    expect(response.status).toBe(200)
  })

  test('activated new version causes stale scope to fail with 409', async () => {
    await registerSecret(
      {
        profileKey: 'uzh-azure-openai',
        secretValue: 'v1-secret',
        vaultSecretName: 'byok/user-1/credential',
      },
      FakeVaultAdapter
    )
    await rotateSecret(
      { vaultSecretName: 'byok/user-1/credential', secretValue: 'v2-secret' },
      FakeVaultAdapter
    )
    // Activate the new version at the vault level.
    await FakeVaultAdapter.activateVersion({
      secretName: 'byok/user-1/credential',
      version: 2,
    })
    // Scope still references v1 but active is now v2.
    const consumer = function () {
      return Promise.resolve({
        ok: true as const,
        scope: {
          tokenId: 'tok_v1',
          ownerId: 'user-1',
          bindingId: 'b1',
          profileKey: 'uzh-azure-openai',
          allowedModelAlias: 'gpt-5.6-luna',
          vaultSecretVersion: 1,
          expiresAtMs: Date.now() + 30000,
        },
      })
    }
    const response = await authorizeAndForward(
      { capabilityToken: 'any-token', requestBody: {} },
      {
        vault: FakeVaultAdapter,
        provider: FakeProviderAdapter,
        consumeCapability: consumer,
        resolveVaultName: (s) => 'byok/' + s.ownerId + '/credential',
      }
    )
    expect(response.status).toBe(409)
  })
})
