import { ElementInstanceEvaluation } from '@klicker-uzh/graphql/dist/ops'
import { twMerge } from 'tailwind-merge'

interface ElementEvaluationProps {
  currentInstance: ElementInstanceEvaluation
  className?: string
}

function ElementEvaluation({
  currentInstance,
  className,
}: ElementEvaluationProps) {
  return (
    <div className={twMerge('flex h-full flex-col', className)}>
      {currentInstance.id}
    </div>
  )
}

export default ElementEvaluation
