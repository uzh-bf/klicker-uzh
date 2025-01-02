import { CollectionAccess } from '@klicker-uzh/graphql/dist/ops'
import { FormikSelectField } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import CollectionAccessLabel from './CollectionAccessLabel'

function AnswerCollectionAccessSelection({
  restrictedDisabled = false,
  privateDisabled = false,
}: {
  restrictedDisabled?: boolean
  privateDisabled?: boolean
}) {
  const t = useTranslations()

  return (
    <FormikSelectField
      required
      name="access"
      label={t('manage.resources.access')}
      tooltip={t('manage.resources.accessTooltip')}
      items={[
        {
          value: CollectionAccess.Private,
          label: (
            <CollectionAccessLabel accessType={CollectionAccess.Private} />
          ),
          disabled: privateDisabled,
          data: { cy: 'answer-collection-access-private' },
        },
        {
          value: CollectionAccess.Public,
          label: <CollectionAccessLabel accessType={CollectionAccess.Public} />,
          data: { cy: 'answer-collection-access-public' },
        },
        {
          value: CollectionAccess.Restricted,
          label: (
            <CollectionAccessLabel accessType={CollectionAccess.Restricted} />
          ),
          disabled: restrictedDisabled,
          data: { cy: 'answer-collection-access-restricted' },
        },
      ]}
      data={{ cy: 'answer-collection-access' }}
      className={{ select: { trigger: 'h-9 w-40' } }}
    />
  )
}

export default AnswerCollectionAccessSelection
