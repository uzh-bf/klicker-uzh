import { faPlus } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useDrop } from 'react-dnd'
import { twMerge } from 'tailwind-merge'

interface AddBlockButtonProps {
  push: (value: any) => void
}

function AddBlockButton({ push }: AddBlockButtonProps) {
  const [{ isOver }, drop] = useDrop(
    () => ({
      accept: 'question',
      drop: (item: {
        id: number
        type: string
        questionType: string
        title: string
        content: string
      }) => {
        push({
          questionIds: [item.id],
          titles: [item.title],
          types: [item.questionType],
          timeLimit: undefined,
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
        'flex flex-col items-center justify-center rounded text-center border border-solid md:w-16 cursor-pointer hover:bg-primary-20 w-full p-2',
        isOver && 'bg-primary-20'
      )}
      onClick={() =>
        push({
          questionIds: [],
          titles: [],
          types: [],
          timeLimit: undefined,
        })
      }
      data-cy="add-block"
      ref={drop}
    >
      <FontAwesomeIcon icon={faPlus} size="lg" />
      <div>Neuer Block</div>
    </div>
  )
}

export default AddBlockButton
