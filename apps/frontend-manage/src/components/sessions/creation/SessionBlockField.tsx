import { Question } from '@klicker-uzh/graphql/dist/ops'
import { FieldArray, FieldArrayRenderProps, useField } from 'formik'
import AddBlockButton from './AddBlockButton'
import SessionCreationBlock from './SessionCreationBlock'
import WizardErrorMessage from './WizardErrorMessage'

interface EditorFieldProps {
  label?: string
  fieldName: string
  tooltip?: string
  selection?: Record<number, Question>
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
                  selection={selection}
                  resetSelection={resetSelection}
                />
              ))}
              <AddBlockButton
                push={push}
                selection={selection}
                resetSelection={resetSelection}
              />
            </>
          )}
        </FieldArray>
        <div className="text-sm text-red-400 px-4">
          <WizardErrorMessage fieldName="blocks" />
          {typeof meta.error === 'string' && meta.error}
        </div>
      </div>
    </>
  )
}

export default SessionBlockField
