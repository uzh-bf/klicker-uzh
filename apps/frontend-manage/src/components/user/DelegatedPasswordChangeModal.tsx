import { useMutation } from '@apollo/client'
import { faArrowsRotate } from '@fortawesome/free-solid-svg-icons'
import { UpdateUserLoginDocument } from '@klicker-uzh/graphql/dist/ops'
import { Button, Modal } from '@uzh-bf/design-system'
import { Form, Formik } from 'formik'
import generatePassword from 'generate-password'
import { useTranslations } from 'next-intl'
import * as Yup from 'yup'
import DelegatedAccessPassword, { PW_SETTINGS } from './DelegatedAccessPassword'

function DelegatedPasswordChangeModal({
  changePasswordModal,
  setChangePasswordModal,
}: {
  changePasswordModal: { open: boolean; loginId?: string }
  setChangePasswordModal: (value: { open: boolean; loginId?: string }) => void
}) {
  const t = useTranslations()
  const [updateUserLogin] = useMutation(UpdateUserLoginDocument)

  return (
    <Modal
      title={t('manage.settings.changeDelegatedLoginPassword')}
      open={changePasswordModal.open}
      onClose={() =>
        setChangePasswordModal({
          open: false,
          loginId: undefined,
        })
      }
      className={{
        content: 'h-max !min-h-[10rem] max-w-[25rem] pb-2',
      }}
    >
      <div className="mb-3 text-sm">
        {t('manage.settings.changeDelegatedLoginPasswordMessage')}
      </div>
      <Formik
        initialValues={{
          password: generatePassword.generate(PW_SETTINGS),
        }}
        validationSchema={Yup.object().shape({
          password: Yup.string().required(),
        })}
        onSubmit={async (values, { setSubmitting }) => {
          setSubmitting(true)
          await updateUserLogin({
            variables: {
              id: changePasswordModal.loginId!,
              password: values.password,
            },
          })
          setSubmitting(false)
          setChangePasswordModal({ open: false, loginId: undefined })
        }}
      >
        {({ values, setFieldValue, isValid, isSubmitting }) => (
          <Form className="w-full">
            <DelegatedAccessPassword
              modificationMode
              password={values.password}
              setFieldValue={setFieldValue}
              className="mb-2 md:w-full"
            />
            <Button
              primary
              type="submit"
              disabled={!isValid}
              loading={isSubmitting}
              className={{ root: 'float-right my-2' }}
              data={{ cy: 'change-delegated-login-password' }}
            >
              <Button.Icon loading={isSubmitting} icon={faArrowsRotate} />
              <Button.Label>{t('manage.settings.changePassword')}</Button.Label>
            </Button>
          </Form>
        )}
      </Formik>
    </Modal>
  )
}

export default DelegatedPasswordChangeModal
