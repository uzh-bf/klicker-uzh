import { faTrash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button, ThemeContext } from '@uzh-bf/design-system'
import { useContext } from 'react'

interface QuestionBlockProps {
  index: number
  question: { id: number; title: string }
  remove: (index: number) => void
}

function QuestionBlock({
  index,
  question,
  remove,
}: QuestionBlockProps): React.ReactElement {
  const theme = useContext(ThemeContext)

  return (
    <div
      key={index}
      className="flex flex-col p-2 border border-solid rounded-md w-52"
    >
      <div className="flex flex-row items-center justify-between">
        <div className="font-bold">Frage {index + 1}</div>
        <div className="flex flex-row gap-1 ml-2">
          <Button
            onClick={() => remove(index)}
            className={{
              root: 'w-6 flex justify-center text-white bg-red-500 rounded hover:bg-red-600',
            }}
          >
            <FontAwesomeIcon icon={faTrash} />
          </Button>
        </div>
      </div>
      <div className="flex flex-col flex-1 gap-1 my-2">{question.title}</div>
    </div>
  )
}

export default QuestionBlock
