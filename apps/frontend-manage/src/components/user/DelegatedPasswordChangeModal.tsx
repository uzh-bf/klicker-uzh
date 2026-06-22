import { faArrowsRotate } from '@fortawesome/free-solid-svg-icons'
import { Button, Modal, toast } from '@uzh-bf/design-system'
import { Form, Formik } from 'formik'
import generatePassword from 'generate-password'
import { useTranslations } from 'next-intl'
import * as Yup from 'yup'
import { trpc } from '../../lib/trpc'
import DelegatedAccessPassword, { PW_SETTINGS } from './DelegatedAccessPassword'

function DelegatedPasswordChangeModal({
  loginId,
  onClose,
}: {
  loginId?: string
  onClose: () => void
}) {
  const t = useTranslations()
  const updateUserLogin = trpc.user.updateUserLogin.useMutation()
  const handleClose = (isSubmitting: boolean) => {
    if (!isSubmitting) {
      onClose()
    }
  }

  if (!loginId) {
    return null
  }

  return (
    <Formik
      initialValues={{
        password: generatePassword.generate(PW_SETTINGS),
      }}
      validationSchema={Yup.object().shape({
        password: Yup.string().required(),
      })}
      onSubmit={async (values, { setSubmitting }) => {
        setSubmitting(true)
        try {
          const result = await updateUserLogin.mutateAsync({
            id: loginId,
            password: values.password,
          })

          if (!result?.id) {
            throw new Error('Failed to change delegated login password')
          }

          onClose()
        } catch (error) {
          console.error(error)
          toast({
            type: 'error',
            message: t('shared.generic.systemError'),
            options: { duration: 5000 },
          })
        } finally {
          setSubmitting(false)
        }
      }}
    >
      {({ values, setFieldValue, isValid, isSubmitting }) => (
        <Modal
          open
          title={t('manage.settings.changeDelegatedLoginPassword')}
          onClose={() => handleClose(isSubmitting)}
          className={{
            content: 'min-h-40! max-w-100 h-max pb-2',
          }}
        >
          <div className="mb-3 text-sm">
            {t('manage.settings.changeDelegatedLoginPasswordMessage')}
          </div>
          <Form className="w-full">
            <DelegatedAccessPassword
              modificationMode
              password={values.password}
              setFieldValue={setFieldValue}
              disableGenerate={isSubmitting}
              className="mb-2 md:w-full"
            />
            <Button
              primary
              type="submit"
              disabled={!isValid || isSubmitting}
              loading={isSubmitting}
              className={{ root: 'float-right my-2' }}
              data={{ cy: 'change-delegated-login-password' }}
            >
              <Button.Icon loading={isSubmitting} icon={faArrowsRotate} />
              <Button.Label>{t('manage.settings.changePassword')}</Button.Label>
            </Button>
          </Form>
        </Modal>
      )}
    </Formik>
  )
}

export default DelegatedPasswordChangeModal
