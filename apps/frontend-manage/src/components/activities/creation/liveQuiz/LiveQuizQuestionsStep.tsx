import { useQuery } from '@apollo/client'
import { faArrowsRotate, faInfoCircle } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  Element,
  ElementType,
  GetOutdatedElementInstancesDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, Tooltip, UserNotification } from '@uzh-bf/design-system'
import { FieldArray, Form, Formik } from 'formik'
import { useTranslations } from 'next-intl'
import { useMemo } from 'react'
import { twMerge } from 'tailwind-merge'
import AddStackButton from '../AddStackButton'
import CreationFormValidator from '../CreationFormValidator'
import WizardNavigation from '../WizardNavigation'
import LiveQuizCreationBlock from './LiveQuizCreationBlock'
import { LiveQuizWizardStepProps } from './LiveQuizWizard'

interface LiveQuizQuestionsStepProps extends LiveQuizWizardStepProps {
  acceptedTypes: ElementType[]
  selection: Record<number, Element>
  resetSelection: () => void
}

function LiveQuizQuestionsStep({
  editMode,
  formRef,
  formData,
  acceptedTypes,
  continueDisabled,
  activeStep,
  stepValidity,
  validationSchema,
  setStepValidity,
  onSubmit,
  onPrevStep,
  closeWizard,
  selection,
  resetSelection,
}: LiveQuizQuestionsStepProps) {
  const t = useTranslations()

  // get all instances of elements alongside with the included element version
  const instanceVersionMap = useMemo(
    () =>
      formData.blocks.reduce<number[]>((acc, block) => {
        block.elements
          .filter((instance) => instance.existingInstanceId !== null)
          .forEach((instance) => {
            acc.push(instance.existingInstanceId!)
          })
        return acc
      }, []),
    [formData.blocks]
  )

  // query if any invalid element versions are used
  const { data, loading, refetch } = useQuery(
    GetOutdatedElementInstancesDocument,
    {
      variables: { instanceIds: instanceVersionMap },
      skip: instanceVersionMap.length === 0 || activeStep !== 3,
      fetchPolicy: 'network-only',
    }
  )
  const outdatedInstances = data?.getOutdatedElementInstances ?? []
  const showNotification = outdatedInstances.length > 0

  return (
    <Formik
      validateOnMount
      initialValues={formData}
      onSubmit={onSubmit!}
      innerRef={formRef}
      validationSchema={validationSchema}
    >
      {({ values, setValues, isValid, isSubmitting, errors }) => (
        <Form className="h-full w-full">
          <CreationFormValidator
            isValid={isValid}
            activeStep={activeStep}
            setStepValidity={setStepValidity}
          />
          <div className="flex h-full w-full flex-col justify-between gap-1">
            <div className="mt-1 md:mt-0 md:overflow-x-auto">
              {showNotification && (
                <UserNotification
                  type="warning"
                  className={{
                    root: 'mb-2',
                    content: 'flex flex-row items-center',
                  }}
                >
                  <div className="mr-8">
                    {t('manage.activityWizard.outdatedElementsWarning')}
                  </div>
                  <div className="flex flex-row gap-3">
                    <Tooltip
                      tooltip={
                        <ul className="list-inside list-disc">
                          <li>
                            {t('manage.activityWizard.elementInstancesFrozen')}
                          </li>
                          <li>
                            {t(
                              'manage.activityWizard.noInstanceUpdatePublishedActivities'
                            )}
                          </li>
                          <li>
                            {t('manage.activityWizard.choiceOnDuplication')}
                          </li>
                        </ul>
                      }
                      delay={0}
                      className={{
                        trigger: 'flex flex-row items-center gap-1.5',
                      }}
                    >
                      <FontAwesomeIcon icon={faInfoCircle} />
                      <span>{t('shared.generic.moreInformation')}</span>
                    </Tooltip>
                    <Button
                      className={{
                        root: 'hover:text-primary-100 -my-0.5 py-0.5 text-sm',
                      }}
                      loading={loading}
                      onClick={() => {
                        // replace all instances that are outdated with the latest element versions
                        const updatedBlocks = values.blocks.map((block) => ({
                          ...block,
                          elements: block.elements.map((instance) => {
                            const outdatedInstance = outdatedInstances.find(
                              (el) => el.id === instance.existingInstanceId
                            )

                            if (outdatedInstance) {
                              return {
                                ...instance,
                                existingInstanceId: null, // unset the existing instance ID to use the latest version of the element
                                duplicateInstance: false,
                                title: outdatedInstance.newTitle, // update the title to the new one
                                hasSampleSolution:
                                  outdatedInstance.newSampleSolution, // update the sample solution to the new one
                              }
                            }
                            return instance
                          }),
                        }))

                        setValues({ ...values, blocks: updatedBlocks })
                        refetch({ instanceIds: [] })
                      }}
                    >
                      <Button.Icon icon={faArrowsRotate} loading={loading} />
                      <Button.Label>
                        {t('manage.activityWizard.updateElements')}
                      </Button.Label>
                    </Button>
                  </div>
                </UserNotification>
              )}
              <FieldArray name="blocks">
                {({ push, remove, move, replace }) => (
                  <div
                    className={twMerge(
                      'flex w-fit flex-row gap-4 overflow-x-auto',
                      showNotification && 'h-40'
                    )}
                  >
                    {values.blocks.map((block, index) => (
                      <LiveQuizCreationBlock
                        key={`stack-${index}-${block.elements.map((e) => e.id).join('-')}`}
                        blockIx={index}
                        block={block}
                        numOfBlocks={values.blocks.length}
                        acceptedTypes={acceptedTypes}
                        remove={remove}
                        move={move}
                        replace={replace}
                        selection={selection}
                        resetSelection={resetSelection}
                        error={errors.blocks as any}
                      />
                    ))}
                    <AddStackButton
                      type="block"
                      push={push}
                      selection={selection}
                      resetSelection={resetSelection}
                      acceptedTypes={acceptedTypes}
                    />
                  </div>
                )}
              </FieldArray>
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

export default LiveQuizQuestionsStep
