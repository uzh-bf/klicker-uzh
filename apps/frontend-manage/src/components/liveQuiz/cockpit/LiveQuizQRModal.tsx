import { useQuery } from '@apollo/client'
import {
  faCheck,
  faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { LocaleType, UserProfileDocument } from '@klicker-uzh/graphql/dist/ops'
import QR from '@pages/qr/[...args]'
import { Button, H3, Modal, Prose } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import React from 'react'

function LiveQuizQRModal({
  quizId,
  quizPin,
  language,
  onClose,
}: {
  quizId: string
  quizPin?: string | null
  language?: LocaleType | null
  onClose: () => void
}): React.ReactElement {
  const t = useTranslations()
  const { data } = useQuery(UserProfileDocument, {
    fetchPolicy: 'cache-only',
  })

  const shortname = data?.userProfile?.shortname
  const accountRelativeLink = `${language ? `/${language}` : ''}/join/${shortname}`
  const quizRelativeLink = `${language ? `/${language}` : ''}/session/${quizId}${
    quizPin ? `?pin=${encodeURIComponent(quizPin)}` : ''
  }`

  return (
    <Modal
      open
      title={t('manage.cockpit.liveQuizQRCodes')}
      onClose={onClose}
      className={{ content: 'w-full! max-w-6xl pb-2' }}
    >
      <div className="flex flex-col gap-8 md:flex-row">
        <div className="flex flex-1 flex-col justify-between">
          <div>
            <div className="flex flex-row items-center justify-between">
              <H3>{t('manage.cockpit.qrCodeAccountLinkTitle')}</H3>
              {quizPin ? (
                <div className="text-uzh-red-100 flex flex-row items-center gap-2.5">
                  <FontAwesomeIcon icon={faTriangleExclamation} />
                  <span>{t('manage.cockpit.qrCodeAccountLinkPinWarning')}</span>
                </div>
              ) : null}
            </div>
            <Prose className={{ root: 'prose-sm max-w-full leading-5' }}>
              {t('manage.cockpit.qrCodeAccountLinkDescription')}
            </Prose>
          </div>

          <div>
            <QR
              className={{ title: 'text-base', canvas: 'flex justify-center' }}
              path={accountRelativeLink}
              width={100}
              data={{ cy: 'qr-link-shortname' }}
            />
            <Link passHref href={`/qr${accountRelativeLink}`} target="_blank">
              <Button
                fluid
                primary
                className={{ root: 'mt-2' }}
                data={{ cy: `qr-link-${shortname}` }}
              >
                <Button.Label>{t('manage.general.presentQrCode')}</Button.Label>
              </Button>
            </Link>
          </div>
        </div>
        <div className="flex flex-1 flex-col justify-between">
          <div>
            <div className="flex flex-row items-center justify-between">
              <H3>{t('manage.cockpit.qrCodeDirectLinkTitle')}</H3>
              {quizPin ? (
                <div className="flex flex-row items-center gap-2.5 text-green-700">
                  <FontAwesomeIcon icon={faCheck} />
                  <span>{t('manage.cockpit.qrCodeDirectLinkIncluded')}</span>
                </div>
              ) : null}
            </div>
            <Prose className={{ root: 'prose-sm max-w-full leading-5' }}>
              {t('manage.cockpit.qrCodeDirectLinkDescription')}
            </Prose>
          </div>

          <div>
            <QR
              className={{ title: 'text-base', canvas: 'flex justify-center' }}
              path={quizRelativeLink}
              width={100}
              data={{ cy: 'qr-link-direct' }}
            />
            <Link passHref href={`/qr${quizRelativeLink}`} target="_blank">
              <Button fluid primary className={{ root: 'mt-2' }}>
                <Button.Label>{t('manage.general.presentQrCode')}</Button.Label>
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </Modal>
  )
}

export default LiveQuizQRModal
