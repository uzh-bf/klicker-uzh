import { faSquare } from '@fortawesome/free-regular-svg-icons'
import { faPlus } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Element, ElementType } from '@klicker-uzh/graphql/dist/ops'
import { Button } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import * as R from 'ramda'
import { useDrop } from 'react-dnd'
import { twMerge } from 'tailwind-merge'
import { QuestionDragDropTypes } from '../../questions/Question'
import { ElementStackFormValues } from './WizardLayout'

interface AddStackButtonProps {
  push: (value: ElementStackFormValues) => void
  selection?: Record<number, Element>
  resetSelection?: () => void
  acceptedTypes: ElementType[]
}

function AddStackButton({
  push,
  selection,
  resetSelection,
  acceptedTypes,
}: AddStackButtonProps) {
  const t = useTranslations()
  const [{ isOver }, drop] = useDrop(
    () => ({
      accept: acceptedTypes,
      drop: (item: QuestionDragDropTypes) => {
        push({
          displayName: '',
          description: '',
          elementIds: [item.id],
          titles: [item.title],
          types: [item.questionType],
          hasSampleSolutions: [item.hasSampleSolution],
        })
      },
      collect: (monitor) => ({
        isOver: !!monitor.isOver(),
      }),
    }),
    []
  )

  return (
    <div className="flex flex-row gap-2">
      {selection && !R.isEmpty(selection) && (
        <div className="flex flex-col gap-1.5">
          <Button
            fluid
            className={{
              root: 'text-sm max-w-[135px] flex-1 flex flex-col gap-1 justify-center hover:bg-orange-200 hover:border-orange-400 hover:text-orange-900 bg-orange-100 border-orange-300',
            }}
            onClick={() => {
              const { elementIds, titles, types, hasSampleSolutions } =
                Object.values(selection).reduce<ElementStackFormValues>(
                  (acc, question) => {
                    acc.elementIds.push(question.id)
                    acc.titles.push(question.name)
                    acc.types.push(question.type)
                    return acc
                  },
                  {
                    elementIds: [],
                    titles: [],
                    types: [],
                    hasSampleSolutions: [],
                  }
                )

              push({
                displayName: '',
                description: '',
                elementIds: elementIds,
                titles: titles,
                types: types,
                hasSampleSolutions: hasSampleSolutions,
              })
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
              root: 'text-sm max-w-[135px] flex-1 flex flex-col gap-2 justify-center hover:bg-orange-200 hover:border-orange-400 hover:text-orange-900 bg-orange-100 border-orange-300',
            }}
            onClick={() => {
              Object.values(selection).forEach((question) => {
                push({
                  displayName: '',
                  description: '',
                  elementIds: [question.id],
                  titles: [question.name],
                  types: [question.type],
                  hasSampleSolutions: [question.options.hasSampleSolution],
                })
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
              {t('manage.sessionForms.pasteSingleQuestions', {
                count: Object.keys(selection).length,
              })}
            </div>
          </Button>
        </div>
      )}
      <div
        className={twMerge(
          'flex flex-col items-center justify-center rounded text-center border border-solid md:w-16 cursor-pointer hover:bg-primary-20 w-full p-2',
          isOver && 'bg-primary-20'
        )}
        onClick={() =>
          push({
            displayName: '',
            description: '',
            elementIds: [],
            titles: [],
            types: [],
            hasSampleSolutions: [],
          })
        }
        data-cy="drop-elements-add-stack"
        ref={drop}
      >
        <FontAwesomeIcon icon={faPlus} size="lg" />
        <div>{t('manage.sessionForms.newStack')}</div>
      </div>
    </div>
  )
}

export default AddStackButton
