import { useTranslations } from 'next-intl'

/**
 * A build that predates explicit domain selection was generated with Finance v1
 * in German. Applying that default when reading a stored triple keeps null
 * columns meaning "no explicit selection" while still describing what the graph
 * actually serves.
 */
export const DEFAULT_DOMAIN_POLICY_ID = 'finance'
export const DEFAULT_DOMAIN_POLICY_VERSION = 1
// The generation language is an explicit part of the domain selection, so it is
// never derived from the interface locale. German stays the default for builds
// that predate an explicit language.
export const DEFAULT_DOMAIN_GENERATION_LANGUAGE = 'German'
export const DOMAIN_GENERATION_LANGUAGES = ['German', 'English'] as const

export type DomainGenerationLanguage =
  (typeof DOMAIN_GENERATION_LANGUAGES)[number]

export type KbDomainTriple = {
  id: string | null
  version: number | null
  language: string | null
}

export function isDomainGenerationLanguage(
  language: string | null | undefined
): language is DomainGenerationLanguage {
  return (
    language != null &&
    (DOMAIN_GENERATION_LANGUAGES as readonly string[]).includes(language)
  )
}

/**
 * Fills a stored triple with the legacy default so two builds that serve the
 * same domain are never reported as different, one having recorded the triple
 * explicitly and the other having predated it.
 */
export function effectiveKbDomain(domain: KbDomainTriple) {
  return {
    id: domain.id ?? DEFAULT_DOMAIN_POLICY_ID,
    version: domain.version ?? DEFAULT_DOMAIN_POLICY_VERSION,
    language: domain.language ?? DEFAULT_DOMAIN_GENERATION_LANGUAGE,
  }
}

export function isSameKbDomain(a: KbDomainTriple, b: KbDomainTriple): boolean {
  const left = effectiveKbDomain(a)
  const right = effectiveKbDomain(b)
  return (
    left.id === right.id &&
    left.version === right.version &&
    left.language === right.language
  )
}

/**
 * Translations for catalog entries. A stored domain keeps its label even when
 * the catalog no longer offers it, so a closed capability gate or a retired
 * version still reads as a domain instead of an internal id.
 */
export function useKbDomainLabels() {
  const t = useTranslations()

  const labelForKey = (labelKey: string): string | null => {
    switch (labelKey) {
      case 'finance':
        return t('kb.graphDomainFinance')
      case 'economics':
        return t('kb.graphDomainEconomics')
      case 'business':
        return t('kb.graphDomainBusiness')
      case 'mathematics':
        return t('kb.graphDomainMathematics')
      case 'informatics':
        return t('kb.graphDomainInformatics')
      case 'general-academic':
        return t('kb.graphDomainGeneralAcademic')
      default:
        return null
    }
  }

  const languageLabel = (language: string | null): string => {
    switch (language) {
      case 'German':
        return t('kb.graphDomainLanguageGerman')
      case 'English':
        return t('kb.graphDomainLanguageEnglish')
      default:
        return '—'
    }
  }

  const versionLabel = (version: number | null): string =>
    version == null ? t('kb.graphDomainVersionUnknown') : String(version)

  return { labelForKey, languageLabel, versionLabel }
}

export type KbDomainOption = {
  id: string
  version: number
  labelKey: string
  languages: readonly { language: string }[]
}

/** Pairs the two columns a stored selection keeps into one select value. */
export function kbDomainOptionValue(option: {
  id: string
  version: number
}): string {
  return `${option.id}@${option.version}`
}

export function kbDomainOptionLabel(
  option: { id: string; labelKey: string },
  labelForKey: (labelKey: string) => string | null
): string {
  return labelForKey(option.labelKey) ?? option.id
}

/**
 * Select items for the catalog. The version rides along only where the catalog
 * offers the same subject twice, so an ordinary list stays free of numbers the
 * lecturer has no reason to choose between.
 */
export function kbDomainItems(
  options: readonly KbDomainOption[],
  labelForKey: (labelKey: string) => string | null
) {
  return options.map((option) => ({
    value: kbDomainOptionValue(option),
    label: options.some(
      (candidate) =>
        candidate.id === option.id && candidate.version !== option.version
    )
      ? `${kbDomainOptionLabel(option, labelForKey)} (v${option.version})`
      : kbDomainOptionLabel(option, labelForKey),
  }))
}

export function kbDomainLabelForId(
  id: string,
  options: readonly KbDomainOption[],
  labelForKey: (labelKey: string) => string | null
): string | null {
  const option = options.find((candidate) => candidate.id === id)
  return option ? kbDomainOptionLabel(option, labelForKey) : labelForKey(id)
}

/**
 * The catalog entry a selection names, or undefined when the catalog no longer
 * offers that exact pair. A retired pair stays selected instead of moving to
 * another version the catalog happens to keep.
 */
export function findKbDomainOption(
  options: readonly KbDomainOption[],
  selection: { id: string; version: number | null }
): KbDomainOption | undefined {
  return options.find(
    (option) =>
      option.id === selection.id && option.version === selection.version
  )
}

export function kbDomainOptionServesLanguage(
  option: KbDomainOption | undefined,
  language: string
): boolean {
  return option?.languages.some((entry) => entry.language === language) ?? false
}

/**
 * Whether the catalog can actually generate the selection. A retired pair and a
 * subject that keeps no categories in the chosen language both fail here, so a
 * control can refuse the save instead of letting the server reject it.
 */
export function isKbDomainSelectionSupported(
  options: readonly KbDomainOption[],
  selection: { id: string; version: number | null; language: string }
): boolean {
  return kbDomainOptionServesLanguage(
    findKbDomainOption(options, selection),
    selection.language
  )
}

/**
 * The selection a lecturer is offered before they choose one. Finance leads the
 * catalog wherever it is still offered, because it is what every build that
 * predates explicit selection ran with; otherwise the catalog's own first entry
 * stands in, so a deployment shipping a different catalog still opens on a
 * usable pair instead of an empty control.
 */
export function suggestedKbDomain(
  options: readonly KbDomainOption[]
): { id: string; version: number; language: DomainGenerationLanguage } | null {
  const finance = options
    .filter((option) => option.id === DEFAULT_DOMAIN_POLICY_ID)
    .reduce<KbDomainOption | null>(
      (latest, option) =>
        latest == null || option.version > latest.version ? option : latest,
      null
    )
  const preferred = finance ?? options.at(0)
  if (!preferred) return null
  const language = kbDomainOptionServesLanguage(
    preferred,
    DEFAULT_DOMAIN_GENERATION_LANGUAGE
  )
    ? DEFAULT_DOMAIN_GENERATION_LANGUAGE
    : preferred.languages
        .map((entry) => entry.language)
        .find(isDomainGenerationLanguage)
  if (!language) return null
  return { id: preferred.id, version: preferred.version, language }
}
