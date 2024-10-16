import { useTranslations } from 'next-intl'
import { LiveQuizBlockErrorValues } from '../WizardLayout'

interface LiveQuizBlocksErrorProps {
  errors: LiveQuizBlockErrorValues
}

function LiveQuizBlocksError({ errors }: LiveQuizBlocksErrorProps) {
  const t = useTranslations()

  return (
    <ul>
      {[
        ...(errors.questionIds ?? []),
        ...(errors.titles ?? []),
        ...(errors.types ?? []),
      ].flatMap(
        (error: string, ix: number) =>
          error && (
            <li key={`error-questionId-${ix}`}>{`${t(
              'shared.generic.elementN',
              {
                number: ix + 1,
              }
            )}: ${error}`}</li>
          )
      )}
      {errors.timeLimit && <li>{errors.timeLimit}</li>}
    </ul>
  )
}

export default LiveQuizBlocksError
