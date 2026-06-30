import Loader from '@klicker-uzh/shared-components/src/Loader'
import { UserNotification } from '@uzh-bf/design-system'
import { useField } from 'formik'
import { useTranslations } from 'next-intl'
import { useMemo } from 'react'
import Creatable from 'react-select/creatable'
import { trpc } from '../../../lib/trpc'
import { ElementFormTypes } from '../manipulation/types'

function SuspendedTagInput({ disabled }: { disabled: boolean }) {
  const t = useTranslations()
  const [field, _, helpers] = useField<ElementFormTypes['tags']>('tags')
  const { data, error, isLoading } = trpc.element.tags.useQuery()

  const tags = useMemo(
    () => field.value?.map((tag) => ({ label: tag, value: tag })),
    [field.value]
  )

  if (isLoading && !data && !tags?.length) {
    return <Loader />
  }

  const options = [
    ...(tags ?? []),
    ...(data?.tags ?? []).map((tag) => ({
      label: tag.name,
      value: tag.name,
    })),
  ]

  return (
    <div className="flex flex-col gap-1">
      <Creatable
        isClearable
        isMulti
        isDisabled={disabled}
        isLoading={isLoading && !data}
        value={tags}
        options={options}
        classNames={{
          container: () => 'h-9 w-full',
        }}
        onChange={(newValue) =>
          helpers.setValue(newValue.map((tag) => tag.value))
        }
        onCreateOption={(newTag) =>
          helpers.setValue([...(field.value ?? []), newTag])
        }
        placeholder={t('manage.questionPool.selectOrType')}
      />
      {error ? (
        <UserNotification
          type="error"
          message={t('shared.generic.systemError')}
          className={{ root: 'py-1 text-sm' }}
        />
      ) : null}
    </div>
  )
}

export default SuspendedTagInput
