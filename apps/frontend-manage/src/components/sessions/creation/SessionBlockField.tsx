import { Label } from '@uzh-bf/design-system'
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
    <div>
      <div className="flex flex-row items-center flex-1 gap-2">
        <Label
          label="Frageblöcke:"
          className={{
            root: 'font-bold',
            tooltip: 'font-normal text-sm !w-1/2',
          }}
          tooltip="Fügen Sie mittels Drag&Drop auf das Plus-Icon Fragen zu Ihren Blöcken hinzu. Neue Blöcken können entweder ebenfalls durch Drag&Drop auf das entsprechende Feld oder durch Klicken auf den Button erstellt werden."
          showTooltipSymbol={true}
        />
        <FieldArray name="blocks">
          {({ push, remove, move, replace }: FieldArrayRenderProps) => (
            <div className="flex flex-row gap-1 overflow-scroll">
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
            </div>
          )}
        </FieldArray>
      </div>
      <div className="text-sm text-red-400">
        <WizardErrorMessage fieldName={`${fieldName}[0].questionIds`} />
        {typeof meta.error === 'string' && meta.error}
      </div>
    </div>
  )
}

export default SessionBlockField
