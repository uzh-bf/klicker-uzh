import { useMutation, useQuery } from '@apollo/client'
import {
  ElementGenerationBloomLevel,
  ElementGenerationCapabilitiesDocument,
  ElementGenerationDifficultyPreset,
  ElementGenerationLanguage,
  type ElementGenerationSourceScopeInput,
  ElementGenerationSourcesDocument,
  GeneratableElementType,
  StartElementGenerationDocument,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { Button, UserNotification } from '@uzh-bf/design-system'
import { useFormatter, useTranslations } from 'next-intl'
import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import {
  ELEMENT_TYPE_ORDER,
  elementGenerationErrorCode,
} from './elementGenerationTypes'

type SourceScopeValue = ElementGenerationSourceScopeInput & {
  selected: boolean
  pageFromText: string
  pageToText: string
}

const DEFAULT_BLOOM_LEVELS = [
  ElementGenerationBloomLevel.Understand,
  ElementGenerationBloomLevel.Apply,
]

function scopeValues(
  sources: Array<{ resourceId: string }>
): SourceScopeValue[] {
  return sources.map(({ resourceId }) => ({
    resourceId,
    selected: true,
    pageFromText: '',
    pageToText: '',
  }))
}

function optionalPage(value: string) {
  return value === '' ? undefined : Number(value)
}

interface ElementGenerationConfigureProps {
  preselectedKbId?: string
  onStarted: (buildId: string) => Promise<void>
}

export default function ElementGenerationConfigure({
  preselectedKbId,
  onStarted,
}: ElementGenerationConfigureProps) {
  const t = useTranslations('manage.elementGeneration')
  const format = useFormatter()
  const capabilitiesQuery = useQuery(ElementGenerationCapabilitiesDocument)
  const sourcesQuery = useQuery(ElementGenerationSourcesDocument)
  const [startGeneration] = useMutation(StartElementGenerationDocument)
  const [graphBuildId, setGraphBuildId] = useState('')
  const [elementType, setElementType] = useState<GeneratableElementType>(
    GeneratableElementType.Sc
  )
  const [language, setLanguage] = useState<ElementGenerationLanguage>(
    ElementGenerationLanguage.De
  )
  const [elementCount, setElementCount] = useState(6)
  const [difficulty, setDifficulty] =
    useState<ElementGenerationDifficultyPreset>(
      ElementGenerationDifficultyPreset.Mixed
    )
  const [bloomLevels, setBloomLevels] =
    useState<ElementGenerationBloomLevel[]>(DEFAULT_BLOOM_LEVELS)
  const [sourceScopes, setSourceScopes] = useState<SourceScopeValue[]>([])
  const [objectives, setObjectives] = useState<
    Array<{ id: string; text: string }>
  >([])
  const [submitting, setSubmitting] = useState(false)
  const [validationError, setValidationError] = useState<string>()
  const [submissionError, setSubmissionError] = useState<string>()
  const idempotencyRef = useRef<{ input: string; key: string } | undefined>(
    undefined
  )

  const sources = useMemo(
    () => sourcesQuery.data?.elementGenerationSources ?? [],
    [sourcesQuery.data]
  )
  const capabilities = capabilitiesQuery.data?.elementGenerationCapabilities
  const supportedTypes = useMemo(
    () =>
      ELEMENT_TYPE_ORDER.filter((type) =>
        capabilities?.elementTypes.includes(type)
      ),
    [capabilities]
  )
  const selectedSource = sources.find(
    (source) => source.graphBuildId === graphBuildId
  )
  const selectedCapability = capabilities?.typeCapabilities.find(
    (capability) => capability.elementType === elementType
  )

  useEffect(() => {
    if (graphBuildId || sources.length === 0) return
    const source =
      sources.find((candidate) => candidate.kbId === preselectedKbId) ??
      sources[0]
    setGraphBuildId(source.graphBuildId)
    setSourceScopes(scopeValues(source.sources))
  }, [graphBuildId, preselectedKbId, sources])

  useEffect(() => {
    if (supportedTypes.length > 0 && !supportedTypes.includes(elementType)) {
      setElementType(supportedTypes[0])
    }
  }, [elementType, supportedTypes])

  if (capabilitiesQuery.loading || sourcesQuery.loading) {
    return (
      <div className="flex min-h-72 items-center justify-center" role="status">
        <Loader />
      </div>
    )
  }

  if (capabilitiesQuery.error || sourcesQuery.error || !capabilities) {
    return (
      <UserNotification
        type="error"
        message={t('errors.load')}
        data={{ cy: 'element-generation-load-error' }}
      />
    )
  }

  if (!capabilities.configured) {
    return (
      <UserNotification
        type="warning"
        message={t('errors.notConfigured')}
        data={{ cy: 'element-generation-not-configured' }}
      />
    )
  }

  if (sources.length === 0 || supportedTypes.length === 0) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">
          {t('configure.noSources')}
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-slate-600">
          {t('configure.noSourcesHelp')}
        </p>
      </section>
    )
  }

  function selectSource(nextGraphBuildId: string) {
    const source = sources.find(
      (candidate) => candidate.graphBuildId === nextGraphBuildId
    )
    if (!source) return
    setGraphBuildId(nextGraphBuildId)
    setSourceScopes(scopeValues(source.sources))
  }

  function updateScope(index: number, update: Partial<SourceScopeValue>) {
    setSourceScopes((current) =>
      current.map((scope, scopeIndex) =>
        scopeIndex === index ? { ...scope, ...update } : scope
      )
    )
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setValidationError(undefined)
    setSubmissionError(undefined)

    if (!graphBuildId || !selectedCapability) {
      setValidationError(t('validation.sourceRequired'))
      return
    }
    if (
      !Number.isInteger(elementCount) ||
      elementCount < 1 ||
      elementCount > 20
    ) {
      setValidationError(t('validation.countRange'))
      return
    }

    const selectedScopes = sourceScopes.filter((scope) => scope.selected)
    if (
      selectedCapability.supportsSourceScopes &&
      selectedScopes.length === 0
    ) {
      setValidationError(t('validation.sourceScopeRequired'))
      return
    }
    for (const scope of selectedScopes) {
      const hasFrom = scope.pageFromText !== ''
      const hasTo = scope.pageToText !== ''
      if (hasFrom !== hasTo) {
        setValidationError(t('validation.pagePair'))
        return
      }
      if (hasFrom && hasTo) {
        const from = Number(scope.pageFromText)
        const to = Number(scope.pageToText)
        if (from < 1 || to < 1 || from > to) {
          setValidationError(t('validation.pageRange'))
          return
        }
      }
    }
    if (selectedCapability.supportsBloomLevels && bloomLevels.length === 0) {
      setValidationError(t('validation.bloomRequired'))
      return
    }

    const input = {
      graphBuildId,
      elementType,
      language,
      elementCount,
      ...(selectedCapability.supportsDifficulty
        ? { difficultyPreset: difficulty }
        : {}),
      ...(selectedCapability.supportsBloomLevels ? { bloomLevels } : {}),
      ...(selectedCapability.supportsSourceScopes
        ? {
            sourceScopes: selectedScopes.map((scope) => ({
              resourceId: scope.resourceId,
              pageFrom: optionalPage(scope.pageFromText),
              pageTo: optionalPage(scope.pageToText),
            })),
          }
        : {}),
      objectives: objectives
        .map(({ text }) => text.trim())
        .filter(Boolean)
        .map((text) => ({ text })),
    }
    const serialized = JSON.stringify(input)
    if (idempotencyRef.current?.input !== serialized) {
      idempotencyRef.current = {
        input: serialized,
        key: crypto.randomUUID(),
      }
    }

    setSubmitting(true)
    try {
      const result = await startGeneration({
        variables: {
          input: { ...input, idempotencyKey: idempotencyRef.current.key },
        },
      })
      const buildId = result.data?.startElementGeneration.id
      if (!buildId) throw new Error('Element generation did not return a build')
      await onStarted(buildId)
    } catch (error) {
      const code = elementGenerationErrorCode(error)
      setSubmissionError(
        code ? t('errors.withCode', { code }) : t('errors.start')
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form noValidate onSubmit={handleSubmit}>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
            <h2 className="text-xl font-semibold text-slate-900">
              {t('configure.sourceTitle')}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {t('configure.sourceHelp')}
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {sources.map((source) => {
                const checked = graphBuildId === source.graphBuildId
                return (
                  <label
                    key={source.graphBuildId}
                    className={`cursor-pointer rounded-lg border-2 p-4 transition-colors ${
                      checked
                        ? 'border-primary-100 bg-primary-20'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <span className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="graphBuildId"
                        checked={checked}
                        onChange={() => selectSource(source.graphBuildId)}
                        className="accent-primary-100 mt-1 h-4 w-4"
                        data-cy={`element-generation-source-${source.kbId}`}
                      />
                      <span className="min-w-0">
                        <span className="block break-words font-semibold text-slate-900">
                          {source.kbName}
                        </span>
                        <span className="mt-1 block text-xs text-slate-600">
                          {t('configure.sourceCount', {
                            count: source.sourceCount,
                          })}
                        </span>
                        <span className="mt-1 block text-xs text-slate-500">
                          {t('configure.indexedAt', {
                            date: format.dateTime(new Date(source.indexedAt), {
                              dateStyle: 'medium',
                            }),
                          })}
                        </span>
                        {source.isStale ? (
                          <span className="mt-2 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">
                            {t('configure.staleGraph')}
                          </span>
                        ) : null}
                      </span>
                    </span>
                  </label>
                )
              })}
            </div>

            {selectedSource && selectedCapability?.supportsSourceScopes ? (
              <fieldset className="mt-5 border-t border-slate-200 pt-5">
                <legend className="font-semibold text-slate-900">
                  {t('configure.sourceDetails')}
                </legend>
                <div className="mt-3 space-y-3">
                  {selectedSource.sources.map((source, index) => {
                    const scope = sourceScopes[index]
                    if (!scope) return null
                    return (
                      <div
                        key={source.resourceId}
                        className="rounded-lg border border-slate-200 p-3"
                      >
                        <div className="flex items-start gap-3">
                          <input
                            id={`element-generation-scope-${index}`}
                            type="checkbox"
                            checked={scope.selected}
                            onChange={(event) =>
                              updateScope(index, {
                                selected: event.target.checked,
                              })
                            }
                            className="accent-primary-100 mt-1 h-4 w-4"
                            data-cy={`element-generation-scope-${index}`}
                          />
                          <label
                            htmlFor={`element-generation-scope-${index}`}
                            className="min-w-0 flex-1"
                          >
                            <span className="block break-words text-sm font-medium text-slate-900">
                              {source.title}
                            </span>
                            <span className="block break-all text-xs text-slate-500">
                              {source.sourceFile}
                            </span>
                          </label>
                        </div>
                        {scope.selected && source.pageCount ? (
                          <div className="ml-7 mt-3 grid max-w-sm grid-cols-2 gap-3">
                            <label className="text-xs font-medium text-slate-600">
                              {t('configure.pageFrom')}
                              <input
                                type="number"
                                min={1}
                                max={source.pageCount}
                                value={scope.pageFromText}
                                onChange={(event) =>
                                  updateScope(index, {
                                    pageFromText: event.target.value,
                                  })
                                }
                                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                data-cy={`element-generation-page-from-${index}`}
                              />
                            </label>
                            <label className="text-xs font-medium text-slate-600">
                              {t('configure.pageTo')}
                              <input
                                type="number"
                                min={1}
                                max={source.pageCount}
                                value={scope.pageToText}
                                onChange={(event) =>
                                  updateScope(index, {
                                    pageToText: event.target.value,
                                  })
                                }
                                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                data-cy={`element-generation-page-to-${index}`}
                              />
                            </label>
                          </div>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              </fieldset>
            ) : null}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
            <h2 className="text-xl font-semibold text-slate-900">
              {t('configure.elementTypeTitle')}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {t('configure.elementTypeHelp')}
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {supportedTypes.map((type) => {
                const checked = elementType === type
                return (
                  <label
                    key={type}
                    className={`cursor-pointer rounded-lg border-2 p-4 text-center transition-colors ${
                      checked
                        ? 'border-cyan-700 bg-cyan-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="elementType"
                      checked={checked}
                      onChange={() => setElementType(type)}
                      className="sr-only"
                      data-cy={`element-generation-type-${type.toLowerCase()}`}
                    />
                    <span className="inline-flex rounded bg-cyan-700 px-2 py-1 text-xs font-bold text-white">
                      {type}
                    </span>
                    <span className="mt-2 block font-semibold text-slate-900">
                      {t(`elementTypes.${type}.label`)}
                    </span>
                    <span className="mt-1 block text-xs text-slate-600">
                      {t(`elementTypes.${type}.description`)}
                    </span>
                  </label>
                )
              })}
            </div>
          </section>

          {selectedCapability?.supportsBloomLevels ? (
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
              <h2 className="text-xl font-semibold text-slate-900">
                {t('configure.bloomTitle')}
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                {t('configure.bloomHelp')}
              </p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                {capabilities.bloomLevels.map((level) => {
                  const checked = bloomLevels.includes(level)
                  return (
                    <label
                      key={level}
                      className={`cursor-pointer rounded-lg border-2 px-3 py-4 text-center text-sm font-semibold ${
                        checked
                          ? 'border-orange-500 bg-orange-50 text-orange-900'
                          : 'border-slate-200 text-slate-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setBloomLevels((current) =>
                            checked
                              ? current.filter((item) => item !== level)
                              : [...current, level]
                          )
                        }
                        className="sr-only"
                        data-cy={`element-generation-bloom-${level}`}
                      />
                      {t(`bloom.${level}`)}
                    </label>
                  )
                })}
              </div>
            </section>
          ) : null}

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
            <h2 className="text-xl font-semibold text-slate-900">
              {t('configure.settingsTitle')}
            </h2>
            <div className="mt-4 grid gap-5 md:grid-cols-2">
              <label className="text-sm font-semibold text-slate-700">
                {t('configure.elementCount')}
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={elementCount}
                  onChange={(event) =>
                    setElementCount(Number(event.target.value))
                  }
                  className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 font-normal"
                  data-cy="element-generation-count"
                />
              </label>
              <label className="text-sm font-semibold text-slate-700">
                {t('configure.language')}
                <select
                  value={language}
                  onChange={(event) =>
                    setLanguage(event.target.value as ElementGenerationLanguage)
                  }
                  className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 font-normal"
                  data-cy="element-generation-language"
                >
                  {capabilities.languages.map((value) => (
                    <option key={value} value={value}>
                      {t(`language.${value}`)}
                    </option>
                  ))}
                </select>
              </label>
              {selectedCapability?.supportsDifficulty ? (
                <fieldset className="md:col-span-2">
                  <legend className="text-sm font-semibold text-slate-700">
                    {t('configure.difficulty')}
                  </legend>
                  <div className="mt-2 grid max-w-xl grid-cols-3 gap-2">
                    {Object.values(ElementGenerationDifficultyPreset).map(
                      (value) => (
                        <label
                          key={value}
                          className={`cursor-pointer rounded-md border px-3 py-2 text-center text-sm font-medium ${
                            difficulty === value
                              ? 'border-primary-100 bg-primary-20 text-primary-100'
                              : 'border-slate-300 text-slate-700'
                          }`}
                        >
                          <input
                            type="radio"
                            name="difficulty"
                            checked={difficulty === value}
                            onChange={() => setDifficulty(value)}
                            className="sr-only"
                            data-cy={`element-generation-difficulty-${value.toLowerCase()}`}
                          />
                          {t(`difficulty.${value}`)}
                        </label>
                      )
                    )}
                  </div>
                </fieldset>
              ) : null}
            </div>

            <div className="mt-5 border-t border-slate-200 pt-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    {t('configure.objectives')}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {t('configure.objectivesHelp')}
                  </p>
                </div>
                <Button
                  type="button"
                  onClick={() =>
                    setObjectives((current) => [
                      ...current,
                      { id: crypto.randomUUID(), text: '' },
                    ])
                  }
                  data={{ cy: 'element-generation-add-objective' }}
                >
                  <Button.Label>{t('configure.addObjective')}</Button.Label>
                </Button>
              </div>
              <div className="mt-3 space-y-2">
                {objectives.map((objective, index) => (
                  <div key={objective.id} className="flex gap-2">
                    <input
                      type="text"
                      value={objective.text}
                      onChange={(event) =>
                        setObjectives((current) =>
                          current.map((item) =>
                            item.id === objective.id
                              ? { ...item, text: event.target.value }
                              : item
                          )
                        )
                      }
                      className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
                      data-cy={`element-generation-objective-${index}`}
                    />
                    <Button
                      type="button"
                      onClick={() =>
                        setObjectives((current) =>
                          current.filter((item) => item.id !== objective.id)
                        )
                      }
                    >
                      <Button.Label>{t('configure.remove')}</Button.Label>
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>

        <aside className="sticky top-4 rounded-xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
          <h2 className="font-semibold text-slate-900">{t('summary.title')}</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="text-slate-500">{t('summary.source')}</dt>
              <dd className="font-medium text-slate-900">
                {selectedSource?.kbName ?? '—'}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">{t('summary.type')}</dt>
              <dd className="font-medium text-slate-900">
                {t(`elementTypes.${elementType}.label`)}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">{t('summary.count')}</dt>
              <dd className="font-medium text-slate-900">{elementCount}</dd>
            </div>
          </dl>
          {selectedSource?.isStale ? (
            <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              {t('configure.staleGraphHelp')}
            </p>
          ) : null}
          {validationError ? (
            <p className="mt-4 text-sm text-red-700" role="alert">
              {validationError}
            </p>
          ) : null}
          {submissionError ? (
            <p className="mt-4 text-sm text-red-700" role="alert">
              {submissionError}
            </p>
          ) : null}
          <Button
            primary
            type="submit"
            disabled={submitting}
            fluid
            className={{ root: 'mt-5' }}
            data={{ cy: 'element-generation-start' }}
          >
            <Button.Label>
              {submitting ? t('configure.starting') : t('configure.start')}
            </Button.Label>
          </Button>
        </aside>
      </div>
    </form>
  )
}
