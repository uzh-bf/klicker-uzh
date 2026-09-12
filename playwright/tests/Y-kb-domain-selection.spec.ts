import { mkdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import type { Page } from '@playwright/test'
import deMessages from '../../packages/i18n/messages/de.js'
import enMessages from '../../packages/i18n/messages/en.js'
import { URL_MANAGE } from '../util/constants.js'
import { expect, test } from '../util/fixtures.js'

type SyntheticCategory = { name: string; definition: string }

type SyntheticDomainOption = {
  id: string
  version: number
  labelKey: string
  languages: Array<{ language: string; categories: SyntheticCategory[] }>
}

// Contract domains. The panel resolves each labelKey to the interface language,
// so every assertion below stays on ids, versions and the submitted protocol.
const DOMAIN_IDS = [
  'finance',
  'economics',
  'business',
  'mathematics',
  'informatics',
  'general-academic',
] as const

// The catalog label key is the domain id, so the expected interface text is read
// from the shipped messages instead of restating product copy in the spec.
const DOMAIN_MESSAGE_KEYS: Record<string, string> = {
  finance: 'graphDomainFinance',
  economics: 'graphDomainEconomics',
  business: 'graphDomainBusiness',
  mathematics: 'graphDomainMathematics',
  informatics: 'graphDomainInformatics',
  'general-academic': 'graphDomainGeneralAcademic',
}

type MessageCatalog = { kb: Record<string, string> }

function domainLabels(messages: MessageCatalog): Record<string, string> {
  return Object.fromEntries(
    DOMAIN_IDS.map((id) => [id, messages.kb[DOMAIN_MESSAGE_KEYS[id]]])
  )
}

const EN_DOMAIN_LABELS = domainLabels(enMessages as unknown as MessageCatalog)
const DE_DOMAIN_LABELS = domainLabels(deMessages as unknown as MessageCatalog)

// Synthetic German node types used as catalog input.
const GERMAN_CATEGORIES: Record<string, Array<[string, string]>> = {
  finance: [
    ['Finanzierung', 'Kapitalstruktur und Finanzierungsentscheide.'],
    ['Anlageformen', 'Portefeuillewahl und Bewertung.'],
  ],
  economics: [
    ['Märkte', 'Angebot, Nachfrage und Preisbildung.'],
    ['Konjunktur', 'Wachstum, Inflation und Beschäftigung.'],
  ],
  business: [
    ['Bilanzierung', 'Rechnungslegung und Buchhaltung.'],
    ['Absatz', 'Kundenwert und Marktbearbeitung.'],
  ],
  mathematics: [
    ['Vektorräume', 'Vektorräume und lineare Abbildungen.'],
    ['Wahrscheinlichkeit', 'Zufallsvariablen und Verteilungen.'],
  ],
  informatics: [
    ['Algorithmen', 'Korrektheit und Komplexität von Verfahren.'],
    ['Datenbanken', 'Relationale Modellierung und Abfragen.'],
  ],
  'general-academic': [
    ['Forschungsmethoden', 'Planung und Auswertung von Studien.'],
    ['Literaturarbeit', 'Strukturierung wissenschaftlicher Texte.'],
  ],
}

const BUSINESS_CATEGORIES = GERMAN_CATEGORIES.business.map(([name]) => name)
const ECONOMICS_CATEGORIES = GERMAN_CATEGORIES.economics.map(([name]) => name)

function syntheticDomainOption(
  id: string,
  version = 1,
  language = 'German'
): SyntheticDomainOption {
  return {
    id,
    version,
    labelKey: id,
    languages: [
      {
        language,
        categories: (GERMAN_CATEGORIES[id] ?? []).map(([name, definition]) => ({
          name,
          definition,
        })),
      },
    ],
  }
}

function domainCatalog(ids: readonly string[]): SyntheticDomainOption[] {
  return ids.map((id) => syntheticDomainOption(id))
}

function domainCategoriesFor(id: string): SyntheticCategory[] {
  return (GERMAN_CATEGORIES[id] ?? []).map(([name, definition]) => ({
    name,
    definition,
  }))
}

type DomainMockState = {
  capabilityEnabled: boolean
  options: SyntheticDomainOption[]
  config: Record<string, unknown>
  rebuildVariables: Array<Record<string, unknown>>
  rebuildGate?: Promise<void>
}

function graphConfig(overrides: Record<string, unknown> = {}) {
  return {
    __typename: 'KBKnowledgeGraphConfig',
    kbId: 'synthetic-kb',
    isEnabled: true,
    buildId: null,
    status: null,
    statusMessage: null,
    qualityTier: 'STANDARD',
    domainPolicyId: null,
    domainPolicyVersion: null,
    domainPolicyLanguage: null,
    publishedDomainPolicyId: null,
    publishedDomainPolicyVersion: null,
    publishedDomainPolicyLanguage: null,
    domainCategories: null,
    sourceContentDigest: null,
    activeBuildId: null,
    publishedBuildId: null,
    elementGenerationReady: false,
    isStale: false,
    startedAt: null,
    finishedAt: null,
    createdAt: null,
    updatedAt: null,
    costConfigurationReady: true,
    costCurrency: 'CHF',
    quotaCurrency: 'CHF',
    billingLabel: 'SEMESTER_QUOTA',
    standardEstimateMinorUnits: 100,
    highEstimateMinorUnits: 200,
    estimatedCostMinorUnits: null,
    actualCostMinorUnits: null,
    actualInputTokens: null,
    actualOutputTokens: null,
    actualEmbeddingTokens: null,
    actualRequestCount: null,
    maxCostMinorUnits: 100000,
    costStatus: 'SETTLED',
    semesterKey: '2026S',
    semesterQuotaMinorUnits: 100000,
    semesterReservedMinorUnits: 0,
    semesterSettledMinorUnits: 0,
    remainingSemesterQuotaMinorUnits: 100000,
    worstCaseRemainingMinorUnits: 100000,
    ...overrides,
  }
}

/**
 * Serves the graph domain configuration from the synthetic catalog and captures
 * rebuild requests, so no paid generation ever reaches the backend.
 */
async function installKnowledgeGraphMocks(page: Page, state: DomainMockState) {
  const persistedOperations = JSON.parse(
    await readFile(
      new URL('../../packages/graphql/src/public/client.json', import.meta.url),
      'utf8'
    )
  ) as Record<string, string>
  const operationNamesByHash = new Map(
    Object.entries(persistedOperations).map(([name, hash]) => [hash, name])
  )

  await page.route('**/graphql*', async (route) => {
    const request = route.request()
    const requestUrl = new URL(request.url())
    let operationName =
      requestUrl.searchParams.get('operationName') ?? undefined

    if (!operationName && request.method() === 'POST') {
      const body = request.postDataJSON() as { operationName?: string } | null
      operationName = body?.operationName
    }
    if (!operationName) {
      const extensions = requestUrl.searchParams.get('extensions')
      const hash = extensions
        ? (
            JSON.parse(extensions) as {
              persistedQuery?: { sha256Hash?: string }
            }
          ).persistedQuery?.sha256Hash
        : undefined
      operationName = hash ? operationNamesByHash.get(hash) : undefined
    }

    if (operationName === 'GetKbKnowledgeGraphDomainConfig') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            getKbKnowledgeGraphConfig: graphConfig(state.config),
            getKbKnowledgeGraphDomainConfig: {
              __typename: 'KBKnowledgeGraphDomainConfig',
              capabilityEnabled: state.capabilityEnabled,
              catalogRevision: 'synthetic-catalog-revision',
              catalogDigest: 'synthetic-catalog-digest',
              options: state.options,
            },
          },
        }),
      })
      return
    }

    if (operationName === 'RebuildKbKnowledgeGraphWithDomain') {
      const body = request.postDataJSON() as {
        variables?: Record<string, unknown>
      } | null
      state.rebuildVariables.push(body?.variables ?? {})
      if (state.rebuildGate) {
        await state.rebuildGate
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            rebuildKbKnowledgeGraphWithDomain: graphConfig({
              ...state.config,
              buildId: 'synthetic-build',
              status: 'QUEUED',
            }),
          },
        }),
      })
      return
    }

    await route.continue()
  })
}

async function createKnowledgeBase(
  page: Page,
  manageUrl: string,
  kbName: string
) {
  await page.goto(`${manageUrl}/resources/knowledgeBases`)
  await expect(
    page.getByRole('main').getByRole('heading', { level: 1 })
  ).toBeVisible()
  await page.getByTestId('create-knowledge-base').click()
  await page.getByTestId('knowledge-base-name').fill(kbName)
  await page.getByTestId('submit-create-knowledge-base').click()

  const knowledgeBaseLink = page.getByRole('link').filter({ hasText: kbName })
  await expect(knowledgeBaseLink).toBeVisible()
  const href = (await knowledgeBaseLink.getAttribute('href')) ?? ''
  return new URL(href, manageUrl).pathname
}

async function openKnowledgeGraphPanel(
  page: Page,
  manageUrl: string,
  detailPath: string
) {
  await page.goto(`${manageUrl}${detailPath}#knowledge-graph`)
  await expect(page.getByTestId('kb-knowledge-graph-panel')).toBeVisible()
  await expect(page.getByTestId('kb-knowledge-graph-domain')).toBeVisible()
}

async function deleteKnowledgeBase(
  page: Page,
  manageUrl: string,
  kbName: string
) {
  await page.goto(`${manageUrl}/resources/knowledgeBases`)
  const row = page.locator('li').filter({ hasText: kbName })
  if (await row.count()) {
    await row.getByRole('button', { name: /Delete|Löschen/ }).click()
    await page.getByTestId('confirm-delete-knowledge-base').click()
    await expect(row).toHaveCount(0)
  }
}

async function selectDomain(page: Page, label: string) {
  await page.getByTestId('kb-knowledge-graph-domain').click()
  await page.getByRole('option', { name: label }).click()
}

async function expectDomainOptions(page: Page, labels: Record<string, string>) {
  await page.getByTestId('kb-knowledge-graph-domain').click()
  await expect(page.getByRole('option')).toHaveCount(DOMAIN_IDS.length)
  for (const id of DOMAIN_IDS) {
    await expect(page.getByRole('option', { name: labels[id] })).toBeVisible()
  }
  await page.keyboard.press('Escape')
}

const galleryDirectory = new URL(
  '../../project/_local/kg-domain-gallery/',
  import.meta.url
)

test.describe('Knowledge base domain selection', () => {
  test('offers the catalog domains, submits the selected pair and reports the served domain', async ({
    loginLecturer,
    page,
  }) => {
    await loginLecturer()

    const manageUrl = process.env.URL_MANAGE ?? URL_MANAGE
    const kbName = `Domain catalog ${Date.now()}`
    const state: DomainMockState = {
      capabilityEnabled: true,
      options: domainCatalog(DOMAIN_IDS),
      config: {},
      rebuildVariables: [],
    }
    let detailPath: string | undefined

    try {
      await installKnowledgeGraphMocks(page, state)
      detailPath = await createKnowledgeBase(page, manageUrl, kbName)
      const kbId = detailPath.split('/').filter(Boolean).pop() ?? ''
      await openKnowledgeGraphPanel(page, manageUrl, detailPath)

      const domainSelect = page.getByTestId('kb-knowledge-graph-domain')
      // The default is the explicit finance v1 pair, never the first catalog entry.
      await expect(domainSelect).toBeEnabled()
      await expect(domainSelect).toContainText(EN_DOMAIN_LABELS.finance)
      await expectDomainOptions(page, EN_DOMAIN_LABELS)

      await selectDomain(page, EN_DOMAIN_LABELS.business)
      const categories = page.getByTestId(
        'kb-knowledge-graph-domain-categories'
      )
      await expect(categories).toBeVisible()
      await expect(categories).toContainText(BUSINESS_CATEGORIES[0])
      await expect(categories).toContainText(BUSINESS_CATEGORIES[1])

      await mkdir(galleryDirectory, { recursive: true })
      await page.setViewportSize({ width: 1440, height: 1000 })
      await page.screenshot({
        path: fileURLToPath(
          new URL('kb-domain-en-desktop.png', galleryDirectory)
        ),
        fullPage: true,
      })
      await page.setViewportSize({ width: 420, height: 900 })
      await page.screenshot({
        path: fileURLToPath(
          new URL('kb-domain-en-mobile.png', galleryDirectory)
        ),
        fullPage: true,
      })
      await page.setViewportSize({ width: 1920, height: 1080 })

      const rebuild = page.getByTestId('kb-knowledge-graph-rebuild')
      await expect(rebuild).toBeEnabled()
      await rebuild.click()
      await expect.poll(() => state.rebuildVariables.length).toBe(1)
      expect(state.rebuildVariables[0]).toEqual({
        kbId,
        qualityTier: 'STANDARD',
        domainPolicyId: 'business',
        domainPolicyVersion: 1,
        domainPolicyLanguage: 'German',
      })

      // A pending build disables the control and swallows a duplicate submit.
      let releaseRebuild = () => {}
      state.rebuildGate = new Promise<void>((resolve) => {
        releaseRebuild = resolve
      })
      await rebuild.click()
      await expect.poll(() => state.rebuildVariables.length).toBe(2)
      await expect(domainSelect).toBeDisabled()
      await expect(rebuild).toBeDisabled()
      await rebuild.dispatchEvent('click')
      await page.waitForTimeout(250)
      expect(state.rebuildVariables.length).toBe(2)
      releaseRebuild()
      state.rebuildGate = undefined

      // A separately published domain is reported without relabelling the attempt.
      state.config = {
        domainPolicyId: 'business',
        domainPolicyVersion: 1,
        domainPolicyLanguage: 'German',
        publishedDomainPolicyId: 'finance',
        publishedDomainPolicyVersion: 1,
        publishedDomainPolicyLanguage: 'German',
      }
      await page.reload()
      const publishedDomain = page.getByTestId(
        'kb-knowledge-graph-published-domain'
      )
      await expect(publishedDomain).toBeVisible()
      await expect(publishedDomain).toContainText(EN_DOMAIN_LABELS.finance)

      state.config = {
        domainPolicyId: 'finance',
        domainPolicyVersion: 1,
        domainPolicyLanguage: 'German',
        publishedDomainPolicyId: 'finance',
        publishedDomainPolicyVersion: 1,
        publishedDomainPolicyLanguage: 'German',
      }
      await page.reload()
      await expect(
        page.getByTestId('kb-knowledge-graph-published-domain')
      ).toHaveCount(0)

      // A legacy published build records no triple; that served graph is the
      // default Finance v1 in German and must still be identified once the
      // latest attempt has moved to another domain.
      state.config = {
        domainPolicyId: 'mathematics',
        domainPolicyVersion: 1,
        domainPolicyLanguage: 'German',
        publishedBuildId: 'synthetic-published-build',
        publishedDomainPolicyId: null,
        publishedDomainPolicyVersion: null,
        publishedDomainPolicyLanguage: null,
      }
      await page.reload()
      await expect(publishedDomain).toBeVisible()
      await expect(publishedDomain).toContainText(EN_DOMAIN_LABELS.finance)
    } finally {
      await deleteKnowledgeBase(page, manageUrl, kbName)
    }
  })

  test('restores the stored pair, keeps it on a catalog refresh and blocks a retired pair', async ({
    loginLecturer,
    page,
  }) => {
    await loginLecturer()

    const manageUrl = process.env.URL_MANAGE ?? URL_MANAGE
    const kbName = `Domain restore ${Date.now()}`
    const state: DomainMockState = {
      capabilityEnabled: true,
      options: domainCatalog(DOMAIN_IDS),
      config: {
        domainPolicyId: 'business',
        domainPolicyVersion: 1,
        domainPolicyLanguage: 'German',
        domainCategories: domainCategoriesFor('business'),
      },
      rebuildVariables: [],
    }
    let detailPath: string | undefined

    try {
      await installKnowledgeGraphMocks(page, state)
      detailPath = await createKnowledgeBase(page, manageUrl, kbName)
      await openKnowledgeGraphPanel(page, manageUrl, detailPath)

      const domainSelect = page.getByTestId('kb-knowledge-graph-domain')
      const categories = page.getByTestId(
        'kb-knowledge-graph-domain-categories'
      )
      await expect(domainSelect).toContainText(EN_DOMAIN_LABELS.business)
      await expect(categories).toContainText(BUSINESS_CATEGORIES[0])

      // The retained pair disappears from the catalog after a refresh.
      state.options = domainCatalog(
        DOMAIN_IDS.filter((id) => id !== 'business')
      )
      await page.reload()
      await expect(
        page.getByTestId('kb-knowledge-graph-domain-unsupported')
      ).toBeVisible()
      await expect(domainSelect).not.toContainText(EN_DOMAIN_LABELS.business)
      await expect(categories).toContainText(BUSINESS_CATEGORIES[0])
      await expect(
        page.getByTestId('kb-knowledge-graph-rebuild')
      ).toBeDisabled()

      // A retained pair the catalog keeps only in English cannot generate the
      // German categories, so it stays blocked until an explicit valid choice.
      state.options = [
        ...domainCatalog(DOMAIN_IDS.filter((id) => id !== 'business')),
        syntheticDomainOption('business', 1, 'English'),
      ]
      await page.reload()
      await expect(
        page.getByTestId('kb-knowledge-graph-domain-unsupported')
      ).toBeVisible()
      await expect(domainSelect).toContainText(EN_DOMAIN_LABELS.business)
      await expect(categories).toContainText(BUSINESS_CATEGORIES[0])
      await expect(
        page.getByTestId('kb-knowledge-graph-rebuild')
      ).toBeDisabled()

      // A newer version of the same id must not replace the retained pair.
      state.options = [
        ...domainCatalog(DOMAIN_IDS.filter((id) => id !== 'business')),
        syntheticDomainOption('business', 2),
      ]
      await page.reload()
      await expect(
        page.getByTestId('kb-knowledge-graph-domain-unsupported')
      ).toBeVisible()
      await expect(
        page.getByTestId('kb-knowledge-graph-rebuild')
      ).toBeDisabled()

      // Only an explicit valid choice unblocks the rebuild.
      await selectDomain(page, EN_DOMAIN_LABELS.business)
      const rebuild = page.getByTestId('kb-knowledge-graph-rebuild')
      await expect(rebuild).toBeEnabled()
      await rebuild.click()
      await expect.poll(() => state.rebuildVariables.length).toBe(1)
      expect(state.rebuildVariables[0]).toMatchObject({
        domainPolicyId: 'business',
        domainPolicyVersion: 2,
        domainPolicyLanguage: 'German',
      })
    } finally {
      await deleteKnowledgeBase(page, manageUrl, kbName)
    }
  })

  test('keeps the legacy path while the gate is closed and blocks a stored explicit domain', async ({
    loginLecturer,
    page,
  }) => {
    await loginLecturer()

    const manageUrl = process.env.URL_MANAGE ?? URL_MANAGE
    const kbName = `Domain gate ${Date.now()}`
    const state: DomainMockState = {
      capabilityEnabled: false,
      options: [],
      config: {},
      rebuildVariables: [],
    }
    let detailPath: string | undefined

    try {
      await installKnowledgeGraphMocks(page, state)
      detailPath = await createKnowledgeBase(page, manageUrl, kbName)
      await openKnowledgeGraphPanel(page, manageUrl, detailPath)

      // Without a stored domain the legacy finance label is shown read-only.
      const domainControl = page.getByTestId('kb-knowledge-graph-domain')
      await expect(domainControl).toContainText(EN_DOMAIN_LABELS.finance)
      await expect(domainControl).not.toHaveRole('combobox')

      const rebuild = page.getByTestId('kb-knowledge-graph-rebuild')
      await expect(rebuild).toBeEnabled()
      await rebuild.click()
      await expect.poll(() => state.rebuildVariables.length).toBe(1)
      expect(state.rebuildVariables[0]).not.toHaveProperty('domainPolicyId')
      expect(state.rebuildVariables[0]).not.toHaveProperty(
        'domainPolicyVersion'
      )
      expect(state.rebuildVariables[0]).not.toHaveProperty(
        'domainPolicyLanguage'
      )

      // A stored explicit domain must not be silently replaced by the default.
      state.config = {
        domainPolicyId: 'economics',
        domainPolicyVersion: 1,
        domainPolicyLanguage: 'German',
        domainCategories: domainCategoriesFor('economics'),
      }
      await page.reload()
      await expect(
        page.getByTestId('kb-knowledge-graph-domain-unsupported')
      ).toBeVisible()
      await expect(domainControl).toContainText(EN_DOMAIN_LABELS.economics)
      await expect(
        page.getByTestId('kb-knowledge-graph-domain-categories')
      ).toContainText(ECONOMICS_CATEGORIES[0])
      await expect(rebuild).toBeDisabled()
      await rebuild.dispatchEvent('click')
      await page.waitForTimeout(250)
      expect(state.rebuildVariables.length).toBe(1)

      // The interface locale changes the labels, not the German generation language.
      state.capabilityEnabled = true
      state.options = domainCatalog(DOMAIN_IDS)
      state.config = {}
      await page.goto(`${manageUrl}/de${detailPath}#knowledge-graph`)
      await expect(page.getByTestId('kb-knowledge-graph-domain')).toBeVisible()
      await expectDomainOptions(page, DE_DOMAIN_LABELS)
      await selectDomain(page, DE_DOMAIN_LABELS.mathematics)
      await page.getByTestId('kb-knowledge-graph-rebuild').click()
      await expect.poll(() => state.rebuildVariables.length).toBe(2)
      expect(state.rebuildVariables[1]).toMatchObject({
        domainPolicyId: 'mathematics',
        domainPolicyVersion: 1,
        domainPolicyLanguage: 'German',
      })

      await mkdir(galleryDirectory, { recursive: true })
      await page.setViewportSize({ width: 1440, height: 1000 })
      await page.screenshot({
        path: fileURLToPath(
          new URL('kb-domain-de-desktop.png', galleryDirectory)
        ),
        fullPage: true,
      })
      await page.setViewportSize({ width: 420, height: 900 })
      await page.screenshot({
        path: fileURLToPath(
          new URL('kb-domain-de-mobile.png', galleryDirectory)
        ),
        fullPage: true,
      })
    } finally {
      await deleteKnowledgeBase(page, manageUrl, kbName)
    }
  })
})
