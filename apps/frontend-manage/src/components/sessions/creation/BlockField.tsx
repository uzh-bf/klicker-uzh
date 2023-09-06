import { Label } from '@uzh-bf/design-system'
import { FieldArray, FieldArrayRenderProps, useField } from 'formik'
import { useTranslations } from 'next-intl'
import AddQuestionField from './AddQuestionField'
import QuestionBlock from './QuestionBlock'
import WizardErrorMessage from './WizardErrorMessage'
interface BlockFieldProps {
  fieldName: string
}

function BlockField({ fieldName }: BlockFieldProps) {
  const t = useTranslations()
  const [field, meta, helpers] = useField(fieldName)

  return (
    <div>
      <div className="flex flex-row items-center flex-1 gap-2">
        <Label
          required
          label={`${t('shared.generic.questions')}:`}
          className={{
            root: 'font-bold',
            tooltip: 'font-normal text-sm !w-1/2 z-20',
          }}
          tooltip={t('manage.sessionForms.questionsDragDrop')}
          showTooltipSymbol={true}
        />
        <FieldArray name={fieldName}>
          {({ push, remove, move }: FieldArrayRenderProps) => (
            <div className="flex flex-row gap-1 overflow-auto">
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
      {meta.error && (
        <div className="text-sm text-red-400">
          <WizardErrorMessage fieldName="questions" />
          {typeof meta.error === 'string' && meta.error}
        </div>
      )}
    </div>
  )
}

export default BlockField
