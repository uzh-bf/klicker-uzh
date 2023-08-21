import { faPaste } from '@fortawesome/free-regular-svg-icons'
import { faBars, faPlus } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useDrop } from 'react-dnd'
import { twMerge } from 'tailwind-merge'

interface AddBlockButtonProps {
  push: (value: any) => void
  selectionAvailable: boolean
  selection?: { id: number; title: string }[]
  resetSelection?: () => void
}

function AddBlockButton({
  push,
  selectionAvailable,
  selection,
  resetSelection,
}: AddBlockButtonProps) {
  const t = useTranslations()
  const [{ isOver }, drop] = useDrop(
    () => ({
      accept: 'question',
      drop: (item: {
        id: number
        type: string
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

  if (selection && selection.length > 0) {
    return (
      <div className="flex flex-col gap-1.5">
        <Button
          className={{
            root: 'flex flex-row gap-0 justify-center rounded text-center border h-1/2 border-solid md:w-36 cursor-pointer bg-uzh-red-20 hover:bg-uzh-red-40',
          }}
          onClick={() => {
            const { questionIds, titles } = selection.reduce<{
              questionIds: number[]
              titles: string[]
            }>(
              (acc, curr) => {
                acc.questionIds.push(curr.id)
                acc.titles.push(curr.title)
                return acc
              },
              { questionIds: [], titles: [] }
            )

            push({
              questionIds: questionIds,
              titles: titles,
              timeLimit: undefined,
            })
            resetSelection && resetSelection()
          }}
          data={{ cy: 'add-block-with-selected' }}
          ref={drop}
        >
          <FontAwesomeIcon icon={faPaste} size="lg" />
          <div>{t('manage.sessionForms.newBlockSelected')}</div>
        </Button>
        <Button
          className={{
            root: 'flex flex-row gap-0 justify-center rounded text-center border h-1/2 border-solid md:w-36 cursor-pointer bg-uzh-red-20 hover:bg-uzh-red-40',
          }}
          onClick={() => {
            selection.forEach((question) => {
              push({
                questionIds: [question.id],
                titles: [question.title],
                timeLimit: undefined,
              })
            })
            resetSelection && resetSelection()
          }}
          data={{ cy: 'add-block-with-selected' }}
          ref={drop}
        >
          <FontAwesomeIcon icon={faBars} size="lg" />
          <div>{t('manage.sessionForms.pasteSingleQuestions')}</div>
        </Button>
      </div>
    )
  }

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
      <div>{t('manage.sessionForms.newBlock')}</div>
    </div>
  )
}

export default AddBlockButton
