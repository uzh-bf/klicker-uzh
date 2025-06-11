import { faClipboard } from '@fortawesome/free-regular-svg-icons'
import { faArrowsRotate } from '@fortawesome/free-solid-svg-icons'
import { monoSpaceFont } from '@klicker-uzh/shared-components/src/font'
import { Button, Label, toast } from '@uzh-bf/design-system'
import generatePassword from 'generate-password'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'

export const PW_SETTINGS = {
  length: 16,
  uppercase: true,
  symbols: false,
  numbers: true,
}

function DelegatedAccessPassword({
  password,
  setFieldValue,
  modificationMode = false,
  className,
}: {
  password: string
  setFieldValue: (field: string, value: string) => void
  modificationMode?: boolean
  className?: string
}) {
  const t = useTranslations()

  return (
    <div
      className={twMerge(
        'flex flex-row items-center justify-between md:w-1/2',
        className
      )}
    >
      <div className="flex flex-row items-center gap-3">
        <Label
          label={
            modificationMode
              ? t('manage.settings.newPassword')
              : t('shared.generic.password')
          }
          tooltip={
            modificationMode ? undefined : t('manage.settings.passwordTooltip')
          }
          className={{
            root: 'font-bold',
            tooltip: 'font-normal',
          }}
          showTooltipSymbol
        />
        <div className={monoSpaceFont.className}>{password}</div>
      </div>
      <div className="flex flex-row gap-0.5">
        <Button
          onClick={() => {
            navigator?.clipboard?.writeText(password).then(() => {
              toast({
                type: 'success',
                message: t('manage.settings.copiedPassword'),
                options: { duration: 4000 },
              })
            })
          }}
          className={{ root: 'h-8 w-8' }}
          data={{ cy: 'copy-delegated-login-password' }}
        >
          <Button.Icon withoutLabel icon={faClipboard} />
        </Button>
        <Button
          onClick={() =>
            setFieldValue('password', generatePassword.generate(PW_SETTINGS))
          }
          className={{ root: 'h-8 w-8' }}
          data={{ cy: 'generate-new-delegated-login-password' }}
        >
          <Button.Icon withoutLabel icon={faArrowsRotate} />
        </Button>
      </div>
    </div>
  )
}

export default DelegatedAccessPassword
