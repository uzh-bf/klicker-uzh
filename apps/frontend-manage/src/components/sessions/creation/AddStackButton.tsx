import { faSquare } from '@fortawesome/free-regular-svg-icons'
import { faPlus } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Element, ElementType } from '@klicker-uzh/graphql/dist/ops'
import { Button } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useDrop } from 'react-dnd'
import { isEmpty } from 'remeda'
import { twMerge } from 'tailwind-merge'
import { QuestionDragDropTypes } from '../../questions/Question'
import { ElementBlockFormValues, ElementStackFormValues } from './WizardLayout'

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
      drop: (item: QuestionDragDropTypes) => {
        const initialElements = [
          {
            id: item.id,
            title: item.title,
            type: item.questionType,
            hasSampleSolution: item.hasSampleSolution,
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
              root: 'flex max-w-[135px] flex-1 flex-col justify-center gap-1 border-orange-300 bg-orange-100 text-sm hover:border-orange-400 hover:bg-orange-200 hover:text-orange-900',
            }}
            onClick={() => {
              const elements = Object.values(selection).map((question) => ({
                id: question.id,
                title: question.name,
                type: question.type,
                hasSampleSolution:
                  'options' in question
                    ? (question.options.hasSampleSolution ?? false)
                    : true,
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
            <Button.Icon>
              <FontAwesomeIcon icon={faSquare} />
            </Button.Icon>
            <Button.Label>
              {t('manage.sessionForms.newStackSelected', {
                count: Object.keys(selection).length,
              })}
            </Button.Label>
          </Button>
          <Button
            fluid
            className={{
              root: 'flex max-w-[135px] flex-1 flex-col justify-center gap-2 border-orange-300 bg-orange-100 text-sm hover:border-orange-400 hover:bg-orange-200 hover:text-orange-900',
            }}
            onClick={() => {
              Object.values(selection).forEach((question) => {
                const elements = [
                  {
                    id: question.id,
                    title: question.name,
                    type: question.type,
                    hasSampleSolution:
                      'options' in question
                        ? (question.options.hasSampleSolution ?? false)
                        : true,
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
            <div>
              {t('manage.sessionForms.pasteSingleElementsStack', {
                count: Object.keys(selection).length,
              })}
            </div>
          </Button>
        </div>
      )}
      {drop(
        <div
          className={twMerge(
            'hover:bg-primary-20 flex w-full cursor-pointer flex-col items-center justify-center rounded border border-solid p-2 text-center md:w-16',
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
          data-cy="drop-elements-add-stack"
        >
          <FontAwesomeIcon icon={faPlus} size="lg" />
          <div>{t('manage.sessionForms.newStack')}</div>
        </div>
      )}
    </div>
  )
}

export default AddStackButton
