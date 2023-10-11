import {
  ElementType,
  InstanceEvaluation,
  NumericalQuestionData,
} from '@klicker-uzh/graphql/dist/ops'
import Histogram from '@klicker-uzh/shared-components/src/Histogram'
import {} from '@type/app'
import { Progress } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'

interface Props {
  questionType: string
  options: any
  evaluation: InstanceEvaluation
  reference?: string
}

function EvaluationDisplay({
  options,
  questionType,
  evaluation,
  reference,
}: Props) {
  const t = useTranslations()

  switch (questionType) {
    case ElementType.Sc: {
      const sum = Object.values(
        evaluation.choices as Record<string, number>
      ).reduce((acc, choice) => acc + choice, 0)

      const correctIx = options.choices.findIndex(
        (choice: any) => choice.correct
      )

      return (
        <div className="space-y-2">
          <div className="font-bold">
            {t('pwa.learningElement.othersAnswered')}
          </div>
          {Object.entries(evaluation.choices as Record<string, number>).map(
            ([ix, value]) => (
              <Progress
                isMaxVisible={false}
                className={{
                  root: twMerge(
                    'h-8',
                    ix == correctIx && 'font-bold text-green-600'
                  ),
                  indicator: twMerge(
                    'h-8',
                    ix == correctIx ? 'bg-green-600' : 'bg-gray-400'
                  ),
                }}
                key={ix}
                value={(value / sum) * 100}
                max={100}
                formatter={(v) => v.toFixed() + '%'}
              />
            )
          )}
        </div>
      )
    }

    case ElementType.Mc:
    case ElementType.Kprim: {
      const sum = Object.values(
        evaluation.choices as Record<string, number>
      ).reduce((acc, choice) => acc + choice, 0)

      const correctIx = options.choices
        .map((choice: any, ix: number) => ({ ...choice, ix }))
        .filter((choice: any) => choice.correct)
        .map((choice: any) => choice.ix)

      return (
        <div className="space-y-2">
          <div className="font-bold">
            {t('pwa.learningElement.othersAnswered')}
          </div>
          {Object.entries(evaluation.choices as Record<string, number>).map(
            ([ix, value]) => (
              <div key={value}>
                <Progress
                  isMaxVisible={false}
                  className={{
                    root: twMerge(
                      'h-8',
                      correctIx.includes(+ix) && 'font-bold'
                    ),
                    indicator: twMerge(
                      'h-8',
                      correctIx.includes(+ix) ? 'bg-green-600' : 'bg-red-400'
                    ),
                  }}
                  value={value ? (value / sum) * 100 : 0}
                  max={100}
                  formatter={(v) => v.toFixed() + '%'}
                />
              </div>
            )
          )}
        </div>
      )
    }

    case ElementType.FreeText:
      const answers = Object.entries(
        evaluation.answers as Record<string, number>
      ).reduce(
        (acc, [value, count]) => ({ ...acc, [value]: { value, count } }),
        {}
      ) as Record<string, Record<string, string | number>>
      const solutions = options.solutions

      return (
        <div>
          <div className="mb-4">
            <div className="font-bold">
              {t('pwa.learningElement.othersAnswered')}
            </div>
            <div>
              {Object.keys(answers)
                .map((key) => `${key} (${answers[key].count})`)
                .join(', ')}
            </div>
          </div>
          <div>
            <div className="font-bold">
              {t('shared.generic.sampleSolution')}
            </div>
            <div>{solutions.join(', ')}</div>
          </div>
        </div>
      )

    case ElementType.Numerical:
      const results = Object.entries(
        evaluation.answers as Record<string, number>
      ).reduce(
        (acc, [value, count]) => ({ ...acc, [value]: { value, count } }),
        {}
      )

      return (
        <div className="h-40 space-y-2">
          <div className="font-bold">
            {t('pwa.learningElement.othersAnswered')}
          </div>
          <Histogram
            data={{
              results: results,
              questionData: { options } as NumericalQuestionData,
            }}
            showSolution={{ general: true }}
            textSize="md"
            className={{ root: 'h-40' }}
            reference={reference ? parseFloat(reference) : undefined}
            hideBins
            basic
          />
        </div>
      )

    default:
      return <div></div>
  }
}

export async function getStaticProps({ locale }: any) {
  return {
    props: {
      messages: (await import(`@klicker-uzh/i18n/messages/${locale}`)).default,
    },
  }
}

export default EvaluationDisplay
