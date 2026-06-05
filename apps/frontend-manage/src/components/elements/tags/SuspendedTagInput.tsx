import Loader from '@klicker-uzh/shared-components/src/Loader'
import { useField } from 'formik'
import { useTranslations } from 'next-intl'
import { useMemo } from 'react'
import Creatable from 'react-select/creatable'
import { trpc } from '../../../lib/trpc'
import { ElementFormTypes } from '../manipulation/types'

function SuspendedTagInput({ disabled }: { disabled: boolean }) {
  const t = useTranslations()
  const [field, _, helpers] = useField<ElementFormTypes['tags']>('tags')
  const { data, isLoading } = trpc.element.tags.useQuery()

  const tags = useMemo(
    () => field.value?.map((tag) => ({ label: tag, value: tag })),
    [field.value]
  )

  if (isLoading) {
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
    <Creatable
      isClearable
      isMulti
      isDisabled={disabled}
      value={tags}
      options={options}
      classNames={{
        container: () => 'w-full h-9',
      }}
      onChange={(newValue) =>
        helpers.setValue(newValue.map((tag) => tag.value))
      }
      onCreateOption={(newTag) =>
        helpers.setValue([...(field.value ?? []), newTag])
      }
      placeholder={t('manage.questionPool.selectOrType')}
    />
  )
}

export default SuspendedTagInput
