import { faPlus } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useDrop } from 'react-dnd'
import { twMerge } from 'tailwind-merge'

interface AddQuestionFieldProps {
  push: (value: any) => void
}

function AddQuestionField({ push }: AddQuestionFieldProps) {
  const [{ isOver }, drop] = useDrop(
    () => ({
      accept: 'question',
      drop: (item: {
        id: number
        type: string
        questionType: string
        title: string
        content: string
        hasAnswerFeedbacks: boolean
        hasSampleSolution: boolean
      }) => {
        push({
          id: item.id,
          title: item.title,
          type: item.questionType,
          hasAnswerFeedbacks: item.hasAnswerFeedbacks,
          hasSampleSolution: item.hasSampleSolution,
        })
      },
      collect: (monitor) => ({
        isOver: !!monitor.isOver(),
      }),
    }),
    []
  )

  return (
    <div
      className={twMerge(
        'flex flex-col items-center justify-center rounded text-center border border-solid w-16 p-2',
        isOver && 'bg-primary-20'
      )}
      id="add-question"
      ref={drop}
      data-cy="drop-questions-here"
    >
      <FontAwesomeIcon icon={faPlus} size="lg" />
      <div>Neue Frage</div>
    </div>
  )
}

export default AddQuestionField
