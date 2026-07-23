import { useQuery } from '@apollo/client'
import { GetBasicCourseInformationDocument } from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { addApolloState, initializeApollo } from '@lib/apollo'
import getParticipantToken from '@lib/getParticipantToken'
import useParticipantToken from '@lib/useParticipantToken'
import { UserNotification } from '@uzh-bf/design-system'
import { GetServerSidePropsContext } from 'next'
import { useTranslations } from 'next-intl'
import Head from 'next/head'
import { useRouter } from 'next/router'
import nookies from 'nookies'
import { useEffect, useState } from 'react'
import Layout from '../../../components/Layout'
import Footer from '../../../components/common/Footer'
import CourseDiscussionPanel from '../../../components/course/CourseDiscussionPanel'

interface CourseDiscussionPageProps {
  courseId: string
  embedded: boolean
  participantToken?: string
  cookiesAvailable?: boolean
}

function CourseDiscussionPage({
  courseId,
  embedded,
  participantToken,
  cookiesAvailable,
}: CourseDiscussionPageProps) {
  const t = useTranslations()
  const router = useRouter()
  const [embedToken, setEmbedToken] = useState<string>()
  const [embedTokenResolved, setEmbedTokenResolved] = useState(!embedded)

  const scopeKey =
    typeof router.query.scopeKey === 'string'
      ? router.query.scopeKey
      : undefined

  useEffect(() => {
    if (!embedded || !router.isReady) return

    const legacyToken =
      typeof router.query.embedToken === 'string'
        ? router.query.embedToken
        : undefined
    const fragmentToken = new URLSearchParams(
      window.location.hash.slice(1)
    ).get('embedToken')

    setEmbedToken(fragmentToken ?? legacyToken)

    const cleanUrl = new URL(window.location.href)
    cleanUrl.searchParams.delete('embedToken')
    cleanUrl.hash = ''
    window.history.replaceState(
      window.history.state,
      '',
      `${cleanUrl.pathname}${cleanUrl.search}`
    )
    setEmbedTokenResolved(true)
  }, [embedded, router.isReady, router.query.embedToken])

  useParticipantToken({ participantToken, cookiesAvailable })

  const {
    data: courseData,
    loading: loadingCourse,
    error: courseError,
  } = useQuery(GetBasicCourseInformationDocument, {
    variables: { courseId },
    skip: !courseId || embedded,
  })

  const embeddedHead = embedded ? (
    <Head>
      <meta name="referrer" content="no-referrer" />
    </Head>
  ) : null

  if (loadingCourse || !embedTokenResolved) {
    return (
      <>
        {embeddedHead}
        <Layout embedded={embedded} displayName={t('pwa.courseQA.title')}>
          <Loader />
        </Layout>
      </>
    )
  }

  if (courseError) {
    return (
      <>
        {embeddedHead}
        <Layout embedded={embedded} displayName={t('pwa.courseQA.title')}>
          <UserNotification
            type="error"
            message={t('shared.generic.systemError')}
          />
        </Layout>
      </>
    )
  }

  return (
    <>
      {embeddedHead}
      <Layout
        embedded={embedded}
        course={courseData?.basicCourseInformation ?? undefined}
        displayName={t('pwa.courseQA.title')}
      >
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
          <CourseDiscussionPanel
            courseId={courseId}
            scopeKey={scopeKey}
            embedToken={embedToken}
            embedded={embedded}
            course={courseData?.basicCourseInformation}
            className="mx-0 max-w-none"
          />

          {!embedded && (
            <Footer
              browserLink={`${process.env.NEXT_PUBLIC_PWA_URL}/course/${courseId}/qa`}
            />
          )}
        </div>
      </Layout>
    </>
  )
}

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  try {
    if (typeof ctx.params?.courseId !== 'string') {
      return {
        redirect: {
          destination: `${ctx.locale ? `/${ctx.locale}` : ''}/404`,
          statusCode: 302,
        },
      }
    }

    const apolloClient = initializeApollo()

    const embedParam = ctx.query.embed
    const embedValue = Array.isArray(embedParam) ? embedParam[0] : embedParam
    const embedded = embedValue === 'true' || embedValue === '1'

    const { participantToken, cookiesAvailable } = await getParticipantToken({
      apolloClient,
      courseId: ctx.params.courseId,
      ctx,
    })

    if (participantToken) {
      return {
        props: {
          participantToken,
          cookiesAvailable,
          courseId: ctx.params.courseId,
          embedded,
          messages: (await import(`@klicker-uzh/i18n/messages/${ctx.locale}`))
            .default,
        },
      }
    }

    return addApolloState(apolloClient, {
      props: {
        courseId: ctx.params.courseId,
        embedded,
        messages: (await import(`@klicker-uzh/i18n/messages/${ctx.locale}`))
          .default,
      },
    })
  } catch (error) {
    console.error('Error in getServerSideProps on course QA page:', error)

    try {
      nookies.destroy(ctx, 'lti-token', {
        domain: process.env.COOKIE_DOMAIN,
        path: '/',
      })
    } catch (nookiesError) {
      console.error(nookiesError)
    }

    return {
      redirect: {
        destination: `${ctx.locale ? `/${ctx.locale}` : ''}/serverError?redirectTo=${encodeURIComponent(`/${ctx.locale}/course/${ctx.params?.courseId}/qa`)}`,
        permanent: false,
      },
    }
  }
}

export default CourseDiscussionPage
