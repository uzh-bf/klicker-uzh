import Footer from '@klicker-uzh/shared-components/src/Footer'
import usePWAInstall, {
  BeforeInstallPromptEvent,
} from '@klicker-uzh/shared-components/src/hooks/usePWAInstall'
import {
  Button,
  H1,
  NewFormikPinField,
  NewFormikTextField,
  UserNotification,
} from '@uzh-bf/design-system'
import { Form } from 'formik'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import { useRef, useState } from 'react'

interface LoginFormProps {
  header: string
  labelIdentifier: string
  fieldIdentifier: string
  dataIdentifier?: {
    cy?: string
    test?: string
  }
  labelSecret: string
  fieldSecret: string
  dataSecret?: {
    cy?: string
    test?: string
  }
  isSubmitting: boolean
  installAndroid?: string
  installIOS?: string
}

export function LoginForm({
  header,
  labelIdentifier,
  fieldIdentifier,
  dataIdentifier,
  labelSecret,
  fieldSecret,
  dataSecret,
  isSubmitting,
  installAndroid,
  installIOS,
}: LoginFormProps) {
  const t = useTranslations()
  const [oniOS, setOniOS] = useState(false)
  const [onChrome, setOnChrome] = useState(false)
  const deferredPrompt = useRef<undefined | BeforeInstallPromptEvent>(undefined)

  usePWAInstall({ deferredPrompt, setOnChrome, setOniOS })

  const onInstallClick = async () => {
    deferredPrompt.current!.prompt()
  }

  return (
    <div className="flex flex-col flex-grow max-w-xl md:!flex-grow-0 md:border md:rounded-lg md:shadow">
      <div className="flex flex-col items-center justify-center flex-1 md:p-12">
        <div className="w-full mb-8 text-center sm:mb-12">
          <Image
            src="/KlickerLogo.png"
            width={300}
            height={90}
            alt="KlickerUZH Logo"
            className="mx-auto"
            data-cy="login-logo"
          />
        </div>
        <div>
          <H1>{header}</H1>
          <Form className="w-72 sm:w-96">
            <NewFormikTextField
              required
              label={labelIdentifier}
              labelType="small"
              name={fieldIdentifier}
              data={dataIdentifier}
              className={{ label: 'text-sm' }}
            />
            <NewFormikPinField
              required
              label={labelSecret}
              labelType="small"
              name={fieldSecret}
              className={{ root: 'mt-1', label: 'text-sm' }}
              data={dataSecret}
            />

            <div className="flex flex-row justify-between">
              <Button
                className={{ root: 'mt-2 border-uzh-grey-80' }}
                type="submit"
                disabled={isSubmitting}
                data={{ cy: 'submit-login' }}
              >
                <Button.Label>{t('shared.generic.signin')}</Button.Label>
              </Button>
            </div>

            {installAndroid && onChrome && (
              <div className="flex flex-col justify-center mt-4 md:hidden">
                <UserNotification type="info" message={installAndroid}>
                  <Button
                    className={{
                      root: 'mt-2 w-fit border-uzh-grey-80',
                    }}
                    onClick={onInstallClick}
                    data={{ cy: 'install-control-pwa' }}
                  >
                    <Button.Label>
                      {t('shared.login.installButton')}
                    </Button.Label>
                  </Button>
                </UserNotification>
              </div>
            )}
            {installIOS && oniOS && (
              <UserNotification
                className={{ root: 'mt-4' }}
                type="info"
                message={installIOS}
              />
            )}
          </Form>
        </div>
      </div>
      <div className="flex-none w-full">
        <Footer />
      </div>
    </div>
  )
}

export default LoginForm
