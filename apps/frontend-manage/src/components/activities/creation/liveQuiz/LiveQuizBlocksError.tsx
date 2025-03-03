import { ElementBlockErrorValues } from '../WizardLayout'

interface LiveQuizBlocksErrorProps {
  errors: ElementBlockErrorValues
}

function LiveQuizBlocksError({ errors }: LiveQuizBlocksErrorProps) {
  const uniqueErrors = Array.from(
    new Set([
      errors.timeLimit,
      typeof errors.elements === 'string' ? errors.elements : undefined,
      ...(typeof errors.elements !== 'string' && errors.elements
        ? [
            ...(errors.elements.flatMap((e) => e?.id) ?? []),
            ...(errors.elements.flatMap((e) => e?.type) ?? []),
            ...(errors.elements.flatMap((e) => e?.hasSampleSolution) ?? []),
          ]
        : []),
    ])
  )

  return (
    <ul className="list-inside list-disc">
      {uniqueErrors.filter(Boolean).map((error, ix) => (
        <li key={`error-${ix}`}>{error}</li>
      ))}
    </ul>
  )
}

export default LiveQuizBlocksError
