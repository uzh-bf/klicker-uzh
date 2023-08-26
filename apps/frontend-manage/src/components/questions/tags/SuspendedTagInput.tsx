import { useSuspenseQuery } from '@apollo/client'
import { GetUserTagsDocument } from '@klicker-uzh/graphql/dist/ops'
import { useField } from 'formik'
import { useMemo } from 'react'
import Creatable from 'react-select/creatable'

function SuspendedTagInput() {
  const [field, _, helpers] = useField<string[]>('tags')

  const { data } = useSuspenseQuery(GetUserTagsDocument)

  const tags = useMemo(
    () => field.value?.map((tag) => ({ label: tag, value: tag })),
    [field.value]
  )

  const options = [
    ...(tags ?? []),
    ...(data.userTags ?? []).map((tag) => ({
      label: tag.name,
      value: tag.name,
    })),
  ]

  return (
    <Creatable
      isClearable
      isMulti
      value={tags}
      options={options}
      classNames={{
        container: () => 'w-full',
      }}
      onChange={(newValue) =>
        helpers.setValue(newValue.map((tag) => tag.value))
      }
      onCreateOption={(newTag) => helpers.setValue([...field.value, newTag])}
    />
  )
}

export default SuspendedTagInput
