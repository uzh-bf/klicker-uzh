import { useMutation, useQuery } from '@apollo/client'
import EvaluationDisplay from '@components/EvaluationDisplay'
import OptionsDisplay from '@components/OptionsDisplay'
import {
  GetLearningElementDocument,
  GetMicroSessionDocument,
  ResponseToQuestionInstanceDocument,
} from '@klicker-uzh/graphql/dist/ops'
import Markdown from '@klicker-uzh/markdown'
import { addApolloState, initializeApollo } from '@lib/apollo'
import { QuestionType } from '@type/app'
import { Button, Progress } from '@uzh-bf/design-system'
import { GetStaticPaths, GetStaticProps } from 'next'
import { default as NextImage} from 'next/future/image'
import { useRouter } from 'next/router'
import { useState } from 'react'

interface ImageProps {
  alt: string
  src: string
}

function Image({ alt, src }: ImageProps) {
  return (
    <div className="relative h-36">
      <NextImage src={src} className="object-contain" fill alt={alt} />
    </div>
  )
}

interface Props {
  id: string
}

function MicroSessionDescription({ id }: Props) {


  const router = useRouter()

  const { loading, error, data } = useQuery(GetMicroSessionDocument, {
    variables: { id  },
  })

  if (loading || !data?.microSession) return <p>Loading...</p>
  if (error) return <p>Oh no... {error.message}</p>

  return (
    <div className="flex flex-col max-w-6xl m-auto">
      <Markdown content={data.microSession.description} components={{
        img: Image as any
      }}/>
      <div>
        <Button>Start</Button>
      </div>
    </div>
  )
}

export const getStaticProps: GetStaticProps = async (ctx) => {
  if (
    typeof ctx.params?.id !== 'string'
  ) {
    return {
      redirect: {
        destination: '/404',
        permanent: false,
      },
    }
  }

  const apolloClient = initializeApollo()

  try {
    await apolloClient.query({
      query: GetMicroSessionDocument,
      variables: { id: ctx.params.id },
    })
  } catch (e) {
    return {
      redirect: {
        destination: '/404',
        permanent: false,
      },
    }
  }

  return addApolloState(apolloClient, {
    props: {
      id: ctx.params.id,
    },
    revalidate: 1,
  })
}

export const getStaticPaths: GetStaticPaths = async () => {
  return {
    paths: [],
    fallback: 'blocking',
  }
}

export default MicroSessionDescription
