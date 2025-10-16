import {
  type ElementInstanceEvaluation,
  ElementType,
} from '@klicker-uzh/graphql/dist/ops'
import { CHART_COLORS } from '@klicker-uzh/shared-components/src/constants'
import { UserNotification } from '@uzh-bf/design-system'
import nlp from 'compromise'
import { useTranslations } from 'next-intl'
import dynamic from 'next/dynamic'
import React, { useEffect, useRef, useState } from 'react'
import {
  removeStopwords,
  deu as stopwordsDeu,
  eng as stopwordsEng,
} from 'stopword'
import { twMerge } from 'tailwind-merge'
import winkTokenizer from 'wink-tokenizer'
import EvaluationExplanation from '../evaluation/EvaluationExplanation'
import FontSizeButtons from '../FontSizeButtons'
import { useTextPresenceObserverWordCloud } from '../hooks/useTextPresenceObserverWordCloud'
import { WordCloudFilter } from '../WordCloudFilter'
const ReactWordcloud = dynamic(() => import('react-wordcloud'), {
  ssr: false,
})

// enums
export enum WordCloudMode {
  STANDARD = 'Standard',
  PREMIUM = 'Premium',
}

export enum WordCloudLanguage {
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
  tags,
  mode,
  applyFilter,
  stopwords,
}: {
  data: WordCloudFrequency[]
  tags: string[]
  mode: WordCloudMode
  applyFilter: boolean
  stopwords: string[]
}) {
  const frequencies: Record<string, number> = {}

  data.forEach((response) => {
    if (!applyFilter) {
      // no filter, just split sentences (for better visibility)
      const regex = /[^.;:!?]+[.;:!?]+(?=\s|$)/g
      const sentences = response.value.match(regex)?.map((s) => s.trim())

      if (!sentences) {
        frequencies[response.value] =
          (frequencies[response.value] || 0) + response.count
        return
      }

      for (const sentence of sentences) {
        frequencies[sentence] = (frequencies[sentence] || 0) + response.count
      }
    } else {
      // filter by tags
      if (mode === WordCloudMode.STANDARD) {
        // handle stop words separately
        const filterStopWords = tags.includes('stopword')
        const tagsWithoutStopWord = tags.filter((t) => t !== 'stopword')

        const tokenizer = new winkTokenizer()
        let tokens = tokenizer
          .tokenize(response.value)
          .filter(
            (t) =>
              tagsWithoutStopWord.includes(t.tag) ||
              (filterStopWords && stopwords.includes(t.value.toLowerCase()))
          )
          .map((t) => t.value.toLowerCase())

        // unless stopwords are explicitly filtered, remove them
        if (!filterStopWords) {
          tokens = removeStopwords(tokens, stopwords)
        }
        const uniqueWords = Array.from(new Set(tokens)) // keep only unique tokens
        for (const word of uniqueWords) {
          frequencies[word] = (frequencies[word] || 0) + response.count
        }
      } else {
        const doc = nlp(response.value)
        const words = tags
          .flatMap((tag) => doc.match(tag).out('array'))
          .map((w) => w.toLowerCase())

        const uniqueWords = Array.from(new Set(words)) // keep only unique tokens
        for (const word of uniqueWords) {
          frequencies[word] = (frequencies[word] || 0) + response.count
        }
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

  const [tags, setTags] = useState<string[]>([])
  const [language, setLanguage] = useState<WordCloudLanguage>(
    WordCloudLanguage.EN
  )
  const [mode, setMode] = useState<WordCloudMode>(WordCloudMode.STANDARD)
  const [minTextSize, setMinTextSize] = useState(
    DEFAULT_MIN_TEXT_SIZE_WORD_CLOUD
  )
  const [maxTextSize, setMaxTextSize] = useState(
    DEFAULT_MAX_TEXT_SIZE_WORD_CLOUD
  )

  // only english is supported in advanced mode
  useEffect(() => {
    if (mode === WordCloudMode.PREMIUM) {
      setLanguage(WordCloudLanguage.EN)
    }
  }, [mode])

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

  // conditions
  const applyFilter = tags && tags.length > 0
  const noResponsesReceived = data.length === 0

  // for Standard filtering, use predefined stopword lists
  const stopwords =
    language === WordCloudLanguage.EN ? stopwordsEng : stopwordsDeu

  // determine frequencies of responses
  const frequencies = getWordFrequencies({
    data,
    tags,
    mode,
    applyFilter,
    stopwords,
  })

  // transform to format required by react-wordcloud
  const processedData = Object.entries(frequencies).map(([value, count]) => ({
    text: value,
    value: count,
  })) // TODO: for complete sentences, this can become quite slow - limit number of visible entries?
  const hasEnoughDataToDisplay = processedData.length > 1

  // when displaying only one answer, do not rotate
  const rotationAngles: [number, number] = [
    0,
    hasEnoughDataToDisplay ? -90 : 0, // applyFilter && hasEnoughDataToDisplay ? -90 : 0, // TODO: maybe don't rotate for sentences
  ]
  // tooltip config
  const callbacks = {
    getWordTooltip: (word: any) =>
      `<div style="text-align:center; background-color: ${BACKGROUND_COLOR_TOOLTIP}; padding: 5px 15px; opacity: 0.85; border-radius: 10px; font-size: 22px;"><strong>${word.text}</strong><br/>${t('manage.evaluation.numberOfVotes', { number: word.value })}</div>`,
    onWordMouseOver: (word: any, event: any) => {
      const el = event.target as SVGTextElement
      el.setAttribute(
        'data-original-transform',
        el.getAttribute('transform') || ''
      )
      el.style.transition = 'transform 0.2s ease, font-weight 0.2s ease'
      el.setAttribute('transform', `${el.getAttribute('transform')} scale(1.1)`)
    },
    onWordMouseOut: (word: any, event: any) => {
      const el = event.target as SVGTextElement
      el.setAttribute(
        'transform',
        el.getAttribute('data-original-transform') || ''
      )
    },
  }

  // detect the word cloud displays any text at all
  const divRef = useRef<HTMLDivElement>(null)
  const hasText = useTextPresenceObserverWordCloud(divRef, [
    processedData,
    minTextSize,
    maxTextSize,
  ])

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
              <div ref={divRef} className="h-full w-full">
                <ReactWordcloud
                  key={`wc-${processedData.length}`}
                  callbacks={callbacks}
                  words={processedData}
                  options={{
                    enableTooltip: true,
                    deterministic: true,
                    randomSeed: '42',
                    padding: 5,
                    rotations: 2,
                    rotationAngles: rotationAngles,
                    fontFamily: WORD_CLOUD_FONT_FAMILY,
                    fontSizes: [minTextSize, maxTextSize],
                    colors: CHART_COLORS,
                    transitionDuration: 350,
                    scale: 'log',
                    spiral: 'archimedean',
                    tooltipOptions: {
                      allowHTML: true,
                      inertia: true,
                      placement: 'top',
                    },
                  }}
                />
              </div>
              {!hasText && (
                <div className="absolute inset-0 z-10 flex h-full w-full items-center justify-center text-center text-xl">
                  {t('manage.evaluation.wordCloudNoResponsesDisplayed')}
                </div>
              )}
            </div>
          ) : (
            <div className="flex h-full w-full items-center justify-center text-center text-xl">
              {noResponsesReceived
                ? t('manage.evaluation.wordCloudNoResponses')
                : t('manage.evaluation.wordCloudNoResponsesFiltered')}
            </div>
          )}
        </div>
        <div className="align-end flex flex-row items-end justify-end gap-5">
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
          {instance.type !== ElementType.Numerical && (
            <WordCloudFilter
              setWordCloudTags={setTags}
              setMode={setMode}
              setLanguage={setLanguage}
              language={language}
              descriptionLanguage={locale}
              instanceType={instance.type}
              mode={mode}
              noResponsesReceived={noResponsesReceived}
            />
          )}
        </div>
      </div>
    </div>
  )
}

export default ElementWordCloud
