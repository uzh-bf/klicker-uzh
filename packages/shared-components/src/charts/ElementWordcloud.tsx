import {
  type ElementInstanceEvaluation,
  ElementType,
} from '@klicker-uzh/graphql/dist/ops'
import { CHART_COLORS } from '@klicker-uzh/shared-components/src/constants'
import type { LayoutWord } from '@klicker-uzh/word-cloud'
import { Select, Tooltip, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  removeStopwords,
  deu as stopwordsDeu,
  eng as stopwordsEng,
} from 'stopword'
import { twMerge } from 'tailwind-merge'
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

/**
 * Get word frequencies from the provided data, applying the selected filters.
 */
function getWordFrequencies({
  data,
  stopwords,
  splitMode,
}: {
  data: WordCloudFrequency[]
  stopwords: string[]
  splitMode: WordCloudSplitMode
}) {
  const frequencies: Record<string, number> = {}

  data.forEach((response) => {
    if (splitMode === WordCloudSplitMode.SENTENCES) {
      const sentence = response.value.trim()
      if (sentence) {
        frequencies[sentence] = (frequencies[sentence] || 0) + response.count
      }
    } else {
      const words = response.value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9äöüß\s'-]/g, '')
        .split(/\s+/)
      for (const word of words) {
        if (word.length === 0) continue
        const filtered =
          stopwords.length > 0 ? removeStopwords([word], stopwords)[0] : word
        if (!filtered) continue
        frequencies[filtered] = (frequencies[filtered] || 0) + 1
      }
    }
  })

  return frequencies
}

interface ElementWordCloudProps {
  instance: ElementInstanceEvaluation
  showSolution: boolean
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
  showSolution,
  showExplanation,
  textSize,
  className,
  locale,
}: ElementWordCloudProps) {
  const t = useTranslations()

  const [language, setLanguage] = useState<WordCloudLanguage>(
    WordCloudLanguage.EN
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

  // ensure min and max respect constraints
  useEffect(() => {
    if (minTextSize > maxTextSize) {
      setMaxTextSize(minTextSize)
    }
  }, [minTextSize, setMaxTextSize])
  useEffect(() => {
    if (maxTextSize < minTextSize) {
      setMinTextSize(maxTextSize)
    }
  }, [maxTextSize, setMinTextSize])

  // check if element type is supported
  const supportedElementTypes = [ElementType.Numerical, ElementType.FreeText]
  if (!supportedElementTypes.includes(instance.type)) {
    return (
      <UserNotification type="warning">
        {t('manage.evaluation.chartTypeNotSupported')}
      </UserNotification>
    )
  }

  // prepare data to process
  const data =
    instance.__typename === 'NumericalActivityEvaluationData'
      ? instance.results.responseValues.map((response) => ({
          value: String(response.value),
          count: response.count,
        }))
      : instance.__typename === 'FreeTextActivityEvaluationData'
        ? instance.results.responses
        : []

  const noResponsesReceived = data.length === 0

  // for Standard filtering, use predefined stopword lists (empty = disabled)
  const stopwords =
    language === WordCloudLanguage.EN
      ? stopwordsEng
      : language === WordCloudLanguage.DE
        ? stopwordsDeu
        : []

  // determine frequencies of responses
  const frequencies = useMemo(
    () =>
      getWordFrequencies({
        data,
        stopwords,
        splitMode,
      }),
    [data, splitMode, stopwords]
  )

  // transform to format required by react-wordcloud
  const processedData = useMemo(
    () =>
      Object.entries(frequencies).map(([value, count]) => ({
        text: value,
        value: count,
      })),
    [frequencies]
  )
  const getWordTooltipHtml = useCallback(
    (word: Pick<LayoutWord, 'text' | 'value'>) =>
      `<div style="text-align:center; background-color: ${BACKGROUND_COLOR_TOOLTIP}; padding: 5px 15px; opacity: 0.85; border-radius: 10px; font-size: 22px;"><strong>${word.text}</strong><br/>${t('manage.evaluation.numberOfVotes', { number: word.value })}</div>`,
    [t]
  )

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
                transitionDuration={350}
                rotationAngles={
                  splitMode === WordCloudSplitMode.SENTENCES ? [0, 0] : [0, -90]
                }
                getWordTooltip={getWordTooltipHtml}
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
            {omittedCount > 0 && (
              <p className="text-sm text-gray-500">
                {splitMode === WordCloudSplitMode.SENTENCES
                  ? t('manage.evaluation.wordCloudOmittedSentences', {
                      count: omittedCount,
                    })
                  : t('manage.evaluation.wordCloudOmittedWords', {
                      count: omittedCount,
                    })}
              </p>
            )}
          </div>
          <div className="flex flex-row items-end gap-5">
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
            {instance.type === ElementType.FreeText && (
              <div className="flex flex-col gap-1">
                <span className="text-sm font-bold">
                  {t('manage.evaluation.wordCloudFilterMode')}
                </span>
                <Select
                  value={splitMode}
                  items={[
                    {
                      value: WordCloudSplitMode.WORDS,
                      label: t('manage.evaluation.wordCloudModeWords'),
                    },
                    {
                      value: WordCloudSplitMode.SENTENCES,
                      label: t('manage.evaluation.wordCloudModeSentences'),
                    },
                  ]}
                  onChange={(val) => setSplitMode(val as WordCloudSplitMode)}
                />
              </div>
            )}
            {instance.type === ElementType.FreeText &&
              splitMode === WordCloudSplitMode.WORDS && (
                <div className="flex flex-col gap-1">
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
                    value={language}
                    items={[
                      {
                        value: WordCloudLanguage.NONE,
                        label: t('manage.evaluation.wordCloudLanguageNone'),
                      },
                      { value: WordCloudLanguage.EN, label: 'EN' },
                      { value: WordCloudLanguage.DE, label: 'DE' },
                    ]}
                    onChange={(val) => setLanguage(val as WordCloudLanguage)}
                    className={{ trigger: 'w-28' }}
                  />
                </div>
              )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ElementWordCloud
