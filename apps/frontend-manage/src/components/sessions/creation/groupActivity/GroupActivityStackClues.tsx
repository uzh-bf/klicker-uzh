import { faTrashCan } from '@fortawesome/free-regular-svg-icons'
import {
  faCircleExclamation,
  faPencil,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  Element,
  ElementType,
  ParameterType,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, Label, Tooltip } from '@uzh-bf/design-system'
import { FieldArray, FieldArrayRenderProps, useFormikContext } from 'formik'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { GroupActivityFormValues } from '../MultistepWizard'
import StackBlockCreation from '../StackBlockCreation'
import GroupActivityClueModal from './GroupActivityClueModal'

interface GroupActivityStackCluesProps {
  validationSchema: any
  acceptedTypes: ElementType[]
  selection: Record<number, Element>
  resetSelection: () => void
}

function GroupActivityStackClues({
  acceptedTypes,
  selection,
  resetSelection,
}: GroupActivityStackCluesProps) {
  const t = useTranslations()
  const { values, setFieldValue, getFieldMeta } =
    useFormikContext<GroupActivityFormValues>()
  const metaClues = getFieldMeta('clues')
  const metaStack = getFieldMeta('stack')
  const [clueIx, setClueIx] = useState<number | undefined>(undefined)
  const [clueModal, setClueModal] = useState(false)

  console.log(metaClues.error)

  return (
    <div className="flex flex-row gap-3">
      <StackBlockCreation
        singleStackMode
        index={0}
        key={`stack-${values.stack.elementIds.join('')}`}
        stack={values.stack}
        acceptedTypes={acceptedTypes}
        replace={(_, newValue) => setFieldValue('stack', newValue)}
        selection={selection}
        resetSelection={resetSelection}
        error={metaStack.error as any}
        className="w-80"
      />
      <div className="w-full h-max">
        <FieldArray name="clues">
          {({ push, remove, replace }: FieldArrayRenderProps) => (
            <div className="w-full">
              <div className="flex flex-row items-center -mb-1.5">
                <Label
                  required
                  showTooltipSymbol
                  label={t('shared.generic.clues')}
                  tooltip={t(
                    'manage.sessionForms.groupActivityCluesDescription'
                  )}
                  className={{
                    root: 'mr-2 min-w-max font-bold leading-6 text-gray-600 text-base',
                    tooltip: 'text-sm font-normal z-30',
                    tooltipSymbol: 'h-2 w-2',
                  }}
                />
                {metaClues.error && (
                  <Tooltip
                    tooltip={
                      Array.isArray(metaClues.error) ? (
                        <ul>
                          {metaClues.error.flatMap(
                            (error: { name: string }, ix: number) =>
                              error && (
                                <li key={`error-clue-${ix}`}>{`${t(
                                  'shared.generic.clueN',
                                  {
                                    number: ix + 1,
                                  }
                                )}: ${error.name}`}</li>
                              )
                          )}
                        </ul>
                      ) : (
                        metaClues.error
                      )
                    }
                    delay={0}
                    className={{ tooltip: 'text-sm z-30' }}
                  >
                    <FontAwesomeIcon
                      icon={faCircleExclamation}
                      className="text-red-600"
                    />
                  </Tooltip>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 mt-3 w-full max-h-32 overflow-y-auto">
                {values.clues.map((clue, ix) => (
                  <div
                    key={clue.name}
                    className={twMerge(
                      'text-sm rounded flex flex-row justify-between w-full border',
                      Array.isArray(metaClues.error) &&
                        metaClues.error.length > ix &&
                        metaClues.error[ix]
                        ? 'border-red-600'
                        : 'border-uzh-grey-40'
                    )}
                    data-cy={`groupActivity-clue-${clue.name}`}
                  >
                    <div className="flex flex-col p-1">
                      <div className="font-bold">{clue.name}</div>
                      <div className="border-black h-full w-full">
                        {clue.type === ParameterType.Number && clue.unit
                          ? `${clue.value} ${clue.unit}`
                          : clue.value}
                      </div>
                    </div>
                    <div className="h-full flex flex-col">
                      <Button
                        className={{ root: 'h-1/2' }}
                        data={{ cy: `edit-clue-${clue.name}` }}
                        onClick={() => {
                          setClueIx(ix)
                          setClueModal(true)
                        }}
                      >
                        <FontAwesomeIcon icon={faPencil} />
                      </Button>
                      <Button
                        className={{ root: 'h-1/2 bg-red-600 text-white' }}
                        data={{ cy: `remove-clue-${clue.name}` }}
                        onClick={() => remove(ix)}
                      >
                        <FontAwesomeIcon icon={faTrashCan} />
                      </Button>
                    </div>
                  </div>
                ))}
                <GroupActivityClueModal
                  open={clueModal}
                  setOpen={setClueModal}
                  pushClue={(values) => {
                    push(values)
                    setClueIx(undefined)
                  }}
                  replaceClue={(values) => {
                    replace(clueIx ?? -1, values)
                    setClueIx(undefined)
                  }}
                  initialValues={
                    typeof clueIx !== 'undefined'
                      ? values.clues[clueIx]
                      : undefined
                  }
                  clueIx={clueIx}
                  unsetClueIx={() => setClueIx(undefined)}
                />
              </div>
            </div>
          )}
        </FieldArray>
      </div>
    </div>
  )
}

export default GroupActivityStackClues
