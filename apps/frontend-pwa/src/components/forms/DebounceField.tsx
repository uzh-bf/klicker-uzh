import { FormikTextField } from '@uzh-bf/design-system'
import { useField } from 'formik'

interface DebounceFieldProps {
  name: string
  label: string
  debounceFunction: (username: string) => void
}

function DebounceField({ name, label, debounceFunction }: DebounceFieldProps) {
  const [field, _, helpers] = useField(name)

  return (
    <FormikTextField
      value={field.value}
      label={label}
      labelType="small"
      className={{
        label: 'font-bold text-md text-black',
      }}
      onChange={(username: string) => {
        debounceFunction(username)
        helpers.setValue(username)
      }}
    />
  )
}

export default DebounceField
