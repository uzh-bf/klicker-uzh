import {
  faArrowLeft,
  faArrowRight,
  faCircleExclamation,
  faGears,
  faTrash,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Element, ElementType } from '@klicker-uzh/graphql/dist/ops'
import { Button, Tooltip } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { useDrop } from 'react-dnd'
import { isEmpty } from 'remeda'
import { QuestionDragDropTypes } from '../../../questions/Question'
import DropElementsStack from '../DropElementsStack'
import PasteSelectionButton from '../PasteSelectionButton'
import WizardElementList from '../WizardElementList'
import {
  ElememntBlockErrorValues,
  ElementBlockFormValues,
} from '../WizardLayout'
import LiveQuizBlocksError from './LiveQuizBlocksError'
import LiveQuizBlockSettingsModal from './LiveQuizBlockSettingsModal'

interface LiveQuizCreationBlockProps {
  blockIx: number
  block: ElementBlockFormValues
  numOfBlocks: number
  acceptedTypes: ElementType[]
  remove: (blockIx: number) => void
  move: (from: number, to: number) => void
  replace: (blockIx: number, value: ElementBlockFormValues) => void
  selection?: Record<number, Element>
  resetSelection?: () => void
  error?: ElememntBlockErrorValues[]
}

function LiveQuizCreationBlock({
  blockIx,
  block,
  numOfBlocks = 1,
  acceptedTypes,
  remove,
  move,
  replace,
  selection,
  resetSelection,
  error,
}: LiveQuizCreationBlockProps): React.ReactElement {
  const t = useTranslations()
  const [openSettings, setOpenSettings] = useState(false)

  const [{ isOver }, drop] = useDrop(
    () => ({
      accept: acceptedTypes,
      drop: (item: QuestionDragDropTypes) => {
        replace(blockIx, {
          ...block,
          elements: [
            ...block.elements,
            {
              id: item.id,
              title: item.title,
              type: item.questionType,
              hasSampleSolution: item.hasSampleSolution,
            },
          ],
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
      key={blockIx}
      className="flex w-56 flex-col"
      data-cy={`block-${blockIx}`}
    >
      <div className="flex flex-row items-center justify-between rounded bg-slate-200 px-2 py-1 text-slate-700">
        <div className="flex flex-row items-center gap-2">
          <div data-cy="block-container-header">
            {t('shared.generic.blockN', { number: blockIx + 1 })}
          </div>
          {error &&
            Array.isArray(error) &&
            error.length > blockIx &&
            typeof error[blockIx] !== 'undefined' && (
              <Tooltip
                tooltip={<LiveQuizBlocksError errors={error[blockIx]} />}
                delay={0}
                className={{ tooltip: 'z-20 text-sm' }}
              >
                <FontAwesomeIcon
                  icon={faCircleExclamation}
                  className="mr-1 text-red-600"
                />
              </Tooltip>
            )}
        </div>
        <div className="flex flex-row gap-1 text-xs">
          <Button
            basic
            className={{
              root: 'hover:bg-primary-20 px-1 disabled:hidden',
            }}
            disabled={numOfBlocks === 1}
            onClick={() => move(blockIx, blockIx !== 0 ? blockIx - 1 : blockIx)}
            data={{ cy: `move-block-${blockIx}-left` }}
          >
            <Button.Icon>
              <FontAwesomeIcon icon={faArrowLeft} />
            </Button.Icon>
          </Button>
          <Button
            basic
            className={{
              root: 'hover:bg-primary-20 px-1 disabled:hidden',
            }}
            disabled={numOfBlocks === 1}
            onClick={() =>
              move(blockIx, blockIx !== numOfBlocks ? blockIx + 1 : blockIx)
            }
            data={{ cy: `move-block-${blockIx}-right` }}
          >
            <Button.Icon>
              <FontAwesomeIcon icon={faArrowRight} />
            </Button.Icon>
          </Button>

          <Button
            basic
            onClick={() => setOpenSettings(true)}
            className={{
              root: 'hover:text-primary-100 px-1',
            }}
            data={{ cy: `open-block-${blockIx}-settings` }}
          >
            <Button.Icon>
              <FontAwesomeIcon icon={faGears} />
            </Button.Icon>
          </Button>
          <Button
            basic
            onClick={() => remove(blockIx)}
            className={{
              root: 'px-1 hover:text-red-600',
            }}
            data={{ cy: `delete-block-${blockIx}` }}
          >
            <Button.Icon>
              <FontAwesomeIcon icon={faTrash} />
            </Button.Icon>
          </Button>
        </div>
      </div>

      <WizardElementList
        stack={block}
        stackIx={blockIx}
        replace={replace}
        error={error}
      />

      {selection && !isEmpty(selection) && (
        <PasteSelectionButton
          index={blockIx}
          selection={selection}
          resetSelection={resetSelection}
          stack={block}
          replace={replace}
        />
      )}
      <DropElementsStack
        type="block"
        drop={drop}
        isOver={isOver}
        index={blockIx}
      />
      <LiveQuizBlockSettingsModal
        openSettings={openSettings}
        setOpenSettings={setOpenSettings}
        block={block}
        index={blockIx}
        replace={replace}
      />
    </div>
  )
}

export default LiveQuizCreationBlock
