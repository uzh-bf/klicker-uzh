import { Label } from '@uzh-bf/design-system'
import { FieldArray, FieldArrayRenderProps, useField } from 'formik'
import AddQuestionField from './AddQuestionField'
import QuestionBlock from './QuestionBlock'
interface BlockFieldProps {
  label?: string
  fieldName: string
  tooltip?: string
  className?: string
}

function BlockField({ label, fieldName, tooltip, className }: BlockFieldProps) {
  const [field, meta, helpers] = useField(fieldName)

  console.log('field', field)
  console.log('meta', meta)
  console.log('helpers', helpers)

  return (
    <div className="flex flex-row items-center flex-1 gap-2">
      <Label
        required
        label="Fragen:"
        className={{
          root: 'font-bold',
          tooltip: 'font-normal text-sm !w-1/2',
        }}
        tooltip="Fügen Sie mittels Drag&Drop Fragen zu Ihrer Micro-Session hinzu."
        showTooltipSymbol={true}
      />
      <FieldArray name="questions">
        {({ push, remove, move }: FieldArrayRenderProps) => (
          <div className="flex flex-row gap-1 overflow-scroll">
            {field.value.map((question: any, index: number) => (
              <QuestionBlock
                key={`${question.id}-${index}`}
                index={index}
                question={question}
                numOfBlocks={field.value.length}
                remove={remove}
                move={move}
              />
            ))}
            <AddQuestionField push={push} />
          </div>
        )}
      </FieldArray>
    </div>
  )
}

export default BlockField
