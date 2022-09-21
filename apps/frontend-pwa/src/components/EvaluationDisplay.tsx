import { InstanceEvaluation } from '@klicker-uzh/graphql/dist/ops'
import { QuestionType } from '@type/app'
import { Progress } from '@uzh-bf/design-system'
import { twMerge } from 'tailwind-merge'

interface Props {
  questionType: string
  options: any
  evaluation: InstanceEvaluation
}

function EvaluationDisplay({ options, questionType, evaluation }: Props) {
  switch (questionType) {
    case QuestionType.SC: {
      const sum = Object.values(
        evaluation.choices as Record<string, number>
      ).reduce((acc, choice) => acc + choice, 0)

      const correctIx = options.choices.findIndex(
        (choice: any) => choice.correct
      )

      return (
        <div className="space-y-2">
          <div className="font-bold">So haben andere geantwortet</div>
          {Object.entries(evaluation.choices as Record<string, number>).map(
            ([ix, value]) => (
              <Progress
                isMaxVisible={false}
                className={twMerge(
                  'h-8',
                  ix == correctIx && 'font-bold text-green-600'
                )}
                indicatorClassName={twMerge(
                  'h-8',
                  ix == correctIx ? 'bg-green-600' : 'bg-gray-400'
                )}
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

    case QuestionType.MC:
    case QuestionType.KPRIM: {
      const sum = Object.values(
        evaluation.choices as Record<string, number>
      ).reduce((acc, choice) => acc + choice, 0)

      const correctIx = options.choices
        .map((choice: any, ix: number) => ({ ...choice, ix }))
        .filter((choice: any) => choice.correct)
        .map((choice: any) => choice.ix)

      return (
        <div className="space-y-2">
          <div className="font-bold">So haben andere geantwortet</div>
          {Object.entries(evaluation.choices as Record<string, number>).map(
            ([ix, value]) => (
              <div key={ix}>
                <Progress
                  isMaxVisible={false}
                  className={twMerge(
                    'h-8',
                    correctIx.includes(+ix) && 'font-bold'
                  )}
                  indicatorClassName={twMerge(
                    'h-8',
                    correctIx.includes(+ix) ? 'bg-green-600' : 'bg-gray-400'
                  )}
                  value={(value / sum) * 100}
                  max={100}
                  formatter={(v) => v.toFixed() + '%'}
                />
              </div>
            )
          )}
        </div>
      )
    }

    case QuestionType.FREE_TEXT:
      return <div></div>

    case QuestionType.NUMERICAL:
      return <div></div>

    default:
      return <div></div>
  }
}

export default EvaluationDisplay
