import {
  faArrowLeft,
  faArrowRight,
  faTrash,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

interface QuestionBlockProps {
  index: number
  question: {
    id: number
    title: string
    hasAnswerFeedbacks: boolean
    hasSampleSolution: boolean
  }
  numOfBlocks: number
  remove: (index: number) => void
  move: (from: number, to: number) => void
}

function QuestionBlock({
  index,
  question,
  numOfBlocks,
  remove,
  move,
}: QuestionBlockProps): React.ReactElement {
  const t = useTranslations()

  return (
    <div
      key={index}
      className="flex flex-col p-2 border border-solid rounded-md w-52"
    >
      <div className="flex flex-row items-center justify-between">
        <div className="font-bold">{`${t('shared.generic.question')} ${
          index + 1
        }`}</div>
        <div className="flex flex-row gap-1 ml-2">
          <Button
            basic
            disabled={numOfBlocks === 1}
            className={{ root: 'mx-1 disabled:hidden' }}
            onClick={() => move(index, index !== 0 ? index - 1 : index)}
            data={{ cy: `move-block-${index}-left` }}
          >
            <Button.Icon>
              <FontAwesomeIcon icon={faArrowLeft} />
            </Button.Icon>
          </Button>
          <Button
            basic
            disabled={numOfBlocks === 1}
            className={{ root: 'ml-1 mr-2 disabled:hidden' }}
            onClick={() =>
              move(index, index !== numOfBlocks ? index + 1 : index)
            }
            data={{ cy: `move-block-${index}-right` }}
          >
            <Button.Icon>
              <FontAwesomeIcon icon={faArrowRight} />
            </Button.Icon>
          </Button>
          <Button
            onClick={() => remove(index)}
            className={{
              root: 'w-6 flex justify-center text-white bg-red-500 rounded sm:hover:bg-red-600',
            }}
            data={{ cy: `remove-block-${index}` }}
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
