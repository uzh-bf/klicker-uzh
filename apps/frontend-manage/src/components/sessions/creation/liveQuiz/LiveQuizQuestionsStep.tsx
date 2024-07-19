import { FieldArray, FieldArrayRenderProps, useField } from 'formik'
import AddBlockButton from '../AddBlockButton'
import LiveQuizCreationBlock from './LiveQuizCreationBlock'
import { LiveQuizWizardStepProps } from './LiveSessionWizard'

function LiveQuizQuestionsStep(props: LiveQuizWizardStepProps) {
  const [field, meta] = useField('blocks')

  return (
    <div className="mt-1 md:mt-0 md:overflow-x-auto">
      <FieldArray name="blocks" className="w-fit">
        {({ push, remove, move, replace }: FieldArrayRenderProps) => (
          <div className="flex flex-col md:flex-row gap-4 overflow-x-auto w-fit">
            {field.value.map((block: any, index: number) => (
              <LiveQuizCreationBlock
                key={`${index}-${block.questionIds.join('')}`}
                index={index}
                block={block}
                numOfBlocks={field.value.length}
                remove={remove}
                move={move}
                replace={replace}
                selection={props.selection}
                resetSelection={props.resetSelection}
                error={meta.error as any}
              />
            ))}
            <AddBlockButton
              push={push}
              selection={props.selection}
              resetSelection={props.resetSelection}
            />
          </div>
        )}
      </FieldArray>
    </div>
  )
}

export default LiveQuizQuestionsStep
