import { faClock } from '@fortawesome/free-regular-svg-icons'
import { faCheckCircle, faUserGroup } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  ActivityInfoStack,
  PublicationStatus,
} from '@klicker-uzh/graphql/dist/ops'
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  RadioGroupItem,
} from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import ActivityOutdatedElementWarning from './ActivityOutdatedElementWarning'

function ActivityDetailsStack({
  stack,
  stackIx,
  outdatedInstances,
  selectedInstance,
  activityStatus,
  isLiveQuiz,
}: {
  stack: ActivityInfoStack
  stackIx: number
  outdatedInstances: number[]
  selectedInstance: string
  activityStatus: PublicationStatus
  isLiveQuiz: boolean
}) {
  const t = useTranslations()

  return (
    <AccordionItem
      value={String(stack.id)}
      key={stack.id}
      className="m-0 w-full space-y-0 border-gray-300 p-2 last:border-b"
    >
      <div className="w-full">
        <AccordionTrigger
          className="group flex w-full flex-row items-center justify-between p-2 hover:no-underline"
          data-cy={`activity-details-accordion-trigger-${stackIx}`}
        >
          <span className="flex-1 font-bold group-hover:underline">
            {isLiveQuiz
              ? t('shared.generic.blockN', {
                  number: stackIx + 1,
                })
              : t('shared.generic.stackN', {
                  number: stackIx + 1,
                })}
          </span>
          <div className="flex flex-row items-center justify-end gap-3">
            {stack.elements.some((element) =>
              outdatedInstances.includes(element.instance.id)
            ) ? (
              <ActivityOutdatedElementWarning status={activityStatus} />
            ) : null}
            {stack.stackPoints !== null ? (
              <span className="text-uzh-darkgreen-100">
                {stack.stackPoints} P.
              </span>
            ) : null}
            {stack.timeLimit !== null ? (
              <div className="flex flex-row items-center gap-1.5 text-orange-500 no-underline">
                <div>{`${stack.timeLimit}s`}</div>
                <FontAwesomeIcon icon={faClock} className="w-4" />
              </div>
            ) : null}
            {stack.numOfParticipants !== null ? (
              <div className="flex flex-row items-center gap-1 no-underline">
                <div>{stack.numOfParticipants}</div>
                <FontAwesomeIcon icon={faUserGroup} className="w-4" />
              </div>
            ) : null}
          </div>
        </AccordionTrigger>

        <AccordionContent className="pb-2">
          <div className="float-right text-sm">
            {t('shared.generic.Nelements', {
              number: stack.elements?.length,
            })}
          </div>
          {stack.elements.map((element, instanceIx) => {
            const instance = element.instance
            const isSelectedInstance = selectedInstance === String(instance.id)
            const isOutdatedInstance = outdatedInstances.includes(instance.id)

            return (
              <label
                key={instance.id}
                htmlFor={String(instance.id)}
                className={twMerge(
                  'hover:bg-accent border-border mb-2 flex w-full cursor-pointer flex-row items-center rounded border pb-3 pt-3',
                  isOutdatedInstance && 'bg-uzh-red-20/50 hover:bg-uzh-red-20'
                )}
                data-cy={`stack-${stackIx}-instance-${instanceIx}`}
              >
                <div className="flex w-[calc(100%-2rem)] flex-row">
                  <RadioGroupItem
                    value={String(instance.id)}
                    id={String(instance.id)}
                    className="invisible cursor-pointer"
                  />

                  {isSelectedInstance ? (
                    <FontAwesomeIcon
                      icon={faCheckCircle}
                      className={twMerge('text-uzh-blue-100 text-lg')}
                    />
                  ) : null}

                  <span
                    className={twMerge(
                      'line-clamp-1 font-semibold',
                      isSelectedInstance ? 'pl-3' : 'pl-7.5'
                    )}
                  >
                    {`${t(`shared.${instance.elementData.type}.short`)}: ${instance.elementData.name}`}
                  </span>
                </div>
                {isOutdatedInstance ? (
                  <ActivityOutdatedElementWarning status={activityStatus} />
                ) : null}
              </label>
            )
          })}
        </AccordionContent>
      </div>
    </AccordionItem>
  )
}

export default ActivityDetailsStack
