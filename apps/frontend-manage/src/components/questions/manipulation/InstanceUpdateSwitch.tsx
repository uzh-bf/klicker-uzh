import { useQuery } from '@apollo/client'
import { faClock } from '@fortawesome/free-regular-svg-icons'
import { faPencil } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  GetInstanceUpdateActivitiesDocument,
  PublicationStatus,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { H4, Prose, Switch } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { Dispatch, SetStateAction } from 'react'
import { twMerge } from 'tailwind-merge'

interface InstanceUpdateSwitchProps {
  elementId: number
  hasSampleSolution?: boolean
  updateInstances: boolean
  setUpdateInstances: Dispatch<SetStateAction<boolean>>
}

function InstanceUpdateSwitch({
  elementId,
  hasSampleSolution,
  updateInstances,
  setUpdateInstances,
}: InstanceUpdateSwitchProps) {
  const t = useTranslations()
  const { data, loading } = useQuery(GetInstanceUpdateActivitiesDocument, {
    variables: { elementId, hasSampleSolution },
    fetchPolicy: 'cache-and-network',
    skip: !updateInstances,
  })

  return (
    <div
      className={twMerge(
        'mt-3 flex flex-row items-start gap-6 rounded-md border border-solid p-2',
        updateInstances && 'border-orange-200 bg-orange-100'
      )}
    >
      <Switch
        checked={updateInstances}
        onCheckedChange={() => setUpdateInstances((prev) => !prev)}
        data={{ cy: 'instance-update-switch' }}
      />
      <div>
        <H4 className={{ root: 'm-0' }}>
          {t('manage.questionForms.updateInstances')}
        </H4>
        <Prose className={{ root: 'prose-xs max-w-none' }}>
          {t('manage.questionForms.updateInstancesExplanation')}
        </Prose>
        {loading && <Loader />}
        {data?.getInstanceUpdateActivities && (
          <div className="mt-2 border-t border-gray-200">
            {data?.getInstanceUpdateActivities?.map((activity, ix) => (
              <div
                key={`instance-update-list-${activity.activityName}`}
                className="border-b border-gray-200"
                data-cy={`instance-update-list-activity-${activity.activityName}`}
              >
                <div className="flex items-center gap-2 py-0.5">
                  <span
                    className={twMerge(
                      'flex w-24 flex-row items-center justify-center gap-1.5 rounded px-2 py-0.5 text-xs',
                      activity.status === PublicationStatus.Draft
                        ? 'bg-gray-200'
                        : 'bg-orange-300'
                    )}
                  >
                    <FontAwesomeIcon
                      icon={
                        activity.status === PublicationStatus.Draft
                          ? faPencil
                          : faClock
                      }
                    />
                    <div>{t(`shared.${activity.status}.statusLabel`)}</div>
                  </span>
                  <span className="font-medium">{activity.activityName}</span>
                  <span className="text-xs text-gray-500">
                    ({t(`shared.types.${activity.activityType}`)})
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default InstanceUpdateSwitch
