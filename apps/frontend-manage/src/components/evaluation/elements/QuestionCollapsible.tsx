import { faChevronDown, faChevronUp } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { ElementInstanceEvaluation } from '@klicker-uzh/graphql/dist/ops'
import { Markdown } from '@klicker-uzh/markdown'
import { Button, Prose } from '@uzh-bf/design-system'
import { useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'

function QuestionCollapsible({
  activeInstance,
  currentInstance,
  proseSize,
}: {
  activeInstance: number
  currentInstance: ElementInstanceEvaluation
  proseSize: string
}) {
  const [questionElem, setQuestionElem] = useState<HTMLDivElement | null>(null)
  const [questionCollapsed, setQuestionCollapsed] = useState<boolean>(true)
  const [showExtensibleButton, setShowExtensibleButton] =
    useState<boolean>(false)

  useEffect(() => {
    if (!questionElem) return

    // if the element height is larger than what is shown or the question was opened, show the extension button
    if (
      questionElem?.scrollHeight > questionElem?.clientHeight ||
      !questionCollapsed
    ) {
      setShowExtensibleButton(true)
    } else {
      setShowExtensibleButton(false)
    }

    return () => setQuestionElem(null)
  }, [questionCollapsed, questionElem, activeInstance])

  const computedClassName = twMerge(
    questionCollapsed ? 'md:max-h-[5rem]' : 'md:max-h-content',
    !showExtensibleButton && 'border-solid border-b-only border-primary-100',
    showExtensibleButton &&
      questionCollapsed &&
      'md:bg-clip-text md:bg-gradient-to-b md:from-black md:via-black md:to-white md:text-transparent',
    'w-full md:overflow-y-hidden md:self-start p-4 text-left'
  )

  return (
    <div className="border-uzh-grey-80 border-b-[0.1rem] border-solid">
      <div ref={(ref) => setQuestionElem(ref)} className={computedClassName}>
        <Prose
          className={{
            root: 'max-w-full',
          }}
        >
          <Markdown
            className={{
              root: twMerge(
                'prose-p:m-0 prose-lg prose-img:m-0 flex flex-initial flex-row content-between leading-8',
                proseSize
              ),
            }}
            content={currentInstance.content}
          />
        </Prose>
      </div>
      {showExtensibleButton && (
        <Button
          className={{
            root: twMerge(
              'hover:bg-primary-20 hidden h-4 w-full rounded-none border-0 text-center text-xs shadow-none hover:bg-none md:block print:hidden',
              questionCollapsed && 'bg-gradient-to-b from-white to-slate-100'
            ),
          }}
          onClick={() => setQuestionCollapsed(!questionCollapsed)}
          data={{ cy: 'toggle-question-collapse-evaluation' }}
        >
          <FontAwesomeIcon
            icon={questionCollapsed ? faChevronDown : faChevronUp}
            className={twMerge('-mt-1.5 h-6', questionCollapsed && '-mt-2')}
          />
        </Button>
      )}
    </div>
  )
}

export default QuestionCollapsible
