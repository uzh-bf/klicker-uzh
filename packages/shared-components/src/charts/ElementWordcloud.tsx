import {
  type ElementInstanceEvaluation,
  ElementType,
} from '@klicker-uzh/graphql/dist/ops'
import { CHART_COLORS } from '@klicker-uzh/shared-components/src/constants'
import { Select, UserNotification } from '@uzh-bf/design-system'
import nlp from 'compromise'
import { useTranslations } from 'next-intl'
import dynamic from 'next/dynamic'
import React, { useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import EvaluationExplanation from '../evaluation/EvaluationExplanation'

import {
  removeStopwords,
  deu as stopwordsDeu,
  eng as stopwordsEng,
} from 'stopword'
import winkTokenizer from 'wink-tokenizer'
import { WordCloudFilter } from '../WordCloudFilter'
const ReactWordcloud = dynamic(() => import('react-wordcloud'), {
  ssr: false,
})

interface ElementWordcloudProps {
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

export enum WordCloudMode {
  STANDARD = 'Standard',
  PREMIUM = 'Premium',
}

export enum WordCloudLanguage {
  EN = 'en',
  DE = 'de',
}

function ElementWordcloud({
  instance,
  showSolution,
  showExplanation,
  textSize,
  className,
  locale,
}: ElementWordcloudProps) {
  const t = useTranslations()

  const [tags, setTags] = useState<string[]>([])
  const [language, setLanguage] = useState<WordCloudLanguage>(
    WordCloudLanguage.EN
  )
  const [mode, setMode] = useState<WordCloudMode>(WordCloudMode.STANDARD)

  // only english is supported in advanced mode
  useEffect(() => {
    if (mode === WordCloudMode.PREMIUM) {
      setLanguage(WordCloudLanguage.EN)
    }
  }, [mode])

  const supportedElementTypes = [ElementType.Numerical, ElementType.FreeText]
  if (!supportedElementTypes.includes(instance.type)) {
    return (
      <UserNotification type="warning">
        {t('manage.evaluation.chartTypeNotSupported')}
      </UserNotification>
    )
  }

  const data =
    instance.__typename === 'NumericalActivityEvaluationData'
      ? instance.results.responseValues.map((response) => ({
          value: String(response.value),
          count: response.count,
        }))
      : instance.__typename === 'FreeTextActivityEvaluationData'
        ? instance.results.responses
        : []

  const applyFilter = tags && tags.length > 0

  // for Standard filtering, use predefined stopword lists
  const stopwords =
    language === WordCloudLanguage.EN ? stopwordsEng : stopwordsDeu

  // determine frequencies of responses
  const frequencies: Record<string, number> = {}

  const noResponsesReceived = data.length === 0

  data.forEach((response) => {
    if (!applyFilter) {
      // no filter, just split sentences
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
        const filterStopWords = tags.includes('stopword') // unless stopwords are explicitly filtered, remove them
        for (const tag of tags) {
          const tokenizer = new winkTokenizer()
          let tokens = tokenizer
            .tokenize(response.value)
            .filter((t) => t.tag === tag)
            .map((t) => t.value.toLowerCase())
            .filter(Boolean)
          if (!filterStopWords) {
            tokens = removeStopwords(tokens, stopwords)
          }
          for (const word of tokens) {
            frequencies[word] = (frequencies[word] || 0) + response.count
          }
        }
      } else {
        for (const tag of tags) {
          const doc = nlp(response.value)
          doc
            .match(tag)
            .out('array')
            .forEach((word: string) => {
              frequencies[word] = (frequencies[word] || 0) + response.count
            })
        }
      }
    }
  })

  const processedData = Object.entries(frequencies).map(([value, count]) => ({
    text: value,
    value: count,
  }))

  const hasEnoughDataToDisplay = processedData.length > 1

  // when displaying only one answer, do not rotate
  const rotationAngles: [number, number] = [
    0,
    applyFilter && hasEnoughDataToDisplay ? -90 : 0,
  ]
  const minTextSize = textSize.min
  const maxTextSize = textSize.max
  return (
    <div className={twMerge('flex h-full w-full flex-col', className)}>
      <EvaluationExplanation
        explanation={instance.explanation}
        showExplanation={showExplanation}
        textSize={textSize.text}
        textSizeLg={textSize.textLg}
      />
      <div className="flex h-full w-full flex-col gap-2 p-4">
        {/* TODO: display default message if there is no response yet */}
        <div className="h-[90%] w-full flex-1">
          {processedData.length > 0 ? (
            <ReactWordcloud
              key={`wc-${processedData.length}`}
              words={processedData}
              options={{
                enableTooltip: false,
                deterministic: true,
                randomSeed: '42',
                padding: 5,
                rotations: 2,
                rotationAngles: rotationAngles,
                fontFamily: 'arial',
                fontSizes: [minTextSize, maxTextSize],
                colors: CHART_COLORS,
                transitionDuration: 450,
                scale: 'log',
                spiral: 'archimedean',
              }}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-center text-xl">
              {noResponsesReceived
                ? t('manage.evaluation.wordCloudNoResponses')
                : t('manage.evaluation.wordCloudNoResponsesFiltered')}
            </div>
          )}
        </div>
        {instance.type !== ElementType.Numerical && (
          <div className="pl-8.5 pr-8.5 align-end flex flex-row items-end justify-end gap-5">
            <div className="flex flex-col">
              <div className="pb-1 text-sm font-bold">
                {t('manage.evaluation.wordCloudFilterMode')}
              </div>
              <Select
                contentPosition="popper"
                className={{ trigger: 'w-30' }}
                items={Object.values(WordCloudMode).map((value) => ({
                  label: value,
                  value: value,
                  data: { cy: `change-word-cloud-mode-${value}` },
                  tooltip: t(`manage.evaluation.wordCloudMode${value}Tooltip`),
                }))}
                value={String(mode)}
                onChange={(newValue) => setMode(newValue as WordCloudMode)}
                data={{ cy: 'change-word-cloud-mode' }}
                disabled={noResponsesReceived}
              />
            </div>
            <div>
              <div className="pb-1 text-sm font-bold">
                {t('manage.evaluation.wordCloudLanguageFilter')}
              </div>
              <Select
                contentPosition="popper"
                className={{ trigger: 'w-full' }}
                items={Object.values(WordCloudLanguage).map((value) => ({
                  label: value,
                  value: value,
                  data: { cy: `change-word-cloud-language-${value}` },
                  disabled:
                    mode === WordCloudMode.PREMIUM &&
                    value !== WordCloudLanguage.EN,
                }))}
                value={String(language)}
                onChange={(newValue) =>
                  setLanguage(newValue as WordCloudLanguage)
                }
                data={{ cy: 'change-word-cloud-language' }}
                disabled={noResponsesReceived}
              />
            </div>
            <WordCloudFilter
              setWordCloudTags={setTags}
              language={locale}
              instanceType={instance.type}
              mode={mode}
              noResponsesReceived={noResponsesReceived}
            />
          </div>
        )}
      </div>
    </div>
  )
}

export default ElementWordcloud
