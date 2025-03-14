import { ActivityType } from '@klicker-uzh/graphql/dist/ops'
import { Markdown } from '@klicker-uzh/markdown'
import { H3 } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

function TemplateInfo({
  activityType,
  name,
  instructions,
}: {
  activityType: ActivityType
  name: string
  instructions: string
}) {
  const t = useTranslations()

  return (
    <div>
      <div>
        {t(`manage.template.templateInfo${activityType}`, {
          templateName: name,
        })}
      </div>
      <div className="mt-3 rounded-lg bg-gray-100 px-3 pb-2 pt-1">
        <H3>{t('shared.generic.instructions')}</H3>
        <Markdown content={instructions} />
      </div>
    </div>
  )
}

export default TemplateInfo
