import { useTranslations } from 'next-intl'
import { LiveQuizBlockErrorValues } from '../MultistepWizard'

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
        errors.timeLimit,
      ].flatMap(
        (error: string, ix: number) =>
          error && (
            <li key={`error-questionId-${ix}`}>{`${t('shared.generic.blockN', {
              number: ix + 1,
            })}: ${error}`}</li>
          )
      )}
    </ul>
  )
}

export default LiveQuizBlocksError
