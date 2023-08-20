import { FieldArray, FieldArrayRenderProps, useField } from 'formik'
import AddBlockButton from './AddBlockButton'
import SessionCreationBlock from './SessionCreationBlock'
import WizardErrorMessage from './WizardErrorMessage'

interface EditorFieldProps {
  label?: string
  fieldName: string
  tooltip?: string
  selection?: { id: number; title: string }[]
  resetSelection?: () => void
  className?: string
}

function SessionBlockField({
  label,
  fieldName,
  tooltip,
  selection,
  resetSelection,
  className,
}: EditorFieldProps) {
  const [field, meta, helpers] = useField(fieldName)

  return (
    <>
      <div className="flex flex-col md:flex-row flex-1 gap-4 mt-1 md:mt-0 md:overflow-auto">
        <FieldArray name="blocks">
          {({ push, remove, move, replace }: FieldArrayRenderProps) => (
            <>
              {field.value.map((block: any, index: number) => (
                <SessionCreationBlock
                  key={`${index}-${block.questionIds.join('')}`}
                  index={index}
                  block={block}
                  numOfBlocks={field.value.length}
                  remove={remove}
                  move={move}
                  replace={replace}
                  selectionAvailable={(selection?.length || 0) > 0}
                  addSelected={() => {
                    if (selection) {
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

                      replace(index, {
                        ...block,
                        questionIds: [...block.questionIds, ...questionIds],
                        titles: [...block.titles, ...titles],
                      })
                      resetSelection && resetSelection()
                    }
                  }}
                />
              ))}
              <AddBlockButton
                push={push}
                selectionAvailable={(selection?.length || 0) > 0}
                addSelected={() => {
                  if (selection) {
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
                  }
                }}
                addSelectedSingle={() => {
                  if (selection) {
                    selection.forEach((question) => {
                      push({
                        questionIds: [question.id],
                        titles: [question.title],
                        timeLimit: undefined,
                      })
                    })
                    resetSelection && resetSelection()
                  }
                }}
              />
            </>
          )}
        </FieldArray>
      </div>
      <div className="text-sm text-red-400">
        <WizardErrorMessage fieldName={`${fieldName}[0].questionIds`} />
        {typeof meta.error === 'string' && meta.error}
      </div>
    </>
  )
}

export default SessionBlockField
