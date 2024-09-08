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
import { Button, FormLabel, Tooltip } from '@uzh-bf/design-system'
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
  onPrevStep,
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
        <Form className="h-full w-full">
          <CreationFormValidator
            isValid={isValid}
            activeStep={activeStep}
            setStepValidity={setStepValidity}
          />
          <div className="flex h-full w-full flex-col justify-between gap-1">
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
              <div className="h-max w-full">
                <FieldArray name="clues">
                  {({ push, remove, replace }: FieldArrayRenderProps) => (
                    <div className="w-full">
                      <div className="-mb-1.5 flex flex-row items-center">
                        <FormLabel
                          required
                          label={t('shared.generic.clues')}
                          labelType="small"
                          tooltip={t(
                            'manage.sessionForms.groupActivityCluesDescription'
                          )}
                          className={{ label: 'mt-0' }}
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
                            className={{
                              tooltip: 'z-30 text-sm',
                              trigger: 'mt-[0.05rem]',
                            }}
                          >
                            <FontAwesomeIcon
                              icon={faCircleExclamation}
                              className="text-red-600"
                            />
                          </Tooltip>
                        )}
                      </div>
                      <div className="mt-3 grid max-h-32 w-full grid-cols-1 gap-2 overflow-y-auto md:grid-cols-2 lg:grid-cols-3">
                        {values.clues.map((clue, ix) => (
                          <div
                            key={`${clue.name}-position-${ix}`}
                            className={twMerge(
                              'flex w-full flex-row justify-between rounded border text-sm',
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
                              <div className="h-full w-full border-black">
                                {clue.type === ParameterType.Number && clue.unit
                                  ? `${clue.value} ${clue.unit}`
                                  : clue.value}
                              </div>
                            </div>
                            <div className="flex h-full flex-col">
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
              onPrevStep={() => onPrevStep!(values)}
              onCloseWizard={closeWizard}
            />
          </div>
        </Form>
      )}
    </Formik>
  )
}

export default GroupActivityStackClues
