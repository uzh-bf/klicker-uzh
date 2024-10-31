import { useTranslations } from 'next-intl'
import { ElememntBlockErrorValues } from '../WizardLayout'

interface LiveQuizBlocksErrorProps {
  errors: ElememntBlockErrorValues
}

function LiveQuizBlocksError({ errors }: LiveQuizBlocksErrorProps) {
  const t = useTranslations()

  return (
    <ul>
      {[
        errors.timeLimit,
        typeof errors.elements === 'string' ? errors.elements : undefined,
        ...(typeof errors.elements !== 'string' && errors.elements
          ? [
              ...(errors.elements.map((e) => e.id) ?? []),
              ...(errors.elements.map((e) => e.type) ?? []),
              ...(errors.elements.map((e) => e.type) ?? []),
              ...(errors.elements.map((e) => e.hasSampleSolution) ?? []),
            ]
          : []),
      ]
        .filter((e) => typeof e !== 'undefined')
        .map(
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
