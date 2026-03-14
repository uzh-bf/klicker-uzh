import { ApolloQueryResult } from '@apollo/client'
import { faArrowsRotate, faInfoCircle } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  Exact,
  GetOutdatedElementInstancesQuery,
  Scalars,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, Tooltip, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import {
  GroupActivityFormValues,
  LiveQuizFormValues,
  MicroLearningFormValues,
  PollFormValues,
  PracticeQuizFormValues,
} from './WizardLayout'

export type OutdatedInstancesRefetchFunction = (
  variables?:
    | Partial<
        Exact<{
          instanceIds: Array<Scalars['Int']['input']> | Scalars['Int']['input']
        }>
      >
    | undefined
) => Promise<ApolloQueryResult<GetOutdatedElementInstancesQuery>>

function InstanceUpdateOption({
  values,
  loading,
  outdatedInstances,
  setValues,
  refetch,
}: {
  values:
    | LiveQuizFormValues
    | PollFormValues
    | PracticeQuizFormValues
    | MicroLearningFormValues
    | GroupActivityFormValues
  loading: boolean
  outdatedInstances: {
    id: number
    newTitle: string
    newSampleSolution: boolean
  }[]
  setValues: any
  refetch: OutdatedInstancesRefetchFunction
}) {
  const t = useTranslations()

  return (
    <UserNotification
      type="warning"
      className={{
        root: 'mb-1',
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
              <li>{t('manage.activityWizard.elementInstancesFrozen')}</li>
              <li>
                {t('manage.activityWizard.noInstanceUpdatePublishedActivities')}
              </li>
              <li>{t('manage.activityWizard.choiceOnDuplication')}</li>
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
          onClick={async () => {
            // replace all instances that are outdated with the latest element versions
            if ('blocks' in values) {
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
                      hasSampleSolution: outdatedInstance.newSampleSolution, // update the sample solution to the new one
                    }
                  }
                  return instance
                }),
              }))
              await setValues({ ...values, blocks: updatedBlocks })
            } else if ('stacks' in values) {
              // replace all instances that are outdated with the latest element versions
              const updatedStacks = values.stacks.map((stack) => ({
                ...stack,
                elements: stack.elements.map((instance) => {
                  const outdatedInstance = outdatedInstances.find(
                    (el) => el.id === instance.existingInstanceId
                  )

                  if (outdatedInstance) {
                    return {
                      ...instance,
                      existingInstanceId: null, // unset the existing instance ID to use the latest version of the element
                      duplicateInstance: false,
                      title: outdatedInstance.newTitle, // update the title to the new one
                      hasSampleSolution: outdatedInstance.newSampleSolution, // update the sample solution to the new one
                    }
                  }
                  return instance
                }),
              }))

              await setValues({ ...values, stacks: updatedStacks })
            } else if ('stack' in values) {
              // replace all instances that are outdated with the latest element versions
              const updatedStack = {
                ...values.stack,
                elements: values.stack.elements.map((instance) => {
                  const outdatedInstance = outdatedInstances.find(
                    (el) => el.id === instance.existingInstanceId
                  )
                  if (outdatedInstance) {
                    return {
                      ...instance,
                      existingInstanceId: null, // unset the existing instance ID to use the latest version of the element
                      duplicateInstance: false,
                      title: outdatedInstance.newTitle, // update the title to the new one
                      hasSampleSolution: outdatedInstance.newSampleSolution, // update the sample solution to the new one
                    }
                  }
                  return instance
                }),
              }

              await setValues({ ...values, stack: updatedStack })
            }

            await refetch({ instanceIds: [] })
          }}
          data={{ cy: 'update-all-outdated-instances' }}
        >
          <Button.Icon icon={faArrowsRotate} loading={loading} />
          <Button.Label>
            {t('manage.activityWizard.updateAllElements')}
          </Button.Label>
        </Button>
      </div>
    </UserNotification>
  )
}

export default InstanceUpdateOption
