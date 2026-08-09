import {
  type ElementInstanceEvaluation,
  ElementType,
} from '@klicker-uzh/graphql/dist/ops'
import type { LayoutWord } from '@klicker-uzh/word-cloud'
import { Select, Tooltip, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  removeStopwords,
  deu as stopwordsDeu,
  eng as stopwordsEng,
} from 'stopword'
import { twMerge } from 'tailwind-merge'
import { CHART_COLORS } from '../constants'
import EvaluationExplanation from '../evaluation/EvaluationExplanation'
import FontSizeButtons from '../FontSizeButtons'
import NativeD3WordCloud from './NativeD3WordCloud'

// enums
export enum WordCloudMode {
  STANDARD = 'Standard',
}

export enum WordCloudSplitMode {
  WORDS = 'words',
  SENTENCES = 'sentences',
}

export enum WordCloudLanguage {
  NONE = 'none',
  EN = 'en',
  DE = 'de',
}

// types
type WordCloudFrequency = {
  value: string
  count: number
}

// constants
const DEFAULT_MIN_TEXT_SIZE_WORD_CLOUD = 16
const DEFAULT_MAX_TEXT_SIZE_WORD_CLOUD = 48
const MIN_TEXT_SIZE_WORD_CLOUD = 8
const MAX_TEXT_SIZE_WORD_CLOUD = 96
const BACKGROUND_COLOR_TOOLTIP = '#dadee2' // = uzh-grey-40
const WORD_CLOUD_FONT_FAMILY = 'arial'
const WORD_CLOUD_TRANSITION_DURATION = 350
const WORD_CLOUD_MAX_WORDS_ALL = 'all'
const WORD_CLOUD_MAX_WORD_OPTIONS = [50, 100, 200] as const
const DEFAULT_WORD_CLOUD_MAX_WORDS = 100
const EMPTY_STOPWORDS: string[] = []

type WordCloudMaxWords =
  | (typeof WORD_CLOUD_MAX_WORD_OPTIONS)[number]
  | typeof WORD_CLOUD_MAX_WORDS_ALL

function getInitialLanguage(locale?: string | null) {
  return locale?.toLowerCase().startsWith('de')
    ? WordCloudLanguage.DE
    : WordCloudLanguage.EN
}

function getMaxWords(value: string) {
  if (value === WORD_CLOUD_MAX_WORDS_ALL) {
    return WORD_CLOUD_MAX_WORDS_ALL
  }

  const parsedValue = Number(value)
  return WORD_CLOUD_MAX_WORD_OPTIONS.includes(
    parsedValue as (typeof WORD_CLOUD_MAX_WORD_OPTIONS)[number]
  )
    ? (parsedValue as (typeof WORD_CLOUD_MAX_WORD_OPTIONS)[number])
    : DEFAULT_WORD_CLOUD_MAX_WORDS
}

/**
 * Get word frequencies from the provided data, applying the selected filters.
 */
function getWordFrequencies({
  data,
  stopwords,
  splitMode,
  elementType,
}: {
  data: WordCloudFrequency[]
  stopwords: string[]
  splitMode: WordCloudSplitMode
  elementType: ElementType
}) {
  const frequencies: Record<string, number> = {}

  data.forEach((response) => {
    if (elementType === ElementType.Numerical) {
      const value = response.value.trim()
      if (value) {
        frequencies[value] = (frequencies[value] || 0) + response.count
      }
      return
    }

    if (splitMode === WordCloudSplitMode.SENTENCES) {
      const sentence = response.value.trim()
      if (sentence) {
        frequencies[sentence] = (frequencies[sentence] || 0) + response.count
      }
    } else {
      const tokens = response.value.trim().toLowerCase().split(/\s+/)
      for (const token of tokens) {
        if (token.length === 0) continue
        const isNumeric = /^[+-]?\d+(?:[.,]\d+)*%?$/.test(token)
        const word = isNumeric ? token : token.replace(/[^a-z0-9äöüß'-]/g, '')
        if (word.length === 0) continue
        const filtered =
          stopwords.length > 0 ? removeStopwords([word], stopwords)[0] : word
        if (!filtered) continue
        frequencies[filtered] = (frequencies[filtered] || 0) + response.count
      }
    }
  })

  return frequencies
}

interface ElementWordCloudProps {
  instance: ElementInstanceEvaluation
  showExplanation: boolean
  textSize: {
    text: string
    textLg: string
    min: number
    max: number
  }
  className?: string
  locale?: string | null
}

function ElementWordCloud({
  instance,
  showExplanation,
  textSize,
  className,
  locale,
}: ElementWordCloudProps) {
  const t = useTranslations()

  const [language, setLanguage] = useState<WordCloudLanguage>(
    getInitialLanguage(locale)
  )
  const [splitMode, setSplitMode] = useState<WordCloudSplitMode>(
    WordCloudSplitMode.WORDS
  )
  const [omittedCount, setOmittedCount] = useState(0)
  const [minTextSize, setMinTextSize] = useState(
    DEFAULT_MIN_TEXT_SIZE_WORD_CLOUD
  )
  const [maxTextSize, setMaxTextSize] = useState(
    DEFAULT_MAX_TEXT_SIZE_WORD_CLOUD
  )
  const [maxWords, setMaxWords] = useState<WordCloudMaxWords>(
    DEFAULT_WORD_CLOUD_MAX_WORDS
  )

  // ensure min and max respect constraints
  useEffect(() => {
    if (minTextSize > maxTextSize) {
      setMaxTextSize(minTextSize)
    }
  }, [maxTextSize, minTextSize])
  useEffect(() => {
    if (maxTextSize < minTextSize) {
      setMinTextSize(maxTextSize)
    }
  }, [maxTextSize, minTextSize])

  const supportedElementTypes = [ElementType.Numerical, ElementType.FreeText]

  // prepare data to process
  const data = useMemo(
    () =>
      instance.__typename === 'NumericalActivityEvaluationData'
        ? instance.results.responseValues.map((response) => ({
            value: String(response.value),
            count: response.count,
          }))
        : instance.__typename === 'FreeTextActivityEvaluationData'
          ? instance.results.responses
          : [],
    [instance]
  )

  const noResponsesReceived = data.length === 0

  // for Standard filtering, use predefined stopword lists (empty = disabled)
  const stopwords = useMemo(
    () =>
      language === WordCloudLanguage.EN
        ? stopwordsEng
        : language === WordCloudLanguage.DE
          ? stopwordsDeu
          : EMPTY_STOPWORDS,
    [language]
  )

  // determine frequencies of responses
  const frequencies = useMemo(
    () =>
      getWordFrequencies({
        data,
        stopwords,
        splitMode,
        elementType: instance.type,
      }),
    [data, instance.type, splitMode, stopwords]
  )

  // transform to format required by the native word-cloud renderer
  const allProcessedData = useMemo(
    () =>
      Object.entries(frequencies)
        .map(([value, count]) => ({
          text: value,
          value: count,
        }))
        .sort(
          (first, second) =>
            second.value - first.value || first.text.localeCompare(second.text)
        ),
    [frequencies]
  )
  const showWordModeOptions =
    instance.type === ElementType.FreeText &&
    splitMode === WordCloudSplitMode.WORDS
  const processedData = useMemo(
    () =>
      !showWordModeOptions || maxWords === WORD_CLOUD_MAX_WORDS_ALL
        ? allProcessedData
        : allProcessedData.slice(0, maxWords),
    [allProcessedData, maxWords, showWordModeOptions]
  )
  const limitedCount = allProcessedData.length - processedData.length
  const getWordTooltipContent = useCallback(
    (word: Pick<LayoutWord, 'text' | 'value'>) => {
      const wrapper = document.createElement('div')
      wrapper.style.textAlign = 'center'
      wrapper.style.backgroundColor = BACKGROUND_COLOR_TOOLTIP
      wrapper.style.padding = '5px 15px'
      wrapper.style.opacity = '0.85'
      wrapper.style.borderRadius = '10px'
      wrapper.style.fontSize = '22px'

      const label = document.createElement('strong')
      label.textContent = word.text
      const count = document.createTextNode(
        t('manage.evaluation.numberOfVotes', { number: word.value })
      )

      wrapper.append(label, document.createElement('br'), count)
      return wrapper
    },
    [t]
  )
  const rotationAngles = useMemo<[number, number]>(
    () => (splitMode === WordCloudSplitMode.SENTENCES ? [0, 0] : [0, -90]),
    [splitMode]
  )

  if (!supportedElementTypes.includes(instance.type)) {
    return (
      <UserNotification type="warning">
        {t('manage.evaluation.chartTypeNotSupported')}
      </UserNotification>
    )
  }

  return (
    <div className={twMerge('flex h-full w-full flex-col', className)}>
      <EvaluationExplanation
        explanation={instance.explanation}
        showExplanation={showExplanation}
        textSize={textSize.text}
        textSizeLg={textSize.textLg}
      />
      <div className="flex h-full w-full flex-col gap-2 p-4">
        <div className="h-[90%] w-full flex-1" data-cy="word-cloud">
          {processedData.length > 0 ? (
            <div className="h-full w-full">
              <NativeD3WordCloud
                words={processedData}
                minTextSize={minTextSize}
                maxTextSize={maxTextSize}
                colors={CHART_COLORS}
                fontFamily={WORD_CLOUD_FONT_FAMILY}
                transitionDuration={WORD_CLOUD_TRANSITION_DURATION}
                rotationAngles={rotationAngles}
                getWordTooltip={getWordTooltipContent}
                emptyStateText={t(
                  'manage.evaluation.wordCloudNoResponsesDisplayed'
                )}
                onLayoutChange={(result) =>
                  setOmittedCount(result.omitted.length)
                }
              />
            </div>
          ) : (
            <div className="flex h-full w-full items-center justify-center text-center text-xl">
              {noResponsesReceived
                ? t('manage.evaluation.wordCloudNoResponses')
                : t('manage.evaluation.wordCloudNoResponsesFiltered')}
            </div>
          )}
        </div>
        <div className="flex flex-row items-end justify-between gap-5">
          <div className="flex-1">
            {omittedCount + limitedCount > 0 && (
              <p className="text-sm text-gray-500">
                {splitMode === WordCloudSplitMode.SENTENCES
                  ? t('manage.evaluation.wordCloudOmittedSentences', {
                      count: omittedCount + limitedCount,
                    })
                  : t('manage.evaluation.wordCloudOmittedWords', {
                      count: omittedCount + limitedCount,
                    })}
              </p>
            )}
          </div>
          <div className="flex flex-row items-end gap-5">
            {instance.type === ElementType.FreeText && (
              <div className="flex flex-col gap-1" data-cy="word-cloud-mode">
                <span className="text-sm font-bold">
                  {t('manage.evaluation.wordCloudFilterMode')}
                </span>
                <Select
                  data={{ cy: 'word-cloud-mode-select' }}
                  value={splitMode}
                  items={[
                    {
                      value: WordCloudSplitMode.WORDS,
                      label: t('manage.evaluation.wordCloudModeWords'),
                      data: { cy: 'word-cloud-mode-select-words' },
                    },
                    {
                      value: WordCloudSplitMode.SENTENCES,
                      label: t('manage.evaluation.wordCloudModeSentences'),
                      data: { cy: 'word-cloud-mode-select-sentences' },
                    },
                  ]}
                  onChange={(val) => setSplitMode(val as WordCloudSplitMode)}
                />
              </div>
            )}
            {showWordModeOptions && (
              <>
                <div
                  className="flex flex-col gap-1"
                  data-cy="word-cloud-language-filter"
                >
                  <Tooltip
                    tooltip={t(
                      'manage.evaluation.wordCloudLanguageFilterTooltip'
                    )}
                  >
                    <span className="w-fit cursor-default text-sm font-bold underline decoration-dotted">
                      {t('manage.evaluation.wordCloudLanguageFilter')}
                    </span>
                  </Tooltip>
                  <Select
                    data={{ cy: 'word-cloud-language-select' }}
                    value={language}
                    items={[
                      {
                        value: WordCloudLanguage.NONE,
                        label: t('manage.evaluation.wordCloudLanguageNone'),
                        data: { cy: 'word-cloud-language-select-none' },
                      },
                      {
                        value: WordCloudLanguage.EN,
                        label: 'EN',
                        data: { cy: 'word-cloud-language-select-en' },
                      },
                      {
                        value: WordCloudLanguage.DE,
                        label: 'DE',
                        data: { cy: 'word-cloud-language-select-de' },
                      },
                    ]}
                    onChange={(val) => setLanguage(val as WordCloudLanguage)}
                    className={{ trigger: 'w-28' }}
                  />
                </div>
                <div
                  className="flex flex-col gap-1"
                  data-cy="word-cloud-display-limit"
                >
                  <span className="text-sm font-bold">
                    {t('manage.evaluation.wordCloudDisplayLimit')}
                  </span>
                  <Select
                    value={String(maxWords)}
                    items={[
                      ...WORD_CLOUD_MAX_WORD_OPTIONS.map((option) => ({
                        value: String(option),
                        label: String(option),
                      })),
                      {
                        value: WORD_CLOUD_MAX_WORDS_ALL,
                        label: t('manage.evaluation.wordCloudDisplayLimitAll'),
                      },
                    ]}
                    onChange={(val) => setMaxWords(getMaxWords(String(val)))}
                    className={{ trigger: 'w-24' }}
                  />
                </div>
              </>
            )}
            <FontSizeButtons
              textSize={minTextSize}
              setTextSize={setMinTextSize}
              minTextSize={MIN_TEXT_SIZE_WORD_CLOUD}
              maxTextSize={MAX_TEXT_SIZE_WORD_CLOUD}
              labelPrefix={t('shared.generic.minimum')}
            />
            <FontSizeButtons
              textSize={maxTextSize}
              setTextSize={setMaxTextSize}
              minTextSize={MIN_TEXT_SIZE_WORD_CLOUD}
              maxTextSize={MAX_TEXT_SIZE_WORD_CLOUD}
              labelPrefix={t('shared.generic.maximum')}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default ElementWordCloud
