import { useMutation, useQuery } from '@apollo/client'
import {
  GenerateLoginTokenDocument,
  GetLoginTokenDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, H2, UserNotification } from '@uzh-bf/design-system'
import dayjs, { Dayjs } from 'dayjs'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import Countdown from '../components/common/Countdown'

function TokenGeneration() {
  const t = useTranslations()
  const [tokenValid, setTokenValid] = useState(false)
  const [hadToken, setHadToken] = useState(false)
  const [token, setToken] = useState<string>('')
  const [endTime, setEndTime] = useState<Dayjs>(dayjs())

  const [generateLoginToken, { loading: generatingToken }] = useMutation(
    GenerateLoginTokenDocument
  )
  const { data: tokenData } = useQuery(GetLoginTokenDocument)

  useEffect(() => {
    if (
      tokenData?.getLoginToken &&
      dayjs(tokenData?.getLoginToken.loginTokenExpiresAt).isAfter(dayjs())
    ) {
      setToken(tokenData.getLoginToken?.loginToken || '')
      setEndTime(dayjs(tokenData.getLoginToken?.loginTokenExpiresAt))
      setTokenValid(true)
      setHadToken(true)
    }
  }, [tokenData])

  return (
    <Layout displayName={t('manage.token.pageName')}>
      <div className="mx-auto max-w-2xl">
        <H2>{t('manage.token.tokenGenerationTitle')}</H2>
        <div className="mb-2">
          {t.rich('manage.token.tokenGenerationExplanation', {
            link: (displayLink) => (
              <Link
                href={process.env.NEXT_PUBLIC_CONTROL_URL || ''}
                className="text-primary-100"
                legacyBehavior
                passHref
              >
                <a data-cy="link-to-control-app">{displayLink}</a>
              </Link>
            ),
            displayLink: process.env.NEXT_PUBLIC_CONTROL_URL,
          })}
        </div>
        <Button
          loading={generatingToken}
          data={{ cy: 'generate-token' }}
          onClick={async () => {
            const result = await generateLoginToken()
            if (result) {
              setToken(result.data?.generateLoginToken?.loginToken || '')
              setEndTime(
                dayjs(result.data?.generateLoginToken?.loginTokenExpiresAt)
              )
              setTokenValid(true)
              setHadToken(true)
            }
          }}
          className={{ root: 'bg-primary-80 mb-3 text-white' }}
        >
          {t('manage.token.generateToken')}
        </Button>

        {tokenValid && (
          <UserNotification
            message={t('manage.token.tokenTitle')}
            className={{ root: 'text-base', content: 'mt-0' }}
            type="success"
          >
            <div className="text-lg font-bold" data-cy="control-login-token">
              {String(token)
                .match(/.{1,3}/g)
                ?.join(' ')}
            </div>
            <div className="mt-2">
              {t('manage.token.remainingValidity')}{' '}
              <Countdown
                endTime={endTime}
                onExpire={() => {
                  setTokenValid(false)
                }}
              />
            </div>
          </UserNotification>
        )}
        {hadToken && !tokenValid && (
          <UserNotification
            className={{ root: 'text-base' }}
            message={t('manage.token.tokenExpired')}
            type="error"
          />
        )}
      </div>
    </Layout>
  )
}

export async function getStaticProps({ locale }: GetStaticPropsContext) {
  return {
    props: {
      messages: (await import(`@klicker-uzh/i18n/messages/${locale}`)).default,
    },
  }
}

export default TokenGeneration
