import { ElementInstanceEvaluation } from '@klicker-uzh/graphql/dist/ops'

interface MCEvaluationProps {
  evaluation: ElementInstanceEvaluation
}

function MCEvaluation({ evaluation }: MCEvaluationProps) {
  return <div>MC EVALUATION</div>
}

export default MCEvaluation
