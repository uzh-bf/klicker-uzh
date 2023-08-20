import { faPaste } from '@fortawesome/free-regular-svg-icons'
import { faPlus } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useDrop } from 'react-dnd'
import { twMerge } from 'tailwind-merge'

interface AddBlockButtonProps {
  push: (value: any) => void
  selectionAvailable: boolean
  addSelected: () => void
  addSelectedSingle: () => void
}

function AddBlockButton({
  push,
  selectionAvailable,
  addSelected,
  addSelectedSingle,
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

  if (selectionAvailable) {
    return (
      <div className="flex flex-row gap-1.5">
        <Button
          className={{
            root: 'flex flex-col gap-1 items-center justify-center rounded text-center border border-solid md:w-20 cursor-pointer bg-uzh-red-20 hover:bg-uzh-red-40 w-full p-2',
          }}
          onClick={addSelected}
          data={{ cy: 'add-block-with-selected' }}
          ref={drop}
        >
          <FontAwesomeIcon icon={faPaste} size="lg" />
          <div>{t('manage.sessionForms.newBlockSelected')}</div>
        </Button>
        <Button
          className={{
            root: 'flex flex-col gap-1 items-center justify-center rounded text-center border border-solid md:w-20 cursor-pointer bg-uzh-red-20 hover:bg-uzh-red-40 w-full p-2',
          }}
          onClick={addSelectedSingle}
          data={{ cy: 'add-block-with-selected' }}
          ref={drop}
        >
          <FontAwesomeIcon icon={faPaste} size="lg" />
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
