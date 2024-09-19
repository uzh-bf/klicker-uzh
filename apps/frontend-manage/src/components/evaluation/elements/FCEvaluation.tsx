import { ElementInstanceEvaluation } from '@klicker-uzh/graphql/dist/ops'

interface FCEvaluationProps {
  evaluation: ElementInstanceEvaluation
}

function FCEvaluation({ evaluation }: FCEvaluationProps) {
  return <div>FC EVALUATION</div>
}

export default FCEvaluation
