import { Element, ElementType } from '@klicker-uzh/graphql/dist/ops'
import { FieldArray, FieldArrayRenderProps, useField } from 'formik'
import AddStackButton from './AddStackButton'
import { ElementStackFormValues } from './MultistepWizard'
import StackBlockCreation from './StackBlockCreation'

export interface StackCreationStepProps {
  validationSchema: any
  acceptedTypes: ElementType[]
  selection: Record<number, Element>
  resetSelection: () => void
}

function StackCreationStep(props: StackCreationStepProps) {
  const [field, meta] = useField('stacks')

  return (
    <div className="mt-1 md:mt-0 md:overflow-x-auto">
      <FieldArray name="stacks" className="w-fit">
        {({ push, remove, move, replace }: FieldArrayRenderProps) => (
          <div className="flex flex-row gap-4 overflow-x-auto w-fit">
            {field.value.map((stack: ElementStackFormValues, index: number) => (
              <StackBlockCreation
                key={`${index}-${stack.elementIds.join('')}`}
                index={index}
                stack={stack}
                numOfStacks={field.value.length}
                acceptedTypes={props.acceptedTypes}
                remove={remove}
                move={move}
                replace={replace}
                selection={props.selection}
                resetSelection={props.resetSelection}
                error={meta.error as any}
              />
            ))}
            <AddStackButton
              push={push}
              selection={props.selection}
              resetSelection={props.resetSelection}
              acceptedTypes={props.acceptedTypes}
            />
          </div>
        )}
      </FieldArray>
    </div>
  )
}

export default StackCreationStep
