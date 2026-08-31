import { faClock } from '@fortawesome/free-regular-svg-icons'
import {
  faArrowLeft,
  faArrowRight,
  faCircleExclamation,
  faTrash,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  Element,
  ElementInstanceVersionInfo,
  ElementType,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, Tooltip } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { useDrop } from 'react-dnd'
import { twMerge } from 'tailwind-merge'
import { ElementDragDropTypes } from '../../../elements/Element'
import DropElementsStack from '../DropElementsStack'
import { OutdatedInstancesRefetchFunction } from '../InstanceUpdateOption'
import PasteSelectionButton from '../PasteSelectionButton'
import WizardElementList from '../WizardElementList'
import {
  ElementBlockErrorValues,
  ElementBlockFormValues,
} from '../WizardLayout'
import LiveQuizBlocksError from './LiveQuizBlocksError'
import LiveQuizCountdownModal from './LiveQuizCountdownModal'

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
  error?: ElementBlockErrorValues[]
  outdatedInstances: ElementInstanceVersionInfo[]
  refetchOutdatedInstances: OutdatedInstancesRefetchFunction
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
  outdatedInstances,
  refetchOutdatedInstances,
}: LiveQuizCreationBlockProps): React.ReactElement {
  const t = useTranslations()
  const [openSettings, setOpenSettings] = useState(false)

  const [{ isOver }, drop] = useDrop(
    () => ({
      // QR scan questions are only placeable in escape-room blocks
      accept: block.isEscapeRoom
        ? [...acceptedTypes, ElementType.QrScan]
        : acceptedTypes,
      drop: (item: ElementDragDropTypes) => {
        replace(blockIx, {
          ...block,
          elements: [
            ...block.elements,
            {
              id: item.id,
              title: item.title,
              type: item.questionType,
              hasSampleSolution: item.hasSampleSolution,
              existingInstanceId: null,
              duplicateInstance: false,
            },
          ],
        })
      },
      collect: (monitor) => ({
        isOver: !!monitor.isOver(),
      }),
    }),
    [block]
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
        <div className="flex flex-row text-xs">
          <Button
            basic
            className={{
              root: 'hover:text-primary-100 px-1 hover:bg-transparent disabled:hover:bg-transparent',
            }}
            disabled={numOfBlocks === 1 || blockIx === 0}
            onClick={() => move(blockIx, blockIx !== 0 ? blockIx - 1 : blockIx)}
            data={{ cy: `move-block-${blockIx}-left` }}
          >
            <Button.Icon
              withoutLabel
              icon={faArrowLeft}
              className={{ root: 'h-3.5 w-3.5' }}
            />
          </Button>
          <Button
            basic
            className={{
              root: 'hover:text-primary-100 px-1 hover:bg-transparent disabled:hover:bg-transparent',
            }}
            disabled={numOfBlocks === 1 || blockIx === numOfBlocks - 1}
            onClick={() =>
              move(blockIx, blockIx !== numOfBlocks ? blockIx + 1 : blockIx)
            }
            data={{ cy: `move-block-${blockIx}-right` }}
          >
            <Button.Icon
              withoutLabel
              icon={faArrowRight}
              className={{ root: 'h-3.5 w-3.5' }}
            />
          </Button>

          <Button
            basic
            onClick={() => setOpenSettings(true)}
            className={{
              root: twMerge(
                'hover:text-primary-100 px-1 hover:bg-transparent',
                block.timeLimit && 'font-bold text-orange-400'
              ),
            }}
            data={{ cy: `open-block-${blockIx}-countdown` }}
          >
            <Button.Icon
              withoutLabel
              icon={faClock}
              className={{ root: 'h-3.5 w-3.5' }}
            />
          </Button>
          <Button
            basic
            onClick={() => remove(blockIx)}
            className={{
              root: 'px-1 hover:bg-transparent hover:text-red-600',
            }}
            data={{ cy: `delete-block-${blockIx}` }}
          >
            <Button.Icon
              withoutLabel
              icon={faTrash}
              className={{ root: 'h-3.5 w-3.5' }}
            />
          </Button>
        </div>
      </div>

      <WizardElementList
        type="block"
        stack={block}
        stackIx={blockIx}
        replace={replace}
        error={error}
        selectionActive={
          selection
            ? Object.values(selection).some((question) =>
                acceptedTypes.includes(question.type)
              )
            : false
        }
        outdatedInstances={outdatedInstances}
        refetchOutdatedInstances={refetchOutdatedInstances}
        isEscapeRoom={block.isEscapeRoom}
      />

      {selection &&
        Object.values(selection).some((question) =>
          acceptedTypes.includes(question.type)
        ) && (
          <PasteSelectionButton
            index={blockIx}
            selection={selection}
            resetSelection={resetSelection}
            acceptedTypes={acceptedTypes}
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
      {openSettings && (
        <LiveQuizCountdownModal
          onClose={() => setOpenSettings(false)}
          block={block}
          index={blockIx}
          replace={replace}
        />
      )}
    </div>
  )
}

export default LiveQuizCreationBlock
