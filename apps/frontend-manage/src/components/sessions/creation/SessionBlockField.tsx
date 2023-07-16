import { FieldArray, FieldArrayRenderProps, useField } from 'formik'
import AddBlockButton from './AddBlockButton'
import SessionCreationBlock from './SessionCreationBlock'
import WizardErrorMessage from './WizardErrorMessage'

interface EditorFieldProps {
  label?: string
  fieldName: string
  tooltip?: string
  className?: string
}

function SessionBlockField({
  label,
  fieldName,
  tooltip,
  className,
}: EditorFieldProps) {
  const [field, meta, helpers] = useField(fieldName)

  return (
    <>
      <div className="flex flex-col md:flex-row flex-1 gap-2 mt-1 md:mt-0 md:overflow-auto">
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
                />
              ))}
              <AddBlockButton push={push} />
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
