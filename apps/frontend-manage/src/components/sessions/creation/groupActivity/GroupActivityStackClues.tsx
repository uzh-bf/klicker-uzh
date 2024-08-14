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
import { FieldArray, FieldArrayRenderProps, Form, Formik } from 'formik'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import CreationFormValidator from '../CreationFormValidator'
import StackBlockCreation from '../StackBlockCreation'
import WizardNavigation from '../WizardNavigation'
import GroupActivityClueModal from './GroupActivityClueModal'
import { GroupActivityWizardStepProps } from './GroupActivityWizard'

interface GroupActivityStackCluesProps extends GroupActivityWizardStepProps {
  acceptedTypes: ElementType[]
  selection: Record<number, Element>
  resetSelection: () => void
}

function GroupActivityStackClues({
  acceptedTypes,
  selection,
  resetSelection,
  editMode,
  formRef,
  formData,
  continueDisabled,
  activeStep,
  stepValidity,
  validationSchema,
  setStepValidity,
  onSubmit,
  closeWizard,
}: GroupActivityStackCluesProps) {
  const t = useTranslations()
  const [clueIx, setClueIx] = useState<number | undefined>(undefined)
  const [clueModal, setClueModal] = useState(false)

  return (
    <Formik
      validateOnMount
      initialValues={formData}
      onSubmit={onSubmit!}
      innerRef={formRef}
      validationSchema={validationSchema}
    >
      {({ values, isValid, isSubmitting, setFieldValue, errors }) => (
        <Form className="w-full h-full">
          <CreationFormValidator
            isValid={isValid}
            activeStep={activeStep}
            setStepValidity={setStepValidity}
          />
          <div className="flex flex-col w-full h-full justify-between gap-1">
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
                error={errors.stack as any}
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
                        {errors.clues && (
                          <Tooltip
                            tooltip={
                              Array.isArray(errors.clues) ? (
                                <ul>
                                  {errors.clues.flatMap(
                                    (error, ix) =>
                                      error && (
                                        <li key={`error-clue-${ix}`}>{`${t(
                                          'shared.generic.clueN',
                                          {
                                            number: ix + 1,
                                          }
                                        )}: ${
                                          typeof error === 'string'
                                            ? error
                                            : error.name
                                        }`}</li>
                                      )
                                  )}
                                </ul>
                              ) : (
                                errors.clues
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
                              Array.isArray(errors.clues) &&
                                errors.clues.length > ix &&
                                errors.clues[ix]
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
                                className={{
                                  root: 'h-1/2 bg-red-600 text-white',
                                }}
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
            <WizardNavigation
              editMode={editMode}
              isSubmitting={isSubmitting}
              stepValidity={stepValidity}
              activeStep={activeStep}
              lastStep={activeStep === stepValidity.length - 1}
              continueDisabled={continueDisabled}
              onCloseWizard={closeWizard}
            />
          </div>
        </Form>
      )}
    </Formik>
  )
}

export default GroupActivityStackClues
