import { faSquare } from '@fortawesome/free-regular-svg-icons'
import { faPlus } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Element, ElementType } from '@klicker-uzh/graphql/dist/ops'
import { Button } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useDrop } from 'react-dnd'
import { isEmpty } from 'remeda'
import { twMerge } from 'tailwind-merge'
import { ElementDragDropTypes } from '../../elements/Element'
import {
  createElementInstanceClientId,
  ElementBlockFormValues,
  ElementStackFormValues,
} from './WizardLayout'

interface AddStackButtonProps {
  type: 'stack'
  push: (value: ElementStackFormValues) => void
  selection?: Record<number, Element>
  resetSelection?: () => void
  acceptedTypes: ElementType[]
}

interface AddBlockButtonProps {
  type: 'block'
  push: (value: ElementBlockFormValues) => void
  selection?: Record<number, Element>
  resetSelection?: () => void
  acceptedTypes: ElementType[]
}

function AddStackButton({
  type,
  push,
  selection,
  resetSelection,
  acceptedTypes,
}: AddStackButtonProps | AddBlockButtonProps) {
  const t = useTranslations()
  const [{ isOver }, drop] = useDrop(
    () => ({
      accept: acceptedTypes,
      drop: (item: ElementDragDropTypes) => {
        const initialElements = [
          {
            clientId: createElementInstanceClientId(),
            id: item.id,
            title: item.title,
            type: item.questionType,
            hasSampleSolution: item.hasSampleSolution,
            existingInstanceId: null,
            duplicateInstance: false,
          },
        ]

        if (type === 'block') {
          push({
            timeLimit: undefined,
            elements: initialElements,
          })
        } else {
          push({
            displayName: '',
            description: '',
            elements: initialElements,
          })
        }
      },
      collect: (monitor) => ({
        isOver: !!monitor.isOver(),
      }),
    }),
    []
  )

  return (
    <div className="flex flex-row gap-2">
      {selection && !isEmpty(selection) && (
        <div className="flex flex-col gap-1.5">
          <Button
            fluid
            className={{
              root: 'flex max-w-[135px] flex-1 flex-col gap-1 border-orange-300 bg-orange-100 text-sm hover:border-orange-400 hover:bg-orange-200 hover:text-orange-900',
            }}
            onClick={() => {
              const elements = Object.values(selection).map((question) => ({
                clientId: createElementInstanceClientId(),
                id: question.id,
                title: question.name,
                type: question.type,
                hasSampleSolution:
                  'options' in question
                    ? (question.options.hasSampleSolution ?? false)
                    : true,
                existingInstanceId: null,
                duplicateInstance: false,
              }))

              if (type === 'block') {
                push({
                  timeLimit: undefined,
                  elements,
                })
              } else {
                push({
                  displayName: '',
                  description: '',
                  elements,
                })
              }
              resetSelection?.()
            }}
            data={{ cy: 'add-stack-with-selected' }}
            ref={drop}
          >
            <Button.Icon icon={faSquare} />
            <Button.Label className={{ root: 'max-w-full whitespace-normal' }}>
              {type === 'block'
                ? t('manage.activityWizard.newBlockSelected', {
                    count: Object.keys(selection).length,
                  })
                : t('manage.activityWizard.newStackSelected', {
                    count: Object.keys(selection).length,
                  })}
            </Button.Label>
          </Button>
          <Button
            fluid
            className={{
              root: 'flex max-w-[135px] flex-1 flex-col gap-2 border-orange-300 bg-orange-100 text-sm hover:border-orange-400 hover:bg-orange-200 hover:text-orange-900',
            }}
            onClick={() => {
              Object.values(selection).forEach((question) => {
                const elements = [
                  {
                    clientId: createElementInstanceClientId(),
                    id: question.id,
                    title: question.name,
                    type: question.type,
                    hasSampleSolution:
                      'options' in question
                        ? (question.options.hasSampleSolution ?? false)
                        : true,
                    existingInstanceId: null,
                    duplicateInstance: false,
                  },
                ]

                if (type === 'block') {
                  push({
                    timeLimit: undefined,
                    elements,
                  })
                } else {
                  push({
                    displayName: '',
                    description: '',
                    elements,
                  })
                }
              })
              resetSelection?.()
            }}
            data={{ cy: 'add-stack-with-selected' }}
            ref={drop}
          >
            <div className="flex flex-row gap-1">
              <FontAwesomeIcon icon={faSquare} />
              <FontAwesomeIcon icon={faSquare} />
              <FontAwesomeIcon icon={faSquare} />
            </div>
            <div className="max-w-full whitespace-normal">
              {t(
                type === 'block'
                  ? 'manage.activityWizard.pasteSingleElementsBlock'
                  : 'manage.activityWizard.pasteSingleElementsStack',
                {
                  count: Object.keys(selection).length,
                }
              )}
            </div>
          </Button>
        </div>
      )}
      {drop(
        <button
          type="button"
          className={twMerge(
            'hover:bg-accent flex w-full cursor-pointer flex-col items-center justify-center rounded border border-solid bg-transparent p-2 text-center md:w-16',
            isOver && 'bg-primary-20'
          )}
          onClick={() => {
            if (type === 'block') {
              push({
                timeLimit: undefined,
                elements: [],
              })
            } else {
              push({
                displayName: '',
                description: '',
                elements: [],
              })
            }
          }}
          data-cy={`drop-elements-add-${type}`}
        >
          <FontAwesomeIcon icon={faPlus} size="lg" />
          <div>
            {type === 'block'
              ? t('manage.activityWizard.newBlock')
              : t('manage.activityWizard.newStack')}
          </div>
        </button>
      )}
    </div>
  )
}

export default AddStackButton
