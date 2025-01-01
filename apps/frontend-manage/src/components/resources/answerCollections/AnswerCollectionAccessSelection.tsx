import {
  faLock,
  faLockOpen,
  faUserLock,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { CollectionAccess } from '@klicker-uzh/graphql/dist/ops'
import { FormikSelectField } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

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
            <div className="flex flex-row items-center gap-2 text-red-700">
              <FontAwesomeIcon icon={faLock} />
              {t(`manage.resources.access${CollectionAccess.Private}`)}
            </div>
          ),
          disabled: privateDisabled,
          data: { cy: 'answer-collection-access-private' },
        },
        {
          value: CollectionAccess.Public,
          label: (
            <div className="flex flex-row items-center gap-2 text-green-700">
              <FontAwesomeIcon icon={faLockOpen} />
              {t(`manage.resources.access${CollectionAccess.Public}`)}
            </div>
          ),
          data: { cy: 'answer-collection-access-public' },
        },
        {
          value: CollectionAccess.Restricted,
          label: (
            <div className="flex flex-row items-center gap-2 text-orange-600">
              <FontAwesomeIcon icon={faUserLock} />
              {t(`manage.resources.access${CollectionAccess.Restricted}`)}
            </div>
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
