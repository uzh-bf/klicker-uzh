import { describe, expect, it } from 'vitest'
import {
  getDefaultKBGraphDomainCatalog,
  isKBGraphDomainCapabilityEnabled,
  KB_GRAPH_DOMAIN_CATALOG_REVISION_ENV,
  type KBGraphDomainCatalog,
  resolveKBGraphDomainSelection,
} from '../src/domainCatalog.js'

const CATALOG: KBGraphDomainCatalog = {
  revision: 'catalog-revision-1',
  digest: 'catalog-digest-1',
  policies: [
    {
      id: 'finance',
      version: 1,
      labelKey: 'finance',
      languages: [
        {
          language: 'German',
          policyDigest: 'policy-digest-1',
          categories: [{ name: 'Markets', definition: '...' }],
        },
        {
          language: 'English',
          policyDigest: 'policy-digest-2',
          categories: [{ name: 'Markets', definition: '...' }],
        },
      ],
    },
    {
      id: 'finance',
      version: 2,
      labelKey: 'finance',
      languages: [
        {
          language: 'English',
          policyDigest: 'policy-digest-3',
          categories: [{ name: 'Markets', definition: '...' }],
        },
      ],
    },
  ],
}

const enabled = { catalog: CATALOG, capabilityEnabled: true }

describe('KB graph domain selection', () => {
  it('treats a fully absent request as the legacy path', () => {
    expect(resolveKBGraphDomainSelection({}, enabled)).toEqual({
      ok: true,
      selection: null,
    })
    expect(
      resolveKBGraphDomainSelection(
        {
          domainPolicyId: null,
          domainPolicyVersion: null,
          language: undefined,
        },
        enabled
      )
    ).toEqual({ ok: true, selection: null })
  })

  it('rejects a supplied empty string instead of collapsing it to legacy', () => {
    // Presence is about having supplied a value; two empty strings are supplied
    // but incomplete inputs, not an omitted request.
    expect(
      resolveKBGraphDomainSelection(
        { domainPolicyId: '', domainPolicyVersion: null, language: '  ' },
        enabled
      )
    ).toEqual({ ok: false, reason: 'INCOMPLETE' })
    expect(
      resolveKBGraphDomainSelection(
        { domainPolicyId: '', domainPolicyVersion: 1, language: 'German' },
        enabled
      )
    ).toEqual({ ok: false, reason: 'UNKNOWN_POLICY' })
    expect(
      resolveKBGraphDomainSelection(
        { domainPolicyId: 'finance', domainPolicyVersion: 1, language: '' },
        enabled
      )
    ).toEqual({ ok: false, reason: 'UNSUPPORTED_LANGUAGE' })
  })

  it('rejects a partial selection before any catalog lookup', () => {
    expect(
      resolveKBGraphDomainSelection(
        { domainPolicyId: 'finance', domainPolicyVersion: null },
        enabled
      )
    ).toEqual({ ok: false, reason: 'INCOMPLETE' })
    expect(
      resolveKBGraphDomainSelection(
        { domainPolicyId: 'finance', domainPolicyVersion: 1 },
        { catalog: null, capabilityEnabled: true }
      )
    ).toEqual({ ok: false, reason: 'INCOMPLETE' })
  })

  it('requires the capability gate and a catalog for an explicit selection', () => {
    expect(
      resolveKBGraphDomainSelection(
        {
          domainPolicyId: 'finance',
          domainPolicyVersion: 1,
          language: 'German',
        },
        { catalog: CATALOG, capabilityEnabled: false }
      )
    ).toEqual({ ok: false, reason: 'CAPABILITY_DISABLED' })
    expect(
      resolveKBGraphDomainSelection(
        {
          domainPolicyId: 'finance',
          domainPolicyVersion: 1,
          language: 'German',
        },
        { catalog: null, capabilityEnabled: true }
      )
    ).toEqual({ ok: false, reason: 'CAPABILITY_DISABLED' })
  })

  it('matches a retained policy by id and version together', () => {
    expect(
      resolveKBGraphDomainSelection(
        {
          domainPolicyId: 'finance',
          domainPolicyVersion: 2,
          language: 'English',
        },
        enabled
      )
    ).toEqual({
      ok: true,
      selection: {
        domainPolicyId: 'finance',
        domainPolicyVersion: 2,
        language: 'English',
        categories: [{ name: 'Markets', definition: '...' }],
      },
    })
    // A retained id with an unretained version is a version problem, while an
    // id the catalog never described is an unknown policy.
    expect(
      resolveKBGraphDomainSelection(
        {
          domainPolicyId: 'finance',
          domainPolicyVersion: 3,
          language: 'English',
        },
        enabled
      )
    ).toEqual({ ok: false, reason: 'UNSUPPORTED_VERSION' })
    expect(
      resolveKBGraphDomainSelection(
        {
          domainPolicyId: 'physics',
          domainPolicyVersion: 1,
          language: 'English',
        },
        enabled
      )
    ).toEqual({ ok: false, reason: 'UNKNOWN_POLICY' })
    // Only version 1 offers German in this synthetic catalog.
    expect(
      resolveKBGraphDomainSelection(
        {
          domainPolicyId: 'finance',
          domainPolicyVersion: 2,
          language: 'German',
        },
        enabled
      )
    ).toEqual({ ok: false, reason: 'UNSUPPORTED_LANGUAGE' })
  })

  it('rejects a version that is not a positive integer', () => {
    for (const version of [0, -1, 1.5]) {
      expect(
        resolveKBGraphDomainSelection(
          {
            domainPolicyId: 'finance',
            domainPolicyVersion: version,
            language: 'German',
          },
          enabled
        )
      ).toEqual({ ok: false, reason: 'UNSUPPORTED_VERSION' })
    }
  })
})

describe('KB graph domain capability gate', () => {
  it('is off unless the environment matches the shipped catalog revision', () => {
    expect(isKBGraphDomainCapabilityEnabled('revision-1', {})).toBe(false)
    expect(
      isKBGraphDomainCapabilityEnabled('revision-1', {
        [KB_GRAPH_DOMAIN_CATALOG_REVISION_ENV]: '',
      })
    ).toBe(false)
    expect(
      isKBGraphDomainCapabilityEnabled('revision-1', {
        [KB_GRAPH_DOMAIN_CATALOG_REVISION_ENV]: '   ',
      })
    ).toBe(false)
    expect(
      isKBGraphDomainCapabilityEnabled('revision-1', {
        [KB_GRAPH_DOMAIN_CATALOG_REVISION_ENV]: 'revision-2',
      })
    ).toBe(false)
    expect(
      isKBGraphDomainCapabilityEnabled('revision-1', {
        [KB_GRAPH_DOMAIN_CATALOG_REVISION_ENV]: 'revision-1',
      })
    ).toBe(true)
  })
})

describe('shipped KB graph domain catalog export', () => {
  it('exposes six version-1 policies with both languages and their categories', () => {
    const catalog = getDefaultKBGraphDomainCatalog()

    expect(catalog.policies.map((policy) => policy.id)).toEqual([
      'finance',
      'economics',
      'business',
      'mathematics',
      'informatics',
      'general-academic',
    ])
    expect(catalog.revision.length).toBeGreaterThan(0)
    expect(catalog.digest.length).toBeGreaterThan(0)
    for (const policy of catalog.policies) {
      expect(policy.version).toBe(1)
      // The label key is the stable i18n identity of the policy, not its prose.
      expect(policy.labelKey).toBe(policy.id)
      expect(policy.languages.map((language) => language.language)).toEqual([
        'German',
        'English',
      ])
      for (const language of policy.languages) {
        expect(language.policyDigest.length).toBeGreaterThan(0)
        expect(language.categories.length).toBeGreaterThan(0)
        for (const category of language.categories) {
          expect(category.name.length).toBeGreaterThan(0)
          expect(category.definition.length).toBeGreaterThan(0)
        }
      }
    }
  })
})
