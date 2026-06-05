import { faClock } from '@fortawesome/free-regular-svg-icons'
import { faPencil } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { H4, Prose, Switch } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { Dispatch, SetStateAction, useMemo } from 'react'
import { twMerge } from 'tailwind-merge'
import { trpc } from '../../../lib/trpc'

const publicationStatus = {
  draft: 'DRAFT',
  template: 'TEMPLATE',
} as const

interface InstanceUpdateSwitchProps {
  elementId: number
  hasSampleSolution?: boolean
  updateInstances: boolean
  setUpdateInstances: Dispatch<SetStateAction<boolean>>
  includeTemplateUpdates: boolean
  setIncludeTemplateUpdates: Dispatch<SetStateAction<boolean>>
}

function InstanceUpdateSwitch({
  elementId,
  hasSampleSolution,
  updateInstances,
  setUpdateInstances,
  includeTemplateUpdates,
  setIncludeTemplateUpdates,
}: InstanceUpdateSwitchProps) {
  const t = useTranslations()
  const { data: user } = trpc.user.profile.useQuery()

  const { data, isLoading } = trpc.element.instanceUpdateActivities.useQuery(
    {
      elementId,
      hasSampleSolution,
      includeTemplateInstances: true,
    },
    { refetchOnMount: 'always' }
  )
  const instanceUpdateActivities = data?.instanceUpdateActivities

  const usedInTemplates = useMemo(() => {
    return (
      instanceUpdateActivities?.some(
        (activity) => activity.status === publicationStatus.template
      ) ?? false
    )
  }, [instanceUpdateActivities])

  if (!instanceUpdateActivities || instanceUpdateActivities.length === 0) {
    return null
  }

  return (
    <div
      className={twMerge(
        'mt-3 rounded-md border border-solid p-2',
        updateInstances && 'border-orange-200 bg-orange-100'
      )}
    >
      <div className="flex flex-row items-start gap-5">
        <Switch
          checked={updateInstances}
          onCheckedChange={() => setUpdateInstances((prev) => !prev)}
          data={{ cy: 'instance-update-switch' }}
        />
        <div>
          <H4 className={{ root: 'm-0' }}>
            {t('manage.elements.updateInstances')}
          </H4>
          <Prose className={{ root: 'prose-xs max-w-none' }}>
            {t('manage.elements.updateInstancesExplanation')}
          </Prose>
        </div>
      </div>

      {usedInTemplates && updateInstances && user?.privatePreview && (
        <div className="mt-2 flex flex-row items-center gap-5">
          <Switch
            checked={includeTemplateUpdates}
            onCheckedChange={() => {
              setIncludeTemplateUpdates((prev) => !prev)
            }}
            data={{ cy: 'template-update-switch' }}
          />
          <div>
            <H4 className={{ root: 'm-0' }}>
              {t('manage.elements.includeTemplateInstanceUpdates')}
            </H4>
          </div>
        </div>
      )}

      <div className="ml-17">
        {isLoading && (
          <Loader data={{ cy: 'instance-update-activities-loading' }} />
        )}
        {!isLoading && (
          <div className="mt-2 border-t border-gray-200">
            {instanceUpdateActivities
              .filter(
                (activity) =>
                  includeTemplateUpdates ||
                  activity.status !== publicationStatus.template
              )
              .map((activity) => (
                <div
                  key={`instance-update-list-${activity.activityName}`}
                  className="border-b border-gray-200"
                  data-cy={`instance-update-list-activity-${activity.activityName}`}
                >
                  <div className="flex items-center gap-2 py-0.5">
                    <span
                      className={twMerge(
                        'flex w-24 flex-row items-center justify-center gap-1.5 rounded px-2 py-0.5 text-xs',
                        activity.status === publicationStatus.draft
                          ? 'bg-gray-200'
                          : activity.status === publicationStatus.template
                            ? 'bg-primary-40'
                            : 'bg-orange-300'
                      )}
                    >
                      <FontAwesomeIcon
                        icon={
                          activity.status === publicationStatus.draft
                            ? faPencil
                            : faClock
                        }
                      />
                      <div>{t(`shared.${activity.status}.statusLabel`)}</div>
                    </span>
                    <span className="font-medium">{activity.activityName}</span>
                    <span className="text-xs text-gray-500">
                      ({t(`shared.types.${activity.activityType}`)}
                      {activity.status === publicationStatus.template
                        ? ` ${t('shared.generic.template')}`
                        : null}
                      )
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
