import { QuestionType } from '@type/app'

interface Props {
  questionType: string
  evaluation: any
}

function EvaluationDisplay({ questionType, evaluation }: Props) {
  switch (questionType) {
    case QuestionType.SC: {
      return (
        <div className="flex flex-col">
          <div>
            {evaluation.feedbacks.map((fb: any) => (
              <div key={fb.feedback}>{fb.feedback}</div>
            ))}
          </div>

          {Object.entries(evaluation.choices).map(([ix, value]) => (
            <div key={value as string}>{value as string}</div>
          ))}
        </div>
      )
    }

    case QuestionType.MC:
      return (
        <div className="flex flex-col">
          <div>
            {evaluation.feedbacks.map((fb: any) => (
              <div key={fb.feedback}>{fb.feedback}</div>
            ))}
          </div>

          {Object.entries(evaluation.choices).map(([ix, value]) => (
            <div key={value as string}>{value as string}</div>
          ))}
        </div>
      )

    case QuestionType.FREE_TEXT:
      return <div></div>

    case QuestionType.NUMERICAL:
      return <div></div>

    default:
      return <div></div>
  }
}

export default EvaluationDisplay
