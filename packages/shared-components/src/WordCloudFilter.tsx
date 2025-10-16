import { ElementType } from '@klicker-uzh/graphql/dist/ops'
import {
  WordCloudLanguage,
  WordCloudMode,
} from '@klicker-uzh/shared-components/src/charts/ElementWordcloud'
import {
  Button,
  Checkbox,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  Separator,
} from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import React, { useEffect, useState } from 'react'

type WordCloudTag = {
  id: string
  label: {
    en: string
    de: string
  }
  tag: string
  example: {
    en: string[]
    de: string[]
  }
}

type WordCloudFilterCategory = {
  category: {
    en: string
    de: string
  }
  tags: WordCloudTag[]
}

const tagsAdvanced: WordCloudFilterCategory[] = [
  {
    category: {
      en: '👤 Nouns and Entities',
      de: '👤 Nomen und Entitäten',
    },
    tags: [
      {
        id: 'noun',
        label: {
          en: 'Noun',
          de: 'Nomen',
        },
        tag: '#Noun',
        example: {
          en: ['dog', 'computer'],
          de: ['Hund', 'Computer'],
        },
      },
      {
        id: 'propernoun',
        label: {
          en: 'Proper Noun',
          de: 'Eigenname',
        },
        tag: '#ProperNoun',
        example: {
          en: ['Eiffel Tower', 'Harry Potter'],
          de: ['Eiffelturm', 'Harry Potter'],
        },
      },
      {
        id: 'person',
        label: {
          en: 'Person',
          de: 'Person',
        },
        tag: '#Person',
        example: {
          en: ['John', 'Sarah'],
          de: ['John', 'Sarah'],
        },
      },
      {
        id: 'place',
        label: {
          en: 'Place',
          de: 'Ort',
        },
        tag: '#Place',
        example: {
          en: ['Paris', 'New York'],
          de: ['Paris', 'New York'],
        },
      },
      {
        id: 'organization',
        label: {
          en: 'Organization',
          de: 'Organisation',
        },
        tag: '#Organization',
        example: {
          en: ['Google', 'United Nations'],
          de: ['Google', 'Vereinte Nationen'],
        },
      },
      {
        id: 'demonym',
        label: {
          en: 'Demonym',
          de: 'Demonym',
        },
        tag: '#Demonym',
        example: {
          en: ['American', 'Swiss'],
          de: ['Amerikaner', 'Schweizer'],
        },
      },
      {
        id: 'pronoun',
        label: {
          en: 'Pronoun',
          de: 'Pronomen',
        },
        tag: '#Pronoun',
        example: {
          en: ['he', 'they'],
          de: ['er', 'sie'],
        },
      },
      {
        id: 'honorific',
        label: {
          en: 'Honorific',
          de: 'Honorativ',
        },
        tag: '#Honorific',
        example: {
          en: ['Dr.', 'Mr.'],
          de: ['Dr.', 'Herr.'],
        },
      },
    ],
  },
  {
    category: {
      en: '🗣️ Verbs and Actions',
      de: '🗣️ Verben und Tätigkeiten',
    },
    tags: [
      {
        id: 'verb',
        label: {
          en: 'Verb',
          de: 'Verb',
        },
        tag: '#Verb',
        example: {
          en: ['run', 'think'],
          de: ['laufen', 'denken'],
        },
      },
      {
        id: 'modal',
        label: {
          en: 'Modal',
          de: 'Modalverb',
        },
        tag: '#Modal',
        example: {
          en: ['can', 'should'],
          de: ['können', 'sollten'],
        },
      },
      {
        id: 'copula',
        label: {
          en: 'Copula',
          de: 'Kopula',
        },
        tag: '#Copula',
        example: {
          en: ['is', 'was'],
          de: ['ist', 'war'],
        },
      },
    ],
  },
  {
    category: {
      en: '🎯 Adjectives and Adverbs',
      de: '🎯 Adjektive und Adverbien',
    },
    tags: [
      {
        id: 'adjective',
        label: {
          en: 'Adjective',
          de: 'Adjektiv',
        },
        tag: '#Adjective',
        example: {
          en: ['blue', 'happy'],
          de: ['blau', 'glücklich'],
        },
      },
      {
        id: 'adverb',
        label: {
          en: 'Adverb',
          de: 'Adverb',
        },
        tag: '#Adverb',
        example: {
          en: ['quickly', 'silently'],
          de: ['schnell', 'leise'],
        },
      },
      {
        id: 'degree',
        label: {
          en: 'Degree',
          de: 'Grad',
        },
        tag: '#Degree',
        example: {
          en: ['very', 'extremely'],
          de: ['sehr', 'extrem'],
        },
      },
      {
        id: 'color',
        label: {
          en: 'Color',
          de: 'Farbe',
        },
        tag: '#Color',
        example: {
          en: ['red', 'green'],
          de: ['rot', 'grün'],
        },
      },
    ],
  },
  {
    category: {
      en: '⏰ Dates, Times, and Durations',
      de: '⏰ Daten, Zeiten und Dauern',
    },
    tags: [
      {
        id: 'date',
        label: {
          en: 'Date',
          de: 'Datum',
        },
        tag: '#Date',
        example: {
          en: ['January 5th', 'tomorrow'],
          de: ['5. Januar', 'morgen'],
        },
      },
      {
        id: 'time',
        label: {
          en: 'Time',
          de: 'Zeit',
        },
        tag: '#Time',
        example: {
          en: ['5pm', 'noon'],
          de: ['17 Uhr', 'Mittag'],
        },
      },
      {
        id: 'duration',
        label: {
          en: 'Duration',
          de: 'Dauer',
        },
        tag: '#Duration',
        example: {
          en: ['two hours', 'a week'],
          de: ['zwei Stunden', 'eine Woche'],
        },
      },
      {
        id: 'month',
        label: {
          en: 'Month',
          de: 'Monat',
        },
        tag: '#Month',
        example: {
          en: ['April', 'December'],
          de: ['April', 'Dezember'],
        },
      },
      {
        id: 'weekday',
        label: {
          en: 'Weekday',
          de: 'Wochentag',
        },
        tag: '#WeekDay',
        example: {
          en: ['Monday', 'Friday'],
          de: ['Montag', 'Freitag'],
        },
      },
      {
        id: 'year',
        label: {
          en: 'Year',
          de: 'Jahr',
        },
        tag: '#Year',
        example: {
          en: ['2025', '1990'],
          de: ['2025', '1990'],
        },
      },
      {
        id: 'holiday',
        label: {
          en: 'Holiday',
          de: 'Feiertag',
        },
        tag: '#Holiday',
        example: {
          en: ['Christmas', 'Easter'],
          de: ['Weihnachten', 'Ostern'],
        },
      },
    ],
  },
  {
    category: {
      en: '💰 Numbers',
      de: '💰 Zahlen',
    },
    tags: [
      {
        id: 'value',
        label: {
          en: 'Value',
          de: 'Wert',
        },
        tag: '#Value',
        example: {
          en: ['5', '100'],
          de: ['5', '100'],
        },
      },
      {
        id: 'ordinal',
        label: {
          en: 'Ordinal',
          de: 'Ordinalzahl',
        },
        tag: '#Ordinal',
        example: {
          en: ['1st', 'second'],
          de: ['1.', 'zweite'],
        },
      },
      {
        id: 'fraction',
        label: {
          en: 'Fraction',
          de: 'Bruch',
        },
        tag: '#Fraction',
        example: {
          en: ['1/2', 'three quarters'],
          de: ['1/2', 'drei Viertel'],
        },
      },
      {
        id: 'money',
        label: {
          en: 'Money',
          de: 'Geld',
        },
        tag: '#Money',
        example: {
          en: ['$5', '20 euros'],
          de: ['5$', '20 Euro'],
        },
      },
      {
        id: 'unit',
        label: {
          en: 'Unit',
          de: 'Einheit',
        },
        tag: '#Unit',
        example: {
          en: ['meters', 'kg'],
          de: ['Meter', 'kg'],
        },
      },
      {
        id: 'percent',
        label: {
          en: 'Percent',
          de: 'Prozent',
        },
        tag: '#Percent',
        example: {
          en: ['50%', 'ten percent'],
          de: ['50%', 'zehn Prozent'],
        },
      },
      {
        id: 'range',
        label: {
          en: 'Range',
          de: 'Bereich',
        },
        tag: '#Range',
        example: {
          en: ['5–10', 'between 3 and 8'],
          de: ['5–10', 'zwischen 3 und 8'],
        },
      },
    ],
  },
  {
    category: {
      en: '🏗️ Grammar and Structure',
      de: '🏗️ Grammatik und Struktur',
    },
    tags: [
      {
        id: 'determiner',
        label: {
          en: 'Determiner',
          de: 'Determinator',
        },
        tag: '#Determiner',
        example: {
          en: ['the', 'some'],
          de: ['der', 'einige'],
        },
      },
      {
        id: 'preposition',
        label: {
          en: 'Preposition',
          de: 'Präposition',
        },
        tag: '#Preposition',
        example: {
          en: ['in', 'under'],
          de: ['in', 'unter'],
        },
      },
      {
        id: 'conjunction',
        label: {
          en: 'Conjunction',
          de: 'Konjunktion',
        },
        tag: '#Conjunction',
        example: {
          en: ['and', 'but'],
          de: ['und', 'aber'],
        },
      },
      {
        id: 'particle',
        label: {
          en: 'Particle',
          de: 'Partikel',
        },
        tag: '#Particle',
        example: {
          en: ['up', 'off'],
          de: ['auf', 'aus'],
        },
      },
      {
        id: 'questionword',
        label: {
          en: 'Question Word',
          de: 'Fragewort',
        },
        tag: '#QuestionWord',
        example: {
          en: ['who', 'what'],
          de: ['wer', 'was'],
        },
      },
      {
        id: 'condition',
        label: {
          en: 'Condition',
          de: 'Bedingung',
        },
        tag: '#Condition',
        example: {
          en: ['if', 'unless'],
          de: ['wenn', 'es sei denn'],
        },
      },
    ],
  },
  {
    category: {
      en: '💬 Quoted or Informal Language',
      de: '💬 Zitat oder informelle Sprache',
    },
    tags: [
      {
        id: 'quotation',
        label: {
          en: 'Quotation',
          de: 'Zitat',
        },
        tag: '#Quotation',
        example: {
          en: ['"Hello world"', '"Nice to meet you"'],
          de: ['"Hallo Welt"', '"Freut mich, dich kennenzulernen"'],
        },
      },
      {
        id: 'emoji',
        label: {
          en: 'Emoji',
          de: 'Emoji',
        },
        tag: '#Emoji',
        example: {
          en: ['😊', '😂'],
          de: ['😊', '😂'],
        },
      },
      {
        id: 'url',
        label: {
          en: 'URL',
          de: 'URL',
        },
        tag: '#Url',
        example: {
          en: ['https://google.com', 'https://example.com'],
          de: ['https://google.com', 'https://example.com'],
        },
      },
      {
        id: 'email',
        label: {
          en: 'Email',
          de: 'E-Mail',
        },
        tag: '#Email',
        example: {
          en: ['info@example.com', 'test@mail.com'],
          de: ['info@example.com', 'test@mail.com'],
        },
      },
      {
        id: 'hashtag',
        label: {
          en: 'Hashtag',
          de: 'Hashtag',
        },
        tag: '#HashTag',
        example: {
          en: ['#NLP', '#React'],
          de: ['#NLP', '#React'],
        },
      },
      {
        id: 'atmention',
        label: {
          en: 'At Mention',
          de: 'At-Erwähnung',
        },
        tag: '#AtMention',
        example: {
          en: ['@some.person', '@user123'],
          de: ['@some.person', '@user123'],
        },
      },
    ],
  },
  {
    category: {
      en: '🧩 Custom and Semantic',
      de: '🧩 Benutzerdefiniert und Semantisch',
    },
    tags: [
      {
        id: 'acronym',
        label: {
          en: 'Acronym',
          de: 'Akronym',
        },
        tag: '#Acronym',
        example: {
          en: ['NASA', 'UNICEF'],
          de: ['NASA', 'UNICEF'],
        },
      },
      {
        id: 'abbreviation',
        label: {
          en: 'Abbreviation',
          de: 'Abkürzung',
        },
        tag: '#Abbreviation',
        example: {
          en: ['Dr.', 'St.'],
          de: ['Dr.', 'St.'],
        },
      },
      {
        id: 'romannumeral',
        label: {
          en: 'Roman Numeral',
          de: 'Römische Zahl',
        },
        tag: '#RomanNumeral',
        example: {
          en: ['IV', 'XII'],
          de: ['IV', 'XII'],
        },
      },
      {
        id: 'product',
        label: {
          en: 'Product',
          de: 'Produkt',
        },
        tag: '#Product',
        example: {
          en: ['iPhone', 'Windows'],
          de: ['iPhone', 'Windows'],
        },
      },
      {
        id: 'event',
        label: {
          en: 'Event',
          de: 'Ereignis',
        },
        tag: '#Event',
        example: {
          en: ['World Cup', 'Comic-Con'],
          de: ['Weltmeisterschaft', 'Comic-Con'],
        },
      },
      {
        id: 'titlecase',
        label: {
          en: 'Title Case',
          de: 'Titelcase',
        },
        tag: '#TitleCase',
        example: {
          en: ['The Great Gatsby', 'War and Peace'],
          de: ['Der große Gatsby', 'Krieg und Frieden'],
        },
      },
    ],
  },
]

const tagsBasic: WordCloudFilterCategory[] = [
  {
    category: {
      en: '🗣️ Words and Numbers',
      de: '🗣️ Wörter und Zahlen',
    },
    tags: [
      {
        id: 'word',
        label: {
          en: 'Word',
          de: 'Wort',
        },
        tag: 'word',
        example: {
          en: ['dog', 'computer'],
          de: ['Hund', 'Computer'],
        },
      },
      {
        id: 'ordinal',
        label: {
          en: 'Ordinal',
          de: 'Ordinalzahl',
        },
        tag: 'ordinal',
        example: {
          en: ['1st', '2nd', '3rd'],
          de: ['1.', '2.', '3.'],
        },
      },
      {
        id: 'number',
        label: {
          en: 'Number',
          de: 'Zahl',
        },
        tag: 'number',
        example: {
          en: ['42', '3.14'],
          de: ['42', '3.14'],
        },
      },
      {
        id: 'stopword',
        label: {
          en: 'Stop Word',
          de: 'Stoppwort',
        },
        tag: 'stopword',
        example: {
          en: ['of', 'is'],
          de: ['von', 'ist'],
        },
      },
    ],
  },
  {
    category: {
      en: '💬 Digital Text Features',
      de: '💬 Digitale Textmerkmale',
    },
    tags: [
      {
        id: 'url',
        label: {
          en: 'URL',
          de: 'URL',
        },
        tag: 'url',
        example: {
          en: ['https://manage.klicker.uzh.ch', 'https://example.com'],
          de: ['https://manage.klicker.uzh.ch', 'https://example.com'],
        },
      },
      {
        id: 'mention',
        label: {
          en: 'Mention',
          de: 'Erwähnung',
        },
        tag: 'mention',
        example: {
          en: ['@mention'],
          de: ['@Erwähnung'],
        },
      },
      {
        id: 'hashtag',
        label: {
          en: 'Hashtag',
          de: 'Hashtag',
        },
        tag: 'hashtag',
        example: {
          en: ['#dog', '#computer'],
          de: ['#Hund', '#Computer'],
        },
      },
      {
        id: 'email',
        label: {
          en: 'Email',
          de: 'E-Mail',
        },
        tag: 'email',
        example: {
          en: ['example@example.com', 'user@domain.com'],
          de: ['max@mustermann.com', 'user@domain.com'],
        },
      },
    ],
  },
  {
    category: {
      en: '😀 Visual',
      de: '😀 Visuell',
    },
    tags: [
      {
        id: 'emoticon',
        label: {
          en: 'Emoticon',
          de: 'Emoticon',
        },
        tag: 'emoticon',
        example: {
          en: [':-)', ':D'],
          de: [':-)', ':D'],
        },
      },
      {
        id: 'emoji',
        label: {
          en: 'Emoji',
          de: 'Emoji',
        },
        tag: 'emoji',
        example: {
          en: ['😊', '😂'],
          de: ['😊', '😂'],
        },
      },
    ],
  },
  {
    category: {
      en: '✍️ Structural / Punctuation',
      de: '✍️ Strukturell / Interpunktion',
    },
    tags: [
      {
        id: 'punctuation',
        label: {
          en: 'Punctuation',
          de: 'Interpunktion',
        },
        tag: 'punctuation',
        example: {
          en: ['.', '!', '?'],
          de: ['.', '!', '?'],
        },
      },
      {
        id: 'currency',
        label: {
          en: 'Currency',
          de: 'Währung',
        },
        tag: 'currency',
        example: {
          en: ['€', '$'],
          de: ['€', '$'],
        },
      },
      {
        id: 'symbol',
        label: {
          en: 'Symbol',
          de: 'Symbol',
        },
        tag: 'symbol',
        example: {
          en: ['$', '%', '&'],
          de: ['$', '%', '&'],
        },
      },
    ],
  },
]

interface WordCloudFilterProps {
  instanceType: ElementType
  mode: WordCloudMode
  language: WordCloudLanguage
  descriptionLanguage?: string | null
  noResponsesReceived: boolean
  setWordCloudTags: (newTags: string[]) => void
  setMode: (newMode: WordCloudMode) => void
  setLanguage: (newLanguage: WordCloudLanguage) => void
}

export function WordCloudFilter({
  instanceType,
  mode,
  language,
  noResponsesReceived,
  setWordCloudTags,
  setMode,
  setLanguage,
}: WordCloudFilterProps) {
  const t = useTranslations()

  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [selectAll, setSelectAll] = useState(false)

  const tagCategorites =
    mode === WordCloudMode.STANDARD ? tagsBasic : tagsAdvanced
  const numSeparators = tagCategorites.length - 1
  const isEnglish = !language || language === 'en' // default to English
  const allTags = tagCategorites.flatMap((cat) =>
    cat.tags.map((tag) => tag.tag)
  )

  // initialize checked state
  useEffect(() => {
    setChecked(() => ({
      ...allTags.reduce((acc, tag) => ({ ...acc, [tag]: false }), {}),
    }))
  }, [mode])

  // update selected tags when checked state changes
  useEffect(() => {
    const selectedTags: string[] = []
    Object.entries(checked).forEach(([tagName, isChecked]) => {
      if (isChecked) {
        selectedTags.push(tagName)
      }
    })
    setWordCloudTags(selectedTags)
  }, [checked])

  // update all checkboxes when selectAll changes
  useEffect(() => {
    setChecked(() => ({
      ...allTags.reduce((acc, tag) => ({ ...acc, [tag]: selectAll }), {}),
    }))
  }, [selectAll, setChecked])

  const toggleCheckbox = (tag: string) => {
    setChecked((prev) => ({ ...prev, [tag]: !prev[tag] }))
  }

  if (instanceType === ElementType.Numerical) {
    return null // nothing to filter for numerical elements
  }

  return (
    <>
      <div className="flex flex-col gap-1">
        <div className="flex-1 text-sm font-bold">
          {t('manage.evaluation.wordCloudFilterMode')}
        </div>
        <Select
          contentPosition="popper"
          className={{ trigger: 'w-30 flex-1' }}
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
      <div className="flex flex-col gap-1">
        <div className="flex-1 text-sm font-bold">
          {t('manage.evaluation.wordCloudLanguageFilter')}
        </div>
        <Select
          contentPosition="popper"
          className={{ trigger: 'w-full flex-1' }}
          items={Object.values(WordCloudLanguage).map((value) => ({
            label: value,
            value: value,
            data: { cy: `change-word-cloud-language-${value}` },
            disabled:
              mode === WordCloudMode.PREMIUM && value !== WordCloudLanguage.EN,
          }))}
          value={String(language)}
          onChange={(newValue) => setLanguage(newValue as WordCloudLanguage)}
          data={{ cy: 'change-word-cloud-language' }}
          disabled={noResponsesReceived}
        />
      </div>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            className={{ root: 'w-16 border-slate-400' }}
            variant="outline"
            disabled={noResponsesReceived}
            data={{ cy: 'word-cloud-filter-button' }}
          >
            {t('shared.generic.filter')}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="h-[50vh] w-full overflow-y-auto">
          <Checkbox
            label={'Select All'}
            checked={selectAll}
            onCheck={() => setSelectAll(!selectAll)}
            data={{ cy: 'word-cloud-filter-select-all' }}
          />
          <Separator className="my-4" />
          {tagCategorites.map((filterCategory, categoryIndex) => {
            const categoryName = isEnglish
              ? filterCategory.category.en
              : filterCategory.category.de
            return (
              <div key={categoryName}>
                <h3 className="mb-2 text-base font-semibold">{categoryName}</h3>

                <div className="">
                  {filterCategory.tags.map((tag) => {
                    const tagExample = isEnglish
                      ? tag.example.en
                      : tag.example.de
                    const tagLabel = isEnglish ? tag.label.en : tag.label.de
                    const label = `${tagLabel} (${`${t('shared.generic.listExamples')} ${tagExample.join(', ')}`})`
                    return (
                      <div key={tag.id} className="pt-1">
                        <Checkbox
                          id={tag.id}
                          label={label}
                          checked={!!checked[tag.tag]}
                          onCheck={() => toggleCheckbox(tag.tag)}
                          data={{ cy: `word-cloud-filter-tag-${tag.id}` }}
                        />
                      </div>
                    )
                  })}
                </div>

                {/* Separator between categories */}
                {categoryIndex < numSeparators && (
                  <Separator className="my-4" />
                )}
              </div>
            )
          })}
        </PopoverContent>
      </Popover>
    </>
  )
}
