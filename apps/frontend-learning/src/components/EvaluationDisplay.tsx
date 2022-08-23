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

      console.log(correctIx)

      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="font-bold">Feedback</div>
            {evaluation?.feedbacks?.map((fb: any) => (
              <div key={fb.feedback}>{fb.feedback}</div>
            ))}
          </div>

          <div className="space-y-2">
            <div className="font-bold">Answer Distribution</div>
            {Object.entries(evaluation.choices as Record<string, number>).map(
              ([ix, value]) => (
                <Progress
                  className={twMerge(
                    ix == correctIx && 'font-bold text-green-600'
                  )}
                  key={ix}
                  value={(value / sum) * 100}
                  max={100}
                  formatter={(v) => v.toFixed() + '%'}
                />
              )
            )}
          </div>
        </div>
      )
    }

    case QuestionType.MC:
      return <div></div>

    case QuestionType.FREE_TEXT:
      return <div></div>

    case QuestionType.NUMERICAL:
      return <div></div>

    default:
      return <div></div>
  }
}

export default EvaluationDisplay
