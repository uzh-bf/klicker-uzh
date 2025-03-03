import { faQrcode } from '@fortawesome/free-solid-svg-icons'
import ForwardRefButton from '@klicker-uzh/shared-components/src/ForwardRefButton'
import QR from '@pages/qr/[...args]'
import { Button, Modal, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import React, { useState } from 'react'
import { twMerge } from 'tailwind-merge'

interface QRPopupProps {
  link?: string
  relativeLink: string
  triggerText?: string
  className?: {
    button?: string
    modal?: string
  }
  dataTrigger?: {
    cy?: string
    test?: string
  }
  dataModal?: {
    cy?: string
    test?: string
  }
  dataCloseButton?: {
    cy?: string
    test?: string
  }
}

function CourseQRModal({
  relativeLink,
  triggerText,
  className,
  dataTrigger,
  dataModal,
  dataCloseButton,
}: QRPopupProps): React.ReactElement {
  const t = useTranslations()
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <Modal
      title={t('manage.general.qrCode')}
      trigger={
        <ForwardRefButton
          onClick={() => setModalOpen(true)}
          overrideClassName="h-8 py-0"
          data={dataTrigger}
        >
          <Button.Icon icon={faQrcode} />
          <Button.Label>
            {triggerText || t('manage.general.qrCode')}
          </Button.Label>
        </ForwardRefButton>
      }
      open={modalOpen}
      onClose={() => setModalOpen(false)}
      className={{
        content: twMerge('!w-max', className?.modal),
      }}
      dataOverlay={dataModal}
      dataCloseButton={dataCloseButton}
    >
      <UserNotification message={t('manage.course.courseQRDescription')} />

      <div className="mb-2 mt-4">
        <QR
          className={{
            title: 'text-base',
            canvas: 'flex justify-center',
          }}
          path={relativeLink}
          width={100}
        />
      </div>

      <Link passHref href={`/qr/${relativeLink}`} target="_blank">
        <Button
          fluid
          primary
          className={{ root: className?.button }}
          data={{ cy: 'present-qr-code-button' }}
        >
          <Button.Label>{t('manage.general.presentQrCode')}</Button.Label>
        </Button>
      </Link>
    </Modal>
  )
}

export default CourseQRModal
