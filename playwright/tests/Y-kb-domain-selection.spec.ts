import { readFile } from 'node:fs/promises'
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

// Contract domains. The controls resolve each labelKey to the interface
// language, so every assertion below stays on ids, versions and the submitted
// protocol.
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

const EN_MESSAGES = enMessages as unknown as MessageCatalog
const DE_MESSAGES = deMessages as unknown as MessageCatalog

function domainLabels(messages: MessageCatalog): Record<string, string> {
  return Object.fromEntries(
    DOMAIN_IDS.map((id) => [id, messages.kb[DOMAIN_MESSAGE_KEYS[id]]])
  )
}

const EN_DOMAIN_LABELS = domainLabels(EN_MESSAGES)
const DE_DOMAIN_LABELS = domainLabels(DE_MESSAGES)

// The content-language control resolves its labels through the same shipped
// catalogs, so the spec never restates product copy.
const LANGUAGE_MESSAGE_KEYS: Record<string, string> = {
  German: 'graphDomainLanguageGerman',
  English: 'graphDomainLanguageEnglish',
}

function domainLanguageLabels(
  messages: MessageCatalog
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(LANGUAGE_MESSAGE_KEYS).map(([language, key]) => [
      language,
      messages.kb[key],
    ])
  )
}

const EN_LANGUAGE_LABELS = domainLanguageLabels(EN_MESSAGES)
const DE_LANGUAGE_LABELS = domainLanguageLabels(DE_MESSAGES)

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

// The English counterpart of one catalog language.
const ENGLISH_CATEGORIES: Record<string, Array<[string, string]>> = {
  finance: [
    ['Financing', 'Capital structure and financing decisions.'],
    ['Asset Classes', 'Portfolio choice and valuation.'],
  ],
  economics: [
    ['Markets', 'Supply, demand and price formation.'],
    ['Business Cycle', 'Growth, inflation and employment.'],
  ],
  business: [
    ['Accounting', 'Financial reporting and bookkeeping.'],
    ['Sales', 'Customer value and market cultivation.'],
  ],
  mathematics: [
    ['Vector Spaces', 'Vector spaces and linear maps.'],
    ['Probability', 'Random variables and distributions.'],
  ],
  informatics: [
    ['Algorithms', 'Correctness and complexity of procedures.'],
    ['Databases', 'Relational modelling and queries.'],
  ],
  'general-academic': [
    ['Research Methods', 'Planning and evaluating studies.'],
    ['Literature Work', 'Structuring academic texts.'],
  ],
}

const CATEGORIES_BY_LANGUAGE: Record<
  string,
  Record<string, Array<[string, string]>>
> = { German: GERMAN_CATEGORIES, English: ENGLISH_CATEGORIES }

function syntheticDomainOption(
  id: string,
  version = 1,
  languages: readonly string[] = ['German']
): SyntheticDomainOption {
  return {
    id,
    version,
    labelKey: id,
    languages: languages.map((language) => ({
      language,
      categories: (CATEGORIES_BY_LANGUAGE[language]?.[id] ?? []).map(
        ([name, definition]) => ({
          name,
          definition,
        })
      ),
    })),
  }
}

function domainCatalog(
  ids: readonly string[],
  languages: readonly string[] = ['German']
): SyntheticDomainOption[] {
  return ids.map((id) => syntheticDomainOption(id, 1, languages))
}

function domainCategoriesFor(
  id: string,
  language = 'German'
): SyntheticCategory[] {
  return (CATEGORIES_BY_LANGUAGE[language]?.[id] ?? []).map(
    ([name, definition]) => ({ name, definition })
  )
}

type StoredKbDomain = {
  domainPolicyId: string | null
  domainPolicyVersion: number | null
  domainPolicyLanguage: string | null
}

type DomainMockState = {
  kbName: string
  capabilityEnabled: boolean
  options: SyntheticDomainOption[]
  /** Overrides the graph configuration the panel reads. */
  config: Record<string, unknown>
  /** Overrides the triple the knowledge base itself reports, or null to keep it. */
  kbDomain: StoredKbDomain | null
  rebuildVariables: Array<Record<string, unknown>>
  updateVariables: Array<Record<string, unknown>>
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
    focusTopic: null,
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
 * Serves the domain catalog from the synthetic options and captures the writes
 * the controls make, so no paid generation and no explicit triple ever reaches
 * the backend. The catalog is mocked in both directions, which keeps the spec
 * independent of whether the deployment under test has the capability gate open.
 */
async function installKbMocks(page: Page, state: DomainMockState) {
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

    const domainConfig = {
      __typename: 'KBKnowledgeGraphDomainConfig',
      capabilityEnabled: state.capabilityEnabled,
      catalogRevision: 'synthetic-catalog-revision',
      catalogDigest: 'synthetic-catalog-digest',
      options: state.options,
    }

    // The creation form and the settings section read the catalog without a
    // knowledge base, the graph panel reads it together with the build.
    if (operationName === 'GetKbGraphDomainOptions') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: { getKbKnowledgeGraphDomainConfig: domainConfig },
        }),
      })
      return
    }

    if (operationName === 'GetKbKnowledgeGraphDomainConfig') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            getKbKnowledgeGraphConfig: graphConfig(state.config),
            getKbKnowledgeGraphDomainConfig: domainConfig,
          },
        }),
      })
      return
    }

    // The stored triple is patched into the real knowledge base so the metrics
    // and the identity stay authentic while the spec controls the selection.
    if (operationName === 'GetKb' && state.kbDomain != null) {
      const response = await route.fetch()
      const json = (await response.json()) as {
        data?: { getKb?: Record<string, unknown> | null }
      }
      if (json.data?.getKb) {
        Object.assign(json.data.getKb, state.kbDomain)
      }
      await route.fulfill({ response, json })
      return
    }

    if (operationName === 'UpdateKb') {
      const body = request.postDataJSON() as {
        variables?: Record<string, unknown>
      } | null
      const variables = body?.variables ?? {}
      state.updateVariables.push(variables)
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            updateKb: {
              __typename: 'KB',
              id: variables.id ?? null,
              name: state.kbName,
              description: null,
              domainPolicyId: variables.domainPolicyId ?? null,
              domainPolicyVersion: variables.domainPolicyVersion ?? null,
              domainPolicyLanguage: variables.domainPolicyLanguage ?? null,
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

/**
 * Creates the knowledge base the test works on. The catalog is served as
 * unavailable for the duration, so the real creation carries no explicit triple
 * and the backend never has to accept one.
 */
async function createKnowledgeBase(
  page: Page,
  manageUrl: string,
  state: DomainMockState
) {
  const capabilityEnabled = state.capabilityEnabled
  state.capabilityEnabled = false
  try {
    await page.goto(`${manageUrl}/resources/knowledgeBases`)
    await expect(
      page.getByRole('main').getByRole('heading', { level: 1 })
    ).toBeVisible()
    await page.getByTestId('create-knowledge-base').click()
    await expect(page.getByTestId('knowledge-base-domain-fields')).toHaveCount(
      0
    )
    await page.getByTestId('knowledge-base-name').fill(state.kbName)
    await page.getByTestId('submit-create-knowledge-base').click()

    const knowledgeBaseLink = page
      .getByRole('link')
      .filter({ hasText: state.kbName })
    await expect(knowledgeBaseLink).toBeVisible()
    const href = (await knowledgeBaseLink.getAttribute('href')) ?? ''
    return new URL(href, manageUrl).pathname
  } finally {
    state.capabilityEnabled = capabilityEnabled
  }
}

async function openKnowledgeGraphPanel(
  page: Page,
  manageUrl: string,
  detailPath: string
) {
  await page.goto(`${manageUrl}${detailPath}#knowledge-graph`)
  await expect(page.getByTestId('kb-knowledge-graph-panel')).toBeVisible()
  await expect(page.getByTestId('kb-knowledge-graph-rebuild')).toBeVisible()
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

async function selectOption(page: Page, testId: string, label: string) {
  await page.getByTestId(testId).click()
  await page.getByRole('option', { name: label }).click()
}

function kbIdFrom(detailPath: string) {
  return detailPath.split('/').filter(Boolean).pop() ?? ''
}

test.describe('Knowledge base subject area and language', () => {
  test('stores the subject area and language on the knowledge base itself', async ({
    loginLecturer,
    page,
  }) => {
    await loginLecturer()

    const manageUrl = process.env.URL_MANAGE ?? URL_MANAGE
    const state: DomainMockState = {
      kbName: `Domain settings ${Date.now()}`,
      capabilityEnabled: true,
      options: domainCatalog(DOMAIN_IDS, ['German', 'English']),
      config: {},
      kbDomain: null,
      rebuildVariables: [],
      updateVariables: [],
    }
    let detailPath: string | undefined

    try {
      await installKbMocks(page, state)
      detailPath = await createKnowledgeBase(page, manageUrl, state)
      const kbId = kbIdFrom(detailPath)

      await page.goto(`${manageUrl}${detailPath}`)
      const settings = page.getByTestId('kb-domain-settings')
      await expect(settings).toBeVisible()
      // A knowledge base created without the catalog records no selection.
      await expect(
        page.getByTestId('kb-domain-settings-subject-value')
      ).toHaveText(EN_MESSAGES.kb.domainSettingsNotSet)
      await expect(
        page.getByTestId('kb-domain-settings-language-value')
      ).toHaveText(EN_MESSAGES.kb.domainSettingsNotSet)

      // Editing opens on the suggested pair rather than an empty control, and
      // the content language defaults to German independently of the interface.
      await page.getByTestId('kb-domain-settings-edit').click()
      const subject = page.getByTestId('kb-domain-settings-subject')
      const language = page.getByTestId('kb-domain-settings-language')
      await expect(subject).toContainText(EN_DOMAIN_LABELS.finance)
      await expect(language).toContainText(EN_LANGUAGE_LABELS.German)

      await selectOption(
        page,
        'kb-domain-settings-subject',
        EN_DOMAIN_LABELS.business
      )
      await selectOption(
        page,
        'kb-domain-settings-language',
        EN_LANGUAGE_LABELS.English
      )
      await page.getByTestId('kb-domain-settings-save').click()
      await expect.poll(() => state.updateVariables.length).toBe(1)
      expect(state.updateVariables[0]).toEqual({
        id: kbId,
        domainPolicyId: 'business',
        domainPolicyVersion: 1,
        domainPolicyLanguage: 'English',
      })

      // The saved pair replaces the read view without a refetch.
      await expect(
        page.getByTestId('kb-domain-settings-subject-value')
      ).toHaveText(EN_DOMAIN_LABELS.business)
      await expect(
        page.getByTestId('kb-domain-settings-language-value')
      ).toHaveText(EN_LANGUAGE_LABELS.English)

      // The interface locale changes only the labels of the stored pair.
      state.kbDomain = {
        domainPolicyId: 'business',
        domainPolicyVersion: 1,
        domainPolicyLanguage: 'English',
      }
      await page.goto(`${manageUrl}/de${detailPath}`)
      await expect(
        page.getByTestId('kb-domain-settings-subject-value')
      ).toHaveText(DE_DOMAIN_LABELS.business)
      await expect(
        page.getByTestId('kb-domain-settings-language-value')
      ).toHaveText(DE_LANGUAGE_LABELS.English)
    } finally {
      await deleteKnowledgeBase(page, manageUrl, state.kbName)
    }
  })

  test('keeps a stored pair readable and refuses to save one the catalog cannot serve', async ({
    loginLecturer,
    page,
  }) => {
    await loginLecturer()

    const manageUrl = process.env.URL_MANAGE ?? URL_MANAGE
    const state: DomainMockState = {
      kbName: `Domain retired ${Date.now()}`,
      capabilityEnabled: true,
      options: domainCatalog(DOMAIN_IDS, ['German', 'English']),
      config: {},
      kbDomain: {
        domainPolicyId: 'business',
        domainPolicyVersion: 1,
        domainPolicyLanguage: 'German',
      },
      rebuildVariables: [],
      updateVariables: [],
    }
    let detailPath: string | undefined

    try {
      await installKbMocks(page, state)
      detailPath = await createKnowledgeBase(page, manageUrl, state)
      const kbId = kbIdFrom(detailPath)

      // A pair the catalog no longer offers still reads as a subject area.
      state.options = domainCatalog(
        DOMAIN_IDS.filter((id) => id !== 'business')
      )
      await page.goto(`${manageUrl}${detailPath}`)
      await expect(
        page.getByTestId('kb-domain-settings-subject-value')
      ).toHaveText(EN_DOMAIN_LABELS.business)

      // It cannot be saved again, so the control opens empty and the save stays
      // blocked until the lecturer picks a pair the catalog serves.
      await page.getByTestId('kb-domain-settings-edit').click()
      await expect(
        page.getByTestId('kb-domain-settings-subject')
      ).not.toContainText(EN_DOMAIN_LABELS.business)
      await expect(page.getByTestId('kb-domain-settings-save')).toBeDisabled()

      await selectOption(
        page,
        'kb-domain-settings-subject',
        EN_DOMAIN_LABELS.mathematics
      )
      await expect(page.getByTestId('kb-domain-settings-save')).toBeEnabled()
      await page.getByTestId('kb-domain-settings-save').click()
      await expect.poll(() => state.updateVariables.length).toBe(1)
      expect(state.updateVariables[0]).toEqual({
        id: kbId,
        domainPolicyId: 'mathematics',
        domainPolicyVersion: 1,
        domainPolicyLanguage: 'German',
      })

      // A subject the catalog keeps but cannot serve in the chosen language is
      // named explicitly instead of silently rewriting either half of the pair.
      state.options = domainCatalog(DOMAIN_IDS)
      state.kbDomain = {
        domainPolicyId: 'business',
        domainPolicyVersion: 1,
        domainPolicyLanguage: 'English',
      }
      await page.goto(`${manageUrl}${detailPath}`)
      await page.getByTestId('kb-domain-settings-edit').click()
      await expect(
        page.getByTestId('kb-domain-settings-unsupported')
      ).toBeVisible()
      await expect(page.getByTestId('kb-domain-settings-save')).toBeDisabled()

      await selectOption(
        page,
        'kb-domain-settings-language',
        EN_LANGUAGE_LABELS.German
      )
      await expect(
        page.getByTestId('kb-domain-settings-unsupported')
      ).toHaveCount(0)
      await expect(page.getByTestId('kb-domain-settings-save')).toBeEnabled()
    } finally {
      await deleteKnowledgeBase(page, manageUrl, state.kbName)
    }
  })

  test('reports the domain a build ran with and rebuilds without sending one', async ({
    loginLecturer,
    page,
  }) => {
    await loginLecturer()

    const manageUrl = process.env.URL_MANAGE ?? URL_MANAGE
    const state: DomainMockState = {
      kbName: `Domain build ${Date.now()}`,
      capabilityEnabled: true,
      options: domainCatalog(DOMAIN_IDS, ['German', 'English']),
      config: { focusTopic: 'Historical graph focus' },
      kbDomain: null,
      rebuildVariables: [],
      updateVariables: [],
    }
    let detailPath: string | undefined

    try {
      await installKbMocks(page, state)
      detailPath = await createKnowledgeBase(page, manageUrl, state)
      const kbId = kbIdFrom(detailPath)
      await openKnowledgeGraphPanel(page, manageUrl, detailPath)

      // The focus topic of an earlier build is reported, never re-entered.
      await expect(
        page.locator('input[data-cy="kb-knowledge-graph-focus-topic"]')
      ).toHaveCount(0)
      await expect(
        page.getByTestId('kb-knowledge-graph-focus-topic')
      ).toBeVisible()

      // Without a build there is no domain to report and nothing to choose: the
      // subject area and language live on the knowledge base, not here.
      await expect(page.getByTestId('kb-knowledge-graph-domain')).toHaveCount(0)
      await expect(
        page.getByTestId('kb-knowledge-graph-domain-categories')
      ).toHaveCount(0)

      const rebuild = page.getByTestId('kb-knowledge-graph-rebuild')
      await expect(rebuild).toBeEnabled()
      await rebuild.click()
      await expect.poll(() => state.rebuildVariables.length).toBe(1)
      // The build reads the stored pair on the server, so the request carries
      // only the knowledge base and the quality tier.
      expect(state.rebuildVariables[0]).toEqual({
        kbId,
        qualityTier: 'STANDARD',
      })

      // A pending build disables the tier and swallows a duplicate submit.
      let releaseRebuild = () => {}
      state.rebuildGate = new Promise<void>((resolve) => {
        releaseRebuild = resolve
      })
      await expect(rebuild).toBeEnabled()
      await rebuild.click()
      await expect.poll(() => state.rebuildVariables.length).toBe(2)
      await expect(
        page.getByTestId('kb-knowledge-graph-quality-tier')
      ).toBeDisabled()
      await expect(rebuild).toBeDisabled()
      await rebuild.dispatchEvent('click')
      await page.waitForTimeout(250)
      expect(state.rebuildVariables.length).toBe(2)
      releaseRebuild()
      state.rebuildGate = undefined

      // A build reports the pair and the categories it recorded, both read from
      // the build itself rather than looked up in the current catalog.
      state.config = {
        domainPolicyId: 'business',
        domainPolicyVersion: 1,
        domainPolicyLanguage: 'German',
        domainCategories: domainCategoriesFor('business'),
      }
      await page.reload()
      await expect(page.getByTestId('kb-knowledge-graph-domain')).toContainText(
        EN_DOMAIN_LABELS.business
      )
      const categories = page.getByTestId(
        'kb-knowledge-graph-domain-categories'
      )
      await expect(categories).toContainText(BUSINESS_CATEGORIES[0])
      await expect(categories).toContainText(BUSINESS_CATEGORIES[1])

      // A failed or superseded attempt must not relabel the graph in service.
      state.config = {
        publishedBuildId: 'synthetic-published-build',
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
        publishedBuildId: 'synthetic-published-build',
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
      await deleteKnowledgeBase(page, manageUrl, state.kbName)
    }
  })

  test('hides the controls while the capability gate is closed without blocking a rebuild', async ({
    loginLecturer,
    page,
  }) => {
    await loginLecturer()

    const manageUrl = process.env.URL_MANAGE ?? URL_MANAGE
    const state: DomainMockState = {
      kbName: `Domain gate ${Date.now()}`,
      capabilityEnabled: false,
      options: [],
      config: {},
      kbDomain: null,
      rebuildVariables: [],
      updateVariables: [],
    }
    let detailPath: string | undefined

    try {
      await installKbMocks(page, state)
      detailPath = await createKnowledgeBase(page, manageUrl, state)
      const kbId = kbIdFrom(detailPath)

      // A deployment that cannot offer the catalog says nothing about a
      // knowledge base that never recorded a choice.
      await page.goto(`${manageUrl}${detailPath}`)
      await expect(page.getByTestId('kb-metrics')).toBeVisible()
      await expect(page.getByTestId('kb-domain-settings')).toHaveCount(0)

      // A stored pair stays readable, without an edit control it cannot honor.
      state.kbDomain = {
        domainPolicyId: 'economics',
        domainPolicyVersion: 1,
        domainPolicyLanguage: 'German',
      }
      await page.reload()
      await expect(
        page.getByTestId('kb-domain-settings-subject-value')
      ).toHaveText(EN_DOMAIN_LABELS.economics)
      await expect(page.getByTestId('kb-domain-settings-edit')).toHaveCount(0)

      // The build falls back to the provider default rather than refusing, so a
      // closed gate never leaves a knowledge base that can neither be rebuilt
      // nor reconfigured.
      state.config = {
        domainPolicyId: 'economics',
        domainPolicyVersion: 1,
        domainPolicyLanguage: 'German',
        domainCategories: domainCategoriesFor('economics'),
      }
      await openKnowledgeGraphPanel(page, manageUrl, detailPath)
      await expect(page.getByTestId('kb-knowledge-graph-domain')).toContainText(
        EN_DOMAIN_LABELS.economics
      )
      await expect(
        page.getByTestId('kb-knowledge-graph-domain-categories')
      ).toContainText(ECONOMICS_CATEGORIES[0])

      const rebuild = page.getByTestId('kb-knowledge-graph-rebuild')
      await expect(rebuild).toBeEnabled()
      await rebuild.click()
      await expect.poll(() => state.rebuildVariables.length).toBe(1)
      expect(state.rebuildVariables[0]).toEqual({
        kbId,
        qualityTier: 'STANDARD',
      })
    } finally {
      await deleteKnowledgeBase(page, manageUrl, state.kbName)
    }
  })
})
