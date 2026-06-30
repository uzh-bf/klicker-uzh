import { Markdown } from '@klicker-uzh/markdown'
import { ContentActivityEvaluationData } from '@lib/evaluationTypes'
import { twMerge } from 'tailwind-merge'
import { TextSizeType } from '../textSizes'

interface CTEvaluationProps {
  evaluation: ContentActivityEvaluationData
  textSize: TextSizeType
}

function CTEvaluation({ evaluation, textSize }: CTEvaluationProps) {
  return (
    <div className="w-full overflow-auto p-4">
      <Markdown
        withProse
        className={{
          root: twMerge(
            'prose-img:max-w-[50%] prose-img:w-[100em] prose-img:max-h-none',
            textSize.prose
          ),
        }}
        content={evaluation.content}
        data={{ cy: `content-element-md-${evaluation.id}` }}
      />
    </div>
  )
}

export default CTEvaluation
