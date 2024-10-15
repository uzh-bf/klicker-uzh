import { useTranslations } from 'next-intl'
import { ElementStackErrorValues } from './WizardLayout'

interface StackCreationErrorsProps {
  errors: ElementStackErrorValues
}

function StackErrorElement({
  errorMessage,
  ix,
}: {
  errorMessage: string
  ix: number
}) {
  const t = useTranslations()

  return (
    <li key={`error-elementId-${ix}-${errorMessage}`}>{`${t(
      'shared.generic.elementN',
      {
        number: ix + 1,
      }
    )}: ${errorMessage}`}</li>
  )
}

function StackCreationErrors({ errors }: StackCreationErrorsProps) {
  const t = useTranslations()

  return (
    <ul>
      {errors.displayName && <li>{errors.displayName}</li>}
      {errors.description && <li>{errors.description}</li>}
      {typeof errors.elements === 'string' && <li>{errors.elements}</li>}
      {[
        ...(errors.elements && typeof errors.elements !== 'string'
          ? errors.elements
          : []),
      ].flatMap(
        (error, ix: number) =>
          error && (
            <>
              {error.id && (
                <StackErrorElement errorMessage={error.id} ix={ix} />
              )}
              {error.title && (
                <StackErrorElement errorMessage={error.title} ix={ix} />
              )}
              {error.type && (
                <StackErrorElement errorMessage={error.type} ix={ix} />
              )}
              {error.hasSampleSolution && (
                <StackErrorElement
                  errorMessage={error.hasSampleSolution}
                  ix={ix}
                />
              )}
            </>
          )
      )}
    </ul>
  )
}

export default StackCreationErrors
