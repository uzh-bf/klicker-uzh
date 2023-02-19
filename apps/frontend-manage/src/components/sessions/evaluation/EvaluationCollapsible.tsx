import { faChevronDown, faChevronUp } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { InstanceResult } from '@klicker-uzh/graphql/dist/ops'
import { Markdown } from '@klicker-uzh/markdown'
import { Button, Prose, ThemeContext } from '@uzh-bf/design-system'
import { useContext, useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'

function EvaluationCollapsible({
  selectedInstance,
  currentInstance,
  proseSize,
}: {
  selectedInstance: string
  currentInstance: Partial<InstanceResult>
  proseSize: string
}) {
  const theme = useContext(ThemeContext)

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
  }, [questionCollapsed, questionElem, selectedInstance])

  const computedClassName = twMerge(
    questionCollapsed ? 'md:max-h-[7rem]' : 'md:max-h-content',
    !showExtensibleButton && 'border-solid border-b-only border-primary',
    showExtensibleButton &&
      questionCollapsed &&
      'md:bg-clip-text md:bg-gradient-to-b md:from-black md:via-black md:to-white md:text-transparent',
    'w-full md:overflow-y-hidden md:self-start flex-[0_0_auto] p-4 text-left'
  )

  return (
    <div className="border-b-[0.1rem] border-solid border-uzh-grey-80">
      <div ref={(ref) => setQuestionElem(ref)} className={computedClassName}>
        <Prose
          className={{
            root: twMerge(
              'flex-initial max-w-full prose-p:m-0 leading-8 prose-lg prose-img:m-0',
              proseSize
            ),
          }}
        >
          <Markdown
            className={{ root: 'flex flex-row content-between' }}
            content={currentInstance.questionData?.content}
          />
        </Prose>
        {/* // TODO: <div>ATTACHMENTS</div> */}
      </div>
      {showExtensibleButton && (
        <Button
          className={{
            root: twMerge(
              questionCollapsed && 'bg-gradient-to-b from-white to-slate-100',
              'hidden w-full h-4 text-xs text-center rounded-none border-0 shadow-none md:block print:hidden hover:bg-none',
              theme.primaryBgHover
            ),
          }}
          onClick={() => setQuestionCollapsed(!questionCollapsed)}
        >
          <FontAwesomeIcon
            icon={questionCollapsed ? faChevronDown : faChevronUp}
            className={twMerge('h-6 -mt-1.5', questionCollapsed && '-mt-2')}
          />
        </Button>
      )}
    </div>
  )
}

export default EvaluationCollapsible
