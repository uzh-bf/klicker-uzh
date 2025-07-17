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
  inputData?: { text?: string; cy?: string }
  data?: { text?: string; cy?: string }
}

interface GroupActionButtonProps extends GroupActionProps {
  onClick: () => void
  explanation: string
  onSubmit?: never
  validationSchema?: never
  placeholder?: never
  textSubmit?: never
}

interface GroupActionFormProps extends GroupActionProps {
  onSubmit: (value: string) => Promise<void>
  placeholder: string
  textSubmit: string
  validationSchema?: any
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
  validationSchema,
  inputData,
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
      <H2 className={{ root: 'mb-2' }}>{title}</H2>
      <FontAwesomeIcon icon={icon} size="5x" className="mb-2" />
    </div>
  )

  if (!buttonMode && typeof onSubmit !== 'undefined') {
    return (
      <div className="border-uzh-grey-80 flex h-full flex-col items-center rounded-md border border-solid p-3">
        <TitleIcon />
        <Formik
          initialValues={{ value: '' }}
          onSubmit={async (values) => await onSubmit(values.value.trim())}
          validationSchema={validationSchema}
          validateOnMount
        >
          {({ isValid }) => (
            <Form className="w-full px-2">
              <div className="flex flex-row gap-2">
                <FormikTextField
                  name="value"
                  placeholder={placeholder}
                  className={{ root: 'w-full', input: 'h-8' }}
                  data={inputData}
                />
                <Button
                  primary
                  type="submit"
                  data={data}
                  loading={loading}
                  disabled={!isValid}
                  className={{ root: 'h-8' }}
                >
                  {textSubmit}
                </Button>
              </div>
            </Form>
          )}
        </Formik>
      </div>
    )
  }

  return (
    <Button
      className={{
        root: 'border-uzh-grey-80 flex h-full flex-col items-center rounded-md p-3',
      }}
      onClick={onClick}
      disabled={loading}
      data={data}
    >
      <TitleIcon />
      <Button.Label className={{ root: 'whitespace-normal' }}>
        {explanation}
      </Button.Label>
    </Button>
  )
}

export default GroupAction
