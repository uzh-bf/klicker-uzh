import { faExchangeAlt } from '@fortawesome/free-solid-svg-icons'
import { Button, FormikTextField, Modal } from '@uzh-bf/design-system'
import { Form, Formik } from 'formik'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import * as Yup from 'yup'
import TransferOwnershipErrorToast from './TransferOwnershipErrorToast'
import TransferOwnershipSuccessToast from './TransferOwnershipSuccessToast'

function TransferOwnershipModal({
  open,
  onClose,
  info,
  onTransferCallback,
}: {
  open: boolean
  onClose: () => void
  info: React.ReactNode
  onTransferCallback: (usernameOrEmail: string) => Promise<boolean>
}) {
  const t = useTranslations()
  const [transferSuccess, setTransferSuccess] = useState(false)
  const [transferFailure, setTransferFailure] = useState(false)

  return (
    <>
      <Modal
        escapeDisabled
        title={t('manage.sharing.transferOwnership')}
        open={open}
        onClose={onClose}
        className={{ content: 'max-w-lg' }}
        dataCloseButton={{ cy: 'close-transfer-ownership-modal' }}
      >
        <div className="space-y-3">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm">
            <div className="mb-2 text-base font-bold text-gray-800">
              {t('manage.sharing.importantInformation')}
            </div>
            <p className="text-gray-600">{info}</p>
          </div>

          <Formik
            initialValues={{ usernameOrEmail: '' }}
            validationSchema={Yup.object().shape({
              usernameOrEmail: Yup.string().required(
                t('manage.sharing.usernameOrEmailRequired')
              ),
            })}
            onSubmit={async (values, { setSubmitting, resetForm }) => {
              try {
                const success = await onTransferCallback(values.usernameOrEmail)

                if (success) {
                  setTransferSuccess(true)
                  resetForm()
                  onClose()
                } else {
                  setTransferFailure(true)
                }
              } catch (error) {
                console.error(error)
                setTransferFailure(true)
              }

              setSubmitting(false)
            }}
          >
            {({ isSubmitting, isValid }) => (
              <Form className="space-y-2">
                <div>
                  <FormikTextField
                    id="usernameOrEmail"
                    name="usernameOrEmail"
                    label={
                      t('shared.generic.username') +
                      ' / ' +
                      t('shared.generic.email')
                    }
                    data={{ cy: 'new-owner-username-email-input' }}
                    className={{
                      root: 'w-full',
                    }}
                  />
                </div>

                <div className="flex items-center justify-between pt-3">
                  <Button
                    onClick={onClose}
                    data={{ cy: 'cancel-ownership-transfer' }}
                  >
                    <Button.Label>{t('shared.generic.cancel')}</Button.Label>
                  </Button>
                  <Button
                    primary
                    type="submit"
                    disabled={isSubmitting || !isValid}
                    data={{ cy: 'confirm-ownership-transfer' }}
                  >
                    <Button.Icon icon={faExchangeAlt} />
                    <Button.Label>
                      {t('manage.sharing.confirmTransferOwnership')}
                    </Button.Label>
                  </Button>
                </div>
              </Form>
            )}
          </Formik>
        </div>
      </Modal>

      <TransferOwnershipSuccessToast
        open={transferSuccess}
        onClose={() => setTransferSuccess(false)}
      />
      <TransferOwnershipErrorToast
        open={transferFailure}
        onClose={() => setTransferFailure(false)}
      />
    </>
  )
}

export default TransferOwnershipModal
