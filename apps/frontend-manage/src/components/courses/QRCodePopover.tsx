import { faQrcode } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@uzh-bf/design-system'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import QR from '../../pages/qr/[...args]'

function QRCodePopover({
  triggerStyle,
  triggerText,
  infoComponent,
  relHref,
  data,
  disabled = false,
}: {
  triggerStyle: 'basic' | 'button' | 'primary'
  triggerText: string
  infoComponent?: React.ReactNode
  relHref: string
  data?: { cy?: string; test?: string }
  disabled?: boolean
}) {
  const t = useTranslations()

  return (
    <Popover>
      {triggerStyle === 'basic' && (
        <PopoverTrigger
          disabled={disabled}
          className="hover:bg-accent text-primary-100 mb-1 flex flex-row items-center gap-2.5 rounded px-2 py-0 text-sm"
          data-cy={data?.cy}
          data-test={data?.test}
        >
          <FontAwesomeIcon icon={faQrcode} />
          <div>{triggerText}</div>
        </PopoverTrigger>
      )}
      {triggerStyle === 'button' && (
        <PopoverTrigger
          disabled={disabled}
          className="hover:bg-accent border-input flex h-8 flex-row items-center gap-2.5 rounded-md border px-3 py-0"
          data-cy={data?.cy}
          data-test={data?.test}
        >
          <FontAwesomeIcon icon={faQrcode} />
          <div>{triggerText}</div>
        </PopoverTrigger>
      )}
      {triggerStyle === 'primary' && (
        <PopoverTrigger
          disabled={disabled}
          className="bg-primary-100 text-primary-foreground hover:bg-primary-80 focus-visible:ring-ring inline-flex h-8 flex-row items-center gap-2.5 rounded-md border border-primary-100 px-3.25 py-1.75 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden"
          data-cy={data?.cy}
          data-test={data?.test}
        >
          <FontAwesomeIcon icon={faQrcode} />
          <div>{triggerText}</div>
        </PopoverTrigger>
      )}
      <PopoverContent className="w-max">
        {infoComponent}
        <QR
          className={{
            title: 'mt-0 w-80 text-center text-sm',
            canvas: 'flex justify-center',
          }}
          path={relHref}
          width={100}
        />
        <Link passHref href={`/qr${relHref}`} target="_blank">
          <Button fluid primary className={{ root: 'mt-2' }}>
            <Button.Label>{t('manage.general.presentQrCode')}</Button.Label>
          </Button>
        </Link>
      </PopoverContent>
    </Popover>
  )
}

export default QRCodePopover
