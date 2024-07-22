import { useTranslations } from 'next-intl'
import { ElementStackErrorValues } from './MultistepWizard'

interface StackCreationErrorsProps {
  errors: ElementStackErrorValues
}

function StackCreationErrors({ errors }: StackCreationErrorsProps) {
  const t = useTranslations()

  return (
    <ul>
      {errors.displayName && <li>{errors.displayName}</li>}
      {errors.description && <li>{errors.description}</li>}
      {typeof errors.elementIds === 'string' && <li>{errors.elementIds}</li>}
      {[
        ...(errors.elementIds && typeof errors.elementIds !== 'string'
          ? errors.elementIds
          : []),
        ...(errors.titles ?? []),
        ...(errors.types ?? []),
        ...(errors.hasSampleSolutions ?? []),
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
    </ul>
  )
}

export default StackCreationErrors