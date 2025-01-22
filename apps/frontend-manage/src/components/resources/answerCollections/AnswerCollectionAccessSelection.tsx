import { ObjectAccess } from '@klicker-uzh/graphql/dist/ops'
import { FormikSelectField } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import ObjectAccessLabel from '../../catalog/ObjectAccessLabel'

function AnswerCollectionAccessSelection() {
  const t = useTranslations()

  return (
    <FormikSelectField
      required
      name="access"
      label={t('manage.resources.access')}
      tooltip={t('manage.resources.accessTooltip')}
      items={[
        {
          value: ObjectAccess.Private,
          label: <ObjectAccessLabel accessType={ObjectAccess.Private} />,
          data: { cy: 'answer-collection-access-private' },
        },
        {
          value: ObjectAccess.Restricted,
          label: <ObjectAccessLabel accessType={ObjectAccess.Restricted} />,
          data: { cy: 'answer-collection-access-restricted' },
        },
        {
          value: ObjectAccess.Public,
          label: <ObjectAccessLabel accessType={ObjectAccess.Public} />,
          data: { cy: 'answer-collection-access-public' },
        },
      ]}
      data={{ cy: 'answer-collection-access' }}
      className={{ select: { trigger: 'h-9 w-40' } }}
    />
  )
}

export default AnswerCollectionAccessSelection
