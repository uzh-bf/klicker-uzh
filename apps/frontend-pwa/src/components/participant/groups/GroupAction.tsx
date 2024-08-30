import { IconDefinition } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button, FormikTextField, H2 } from '@uzh-bf/design-system'
import { Form, Formik } from 'formik'
import { twMerge } from 'tailwind-merge'

interface GroupActionProps {
  title: string
  icon: IconDefinition
  loading: boolean
  buttonMode: boolean
  onClick?: () => void
  onSubmit?: (value: string) => Promise<void>
  explanation?: string
  placeholder?: string
  textSubmit?: string
  data?: { text?: string; cy?: string }
}

interface GroupActionButtonProps extends GroupActionProps {
  onClick: () => void
  explanation: string
  onSubmit?: never
  placeholder?: never
  textSubmit?: never
}

interface GroupActionFormProps extends GroupActionProps {
  onSubmit: (value: string) => Promise<void>
  placeholder: string
  textSubmit: string
  onClick?: never
  explanation?: never
}

function GroupAction({
  title,
  icon,
  loading,
  onSubmit,
  onClick,
  explanation,
  placeholder,
  textSubmit,
  data,
  buttonMode,
}: GroupActionButtonProps | GroupActionFormProps) {
  const TitleIcon = () => (
    <div
      className={twMerge(
        'mb-2 flex flex-row items-center gap-6 md:mb-4 md:flex-col md:gap-0',
        buttonMode && 'mb-0 md:mb-0'
      )}
    >
      <H2 className={{ root: '!m-0' }}>{title}</H2>
      <FontAwesomeIcon icon={icon} className="h-14 w-14 md:h-24 md:w-24" />
    </div>
  )

  if (!buttonMode && typeof onSubmit !== 'undefined') {
    return (
      <div className="border-uzh-grey-80 flex flex-col items-center rounded-md border border-solid p-3">
        <TitleIcon />
        <Formik
          initialValues={{ value: '' }}
          onSubmit={async (values) => await onSubmit(values.value)}
        >
          <Form className="w-full px-2">
            <div className="flex flex-row gap-4">
              <FormikTextField
                name="value"
                placeholder={placeholder}
                className={{ root: 'w-full' }}
              />
              <Button type="submit" data={data} loading={loading}>
                {textSubmit}
              </Button>
            </div>
          </Form>
        </Formik>
      </div>
    )
  }

  return (
    <Button
      basic
      className={{
        root: 'border-uzh-grey-80 hover:bg-primary-20 flex flex-col items-center rounded-md border border-solid p-3',
      }}
      onClick={onClick}
      disabled={loading}
    >
      <TitleIcon />
      <div>{explanation}</div>
    </Button>
  )
}

export default GroupAction
