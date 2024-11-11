import { H4, Prose, Switch } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { Dispatch, SetStateAction } from 'react'
import { twMerge } from 'tailwind-merge'

interface InstanceUpdateSwitchProps {
  updateInstances: boolean
  setUpdateInstances: Dispatch<SetStateAction<boolean>>
}

function InstanceUpdateSwitch({
  updateInstances,
  setUpdateInstances,
}: InstanceUpdateSwitchProps) {
  const t = useTranslations()

  return (
    <div
      className={twMerge(
        'mt-3 flex flex-row items-center gap-6 rounded border border-solid p-2',
        updateInstances && 'border-orange-200 bg-orange-100'
      )}
    >
      <Switch
        checked={updateInstances}
        onCheckedChange={() => setUpdateInstances((prev) => !prev)}
      />
      <div>
        <H4 className={{ root: 'm-0' }}>
          {t('manage.questionForms.updateInstances')}
        </H4>
        <Prose className={{ root: 'prose-xs max-w-none' }}>
          {t('manage.questionForms.updateInstancesExplanation')}
        </Prose>
      </div>
    </div>
  )
}

export default InstanceUpdateSwitch
