import { ElementType } from '@klicker-uzh/graphql/dist/ops'
import {
  Button,
  Checkbox,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Separator,
  Tooltip,
} from '@uzh-bf/design-system'
import { useEffect, useState } from 'react'

const checkboxGroups = {
  '👤 Nouns and Entities': [
    { id: 'noun', label: 'Noun', tag: '#Noun', example: ['dog', 'computer'] },
    // { id: 'singular', label: 'Singular', tag: '#Singular', example: ['car', 'book'] },
    // { id: 'plural', label: 'Plural', tag: '#Plural', example: ['cars', 'books'] },
    {
      id: 'propernoun',
      label: 'Proper Noun',
      tag: '#ProperNoun',
      example: ['Eiffel Tower', 'Harry Potter'],
    },
    {
      id: 'person',
      label: 'Person',
      tag: '#Person',
      example: ['John', 'Sarah'],
    },
    {
      id: 'place',
      label: 'Place',
      tag: '#Place',
      example: ['Paris', 'New York'],
    },
    {
      id: 'organization',
      label: 'Organization',
      tag: '#Organization',
      example: ['Google', 'United Nations'],
    },
    {
      id: 'demonym',
      label: 'Demonym',
      tag: '#Demonym',
      example: ['American', 'Swiss'],
    },
    {
      id: 'pronoun',
      label: 'Pronoun',
      tag: '#Pronoun',
      example: ['he', 'they'],
    },
    // { id: 'possessive', label: 'Possessive', tag: '#Possessive', example: ["John's", "dog’s"] },
    {
      id: 'honorific',
      label: 'Honorific',
      tag: '#Honorific',
      example: ['Dr.', 'Mr.'],
    },
  ],
  '🗣️ Verbs and Actions': [
    { id: 'verb', label: 'Verb', tag: '#Verb', example: ['run', 'think'] },
    // { id: 'infinitive', label: 'Infinitive', tag: '#Infinitive', example: ['to eat', 'to go'] },
    // {
    //   id: 'presenttense',
    //   label: 'Present Tense',
    //   tag: '#PresentTense',
    //   example: ['walks', 'runs'],
    // },
    // { id: 'pasttense', label: 'Past Tense', tag: '#PastTense', example: ['walked', 'ran'] },
    // {
    //   id: 'futuretense',
    //   label: 'Future Tense',
    //   tag: '#FutureTense',
    //   example: ['will go', 'shall see'],
    // },
    // { id: 'gerund', label: 'Gerund', tag: '#Gerund', example: ['running', 'thinking'] },
    // { id: 'participle', label: 'Participle', tag: '#Participle', example: ['broken', 'fallen'] },
    { id: 'modal', label: 'Modal', tag: '#Modal', example: ['can', 'should'] },
    {
      id: 'copula',
      label: 'Copula',
      tag: '#Copula',
      example: ['is', 'were'],
    },
    // {
    //   id: 'phrasalverb',
    //   label: 'Phrasal Verb',
    //   tag: '#PhrasalVerb',
    //   example: ['wake up', 'turn off'],
    // },
    // { id: 'negative', label: 'Negative', tag: '#Negative', example: ["don’t", "isn’t"] },
  ],
  '🎯 Adjectives and Adverbs': [
    {
      id: 'adjective',
      label: 'Adjective',
      tag: '#Adjective',
      example: ['blue', 'happy'],
    },
    // {
    //   id: 'comparative',
    //   label: 'Comparative',
    //   tag: '#Comparative',
    //   example: ['bigger', 'smarter'],
    // },
    // {
    //   id: 'superlative',
    //   label: 'Superlative',
    //   tag: '#Superlative',
    //   example: ['biggest', 'smartest'],
    // },
    {
      id: 'adverb',
      label: 'Adverb',
      tag: '#Adverb',
      example: ['quickly', 'silently'],
    },
    {
      id: 'degree',
      label: 'Degree',
      tag: '#Degree',
      example: ['very', 'extremely'],
    },
    { id: 'color', label: 'Color', tag: '#Color', example: ['red', 'green'] },
    // { id: 'value', label: 'Value', tag: '#Value', example: ['ten', 'hundred'] },
  ],
  '⏰ Dates, Times, and Durations': [
    {
      id: 'date',
      label: 'Date',
      tag: '#Date',
      example: ['January 5th', 'tomorrow'],
    },
    { id: 'time', label: 'Time', tag: '#Time', example: ['5pm', 'noon'] },
    {
      id: 'duration',
      label: 'Duration',
      tag: '#Duration',
      example: ['two hours', 'a week'],
    },
    {
      id: 'month',
      label: 'Month',
      tag: '#Month',
      example: ['April', 'December'],
    },
    {
      id: 'weekday',
      label: 'Weekday',
      tag: '#WeekDay',
      example: ['Monday', 'Friday'],
    },
    { id: 'year', label: 'Year', tag: '#Year', example: ['2025', '1990'] },
    {
      id: 'holiday',
      label: 'Holiday',
      tag: '#Holiday',
      example: ['Christmas', 'Easter'],
    },
  ],
  '💰 Numbers': [
    { id: 'value', label: 'Value', tag: '#Value', example: ['5', '100'] },
    {
      id: 'ordinal',
      label: 'Ordinal',
      tag: '#Ordinal',
      example: ['1st', 'second'],
    },
    {
      id: 'fraction',
      label: 'Fraction',
      tag: '#Fraction',
      example: ['1/2', 'three quarters'],
    },
    { id: 'money', label: 'Money', tag: '#Money', example: ['$5', '20 euros'] },
    { id: 'unit', label: 'Unit', tag: '#Unit', example: ['meters', 'kg'] },
    {
      id: 'percent',
      label: 'Percent',
      tag: '#Percent',
      example: ['50%', 'ten percent'],
    },
    {
      id: 'range',
      label: 'Range',
      tag: '#Range',
      example: ['5–10', 'between 3 and 8'],
    },
  ],
  '🏗️ Grammar and Structure': [
    {
      id: 'determiner',
      label: 'Determiner',
      tag: '#Determiner',
      example: ['the', 'some'],
    },
    {
      id: 'preposition',
      label: 'Preposition',
      tag: '#Preposition',
      example: ['in', 'under'],
    },
    {
      id: 'conjunction',
      label: 'Conjunction',
      tag: '#Conjunction',
      example: ['and', 'but'],
    },
    {
      id: 'particle',
      label: 'Particle',
      tag: '#Particle',
      example: ['up', 'off'],
    },
    {
      id: 'questionword',
      label: 'Question Word',
      tag: '#QuestionWord',
      example: ['who', 'what'],
    },
    {
      id: 'condition',
      label: 'Condition',
      tag: '#Condition',
      example: ['if', 'unless'],
    },
  ],
  //   '🧱 Syntax and Sentences': [
  //     {
  //       id: 'clause',
  //       label: 'Clause',
  //       tag: '#Clause',
  //       example: ['She runs fast', 'He likes apples'],
  //     },
  //     {
  //       id: 'sentence',
  //       label: 'Sentence',
  //       tag: '#Sentence',
  //       example: ['I love cats.', 'This is fun.'],
  //     },
  //     {
  //       id: 'negative',
  //       label: 'Negative',
  //       tag: '#Negative',
  //       example: ['not', 'never'],
  //     },
  //     {
  //       id: 'contraction',
  //       label: 'Contraction',
  //       tag: '#Contraction',
  //       example: ["isn't", 'they’re'],
  //     },
  //     {
  //       id: 'parenthetical',
  //       label: 'Parenthetical',
  //       tag: '#Parenthetical',
  //       example: ['(for example)', '(i.e.)'],
  //     },
  //   ],
  '💬 Quoted or Informal Language': [
    {
      id: 'quotation',
      label: 'Quotation',
      tag: '#Quotation',
      example: ['"Hello world"', '"Nice to meet you"'],
    },
    { id: 'emoji', label: 'Emoji', tag: '#Emoji', example: ['😊', '😂'] },
    {
      id: 'url',
      label: 'URL',
      tag: '#Url',
      example: ['https://openai.com', 'https://example.com'],
    },
    {
      id: 'email',
      label: 'Email',
      tag: '#Email',
      example: ['info@example.com', 'test@mail.com'],
    },
    {
      id: 'hashtag',
      label: 'Hashtag',
      tag: '#HashTag',
      example: ['#NLP', '#React'],
    },
    {
      id: 'atmention',
      label: 'At Mention',
      tag: '#AtMention',
      example: ['@some.person', '@user123'],
    },
  ],
  '🧩 Custom and Semantic': [
    {
      id: 'acronym',
      label: 'Acronym',
      tag: '#Acronym',
      example: ['NASA', 'UNICEF'],
    },
    {
      id: 'abbreviation',
      label: 'Abbreviation',
      tag: '#Abbreviation',
      example: ['Dr.', 'St.'],
    },
    {
      id: 'romannumeral',
      label: 'Roman Numeral',
      tag: '#RomanNumeral',
      example: ['IV', 'XII'],
    },
    {
      id: 'product',
      label: 'Product',
      tag: '#Product',
      example: ['iPhone', 'Windows'],
    },
    {
      id: 'event',
      label: 'Event',
      tag: '#Event',
      example: ['World Cup', 'Comic-Con'],
    },
    {
      id: 'titlecase',
      label: 'Title Case',
      tag: '#TitleCase',
      example: ['The Great Gatsby', 'War and Peace'],
    },
  ],
  //   '📖 Document and Discourse': [
  //     {
  //       id: 'section',
  //       label: 'Section',
  //       tag: '#Section',
  //       example: ['Introduction', 'Conclusion'],
  //     },
  //     {
  //       id: 'paragraph',
  //       label: 'Paragraph',
  //       tag: '#Paragraph',
  //       example: ['First paragraph', 'Second paragraph'],
  //     },
  //     {
  //       id: 'title',
  //       label: 'Title',
  //       tag: '#Title',
  //       example: ['React Security Guide', 'NLP Overview'],
  //     },
  //     { id: 'list', label: 'List', tag: '#List', example: ['1.', '•'] },
  //     {
  //       id: 'topic',
  //       label: 'Topic',
  //       tag: '#Topic',
  //       example: ['Machine Learning', 'Linguistics'],
  //     },
  //   ],
}

interface WordCloudFilterProps {
  instanceType?: ElementType
  setWordCloudTags: (newTags: string[]) => void
}

export function WordCloudFilter({
  setWordCloudTags,
  instanceType,
}: WordCloudFilterProps) {
  const [checked, setChecked] = useState<Record<string, boolean>>({})

  const toggleCheckbox = (tag: string) => {
    setChecked((prev) => ({ ...prev, [tag]: !prev[tag] }))
  }

  useEffect(() => {
    const selectedTags: string[] = []
    Object.entries(checked).forEach(([tagName, isChecked]) => {
      if (isChecked) {
        selectedTags.push(tagName)
      }
    })
    setWordCloudTags(selectedTags)
  }, [checked])
  // TODO: try with tiny-tagger and nlp.js to support german and englisch
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Tooltip tooltip="Filter by linguistic features (not available for Numerical elements)">
          <Button
            disabled={instanceType && instanceType === ElementType.Numerical}
          >
            Filter
          </Button>
        </Tooltip>
      </PopoverTrigger>
      <PopoverContent className="h-[50vh] w-[20vw] overflow-y-auto">
        {Object.entries(checkboxGroups).map(([category, items], i) => (
          <div key={category}>
            <h3 className="mb-2 text-base font-semibold">{category}</h3>

            <div className="">
              {items.map((item) => (
                <div key={item.id} className="pt-1">
                  <Tooltip tooltip={`e.g. ${item.example.join(', ')}`}>
                    <Checkbox
                      id={item.id}
                      label={item.label}
                      checked={!!checked[item.tag]}
                      onCheck={() => toggleCheckbox(item.tag)}
                    />
                  </Tooltip>
                </div>
              ))}
            </div>

            {/* Separator between categories */}
            {i < Object.keys(checkboxGroups).length - 1 && (
              <Separator className="my-4" />
            )}
          </div>
        ))}
      </PopoverContent>
    </Popover>
  )
}
