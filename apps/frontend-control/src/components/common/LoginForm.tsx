import Footer from '@klicker-uzh/shared-components/src/Footer'
import usePWAInstall, {
  BeforeInstallPromptEvent,
} from '@klicker-uzh/shared-components/src/hooks/usePWAInstall'
import {
  Button,
  FormikPinField,
  FormikTextField,
  H1,
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
    <div className="flex max-w-xl flex-grow flex-col md:!flex-grow-0 md:rounded-lg md:border md:shadow">
      <div className="flex flex-1 flex-col items-center justify-center md:p-12">
        <div className="mb-8 w-full text-center sm:mb-12">
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
            <FormikTextField
              required
              label={labelIdentifier}
              labelType="small"
              name={fieldIdentifier}
              data={dataIdentifier}
              className={{ label: 'text-sm' }}
            />
            <FormikPinField
              required
              label={labelSecret}
              labelType="small"
              name={fieldSecret}
              className={{ root: 'mt-1', label: 'text-sm' }}
              data={dataSecret}
            />

            <div className="flex flex-row justify-between">
              <Button
                className={{ root: 'border-uzh-grey-80 mt-2' }}
                type="submit"
                disabled={isSubmitting}
                data={{ cy: 'submit-login' }}
              >
                <Button.Label>{t('shared.generic.signin')}</Button.Label>
              </Button>
            </div>

            {installAndroid && onChrome && (
              <div className="mt-4 flex flex-col justify-center md:hidden">
                <UserNotification type="info" message={installAndroid}>
                  <Button
                    className={{
                      root: 'border-uzh-grey-80 mt-2 w-fit',
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
      <div className="w-full flex-none">
        <Footer />
      </div>
    </div>
  )
}

export default LoginForm
