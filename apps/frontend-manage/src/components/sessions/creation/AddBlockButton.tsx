import { faPlus } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { ThemeContext } from '@uzh-bf/design-system'
import { useContext } from 'react'
import { useDrop } from 'react-dnd'
import { twMerge } from 'tailwind-merge'

interface AddBlockButtonProps {
  push: (value: any) => void
}

function AddBlockButton({ push }: AddBlockButtonProps) {
  const theme = useContext(ThemeContext)
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
        'flex flex-col items-center justify-center rounded text-center border border-solid w-16 cursor-pointer',
        theme.primaryBgHover,
        isOver && theme.primaryBg
      )}
      onClick={() =>
        push({
          questionIds: [],
          titles: [],
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
