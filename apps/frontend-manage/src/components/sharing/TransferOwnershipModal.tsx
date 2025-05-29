import { faExchangeAlt } from '@fortawesome/free-solid-svg-icons'
import { ObjectType } from '@klicker-uzh/graphql/dist/ops'
import { Button, FormikTextField, Modal } from '@uzh-bf/design-system'
import { Form, Formik } from 'formik'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import * as Yup from 'yup'
import TransferOwnershipErrorToast from './TransferOwnershipErrorToast'
import TransferOwnershipSuccessToast from './TransferOwnershipSuccessToast'
import useTransferObjectOwnership from './useTransferObjectOwnership'

function TransferOwnershipModal({
  open,
  onClose,
  objectId,
  objectType,
  objectName,
  isTemplate = false,
  catalogCollectionId,
}: {
  open: boolean
  onClose: () => void
  objectId: number | string
  objectType: ObjectType
  objectName: string
  isTemplate?: boolean
  catalogCollectionId?: string
}) {
  const t = useTranslations()
  const [transferSuccess, setTransferSuccess] = useState(false)
  const [transferFailure, setTransferFailure] = useState(false)
  const { onTransfer, transferring } = useTransferObjectOwnership({
    objectType,
    objectId,
    catalogCollectionId,
    onError: () => setTransferFailure(true),
  })

  const activityTemplate =
    isTemplate &&
    (objectType === ObjectType.LiveQuiz ||
      objectType === ObjectType.PracticeQuiz ||
      objectType === ObjectType.MicroLearning ||
      objectType === ObjectType.GroupActivity)

  return (
    <>
      <Modal
        escapeDisabled
        title={t('manage.sharing.transferOwnership')}
        open={open}
        onClose={onClose}
        className={{ content: 'max-w-lg pb-2' }}
        dataCloseButton={{ cy: 'close-transfer-ownership-modal' }}
      >
        <div className="space-y-3">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm">
            <div className="mb-2 text-base font-bold text-gray-800">
              {t('manage.sharing.importantInformation')}
            </div>
            <p className="text-gray-600">
              {t.rich(
                activityTemplate
                  ? `manage.sharing.infoTransferOwnership${objectType}_TEMPLATE`
                  : `manage.sharing.infoTransferOwnership${objectType}`,
                {
                  objectName,
                  b: (text) => <strong>{text}</strong>,
                }
              )}
            </p>
          </div>

          <Formik
            isInitialValid={false}
            initialValues={{ shortnameOrEmail: '' }}
            validationSchema={Yup.object().shape({
              shortnameOrEmail: Yup.string().required(
                t('manage.sharing.shortnameOrEmailRequired')
              ),
            })}
            onSubmit={async (values, { setSubmitting, resetForm }) => {
              try {
                const success = await onTransfer(values.shortnameOrEmail)

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
                    id="shortnameOrEmail"
                    name="shortnameOrEmail"
                    label={
                      t('shared.generic.shortname') +
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
                    disabled={transferring || !isValid}
                    loading={isSubmitting}
                    data={{ cy: 'confirm-ownership-transfer' }}
                  >
                    <Button.Icon icon={faExchangeAlt} loading={isSubmitting} />
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
