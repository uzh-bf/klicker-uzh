import { useQuery } from '@apollo/client'
import Layout from '@components/Layout'
import { GetMicroSessionDocument } from '@klicker-uzh/graphql/dist/ops'
import { Button, Prose } from '@uzh-bf/design-system'
import dynamic from 'next/dynamic'
import { default as NextImage } from 'next/future/image'
import Link from 'next/link'
import { useRouter } from 'next/router'

const DynamicMarkdown = dynamic(() => import('@klicker-uzh/markdown'), {
  ssr: false,
})

interface ImageProps {
  alt: string
  src: string
}

function Image({ alt, src }: ImageProps) {
  return (
    <div className="p-4 m-auto border rounded">
      <div className="relative h-52">
        <NextImage src={src} className="object-contain" fill alt={alt} />
      </div>
    </div>
  )
}

function MicroSessionIntroduction() {
  const router = useRouter()

  const { loading, error, data } = useQuery(GetMicroSessionDocument, {
    variables: { id: router.query.id as string },
    skip: !router.query.id,
  })

  if (loading || !data?.microSession) return <p>Loading...</p>
  if (error) return <p>Oh no... {error.message}</p>

  return (
    <Layout
      displayName={data.microSession.displayName}
      courseName={data.microSession.course.displayName}
      mobileMenuItems={[]}
    >
      <div className="flex flex-col w-full md:p-4 md:border md:rounded md:max-w-4xl md:m-auto">
        <Prose className="max-w-none prose-p:mt-0 prose-headings:mt-0 prose-img:my-0 hover:text-current">
          <DynamicMarkdown
            content={data.microSession.description}
            components={{
              img: Image as any,
            }}
          />
        </Prose>
        <Link href={`/micro/${data.microSession.id}/0`}>
          <Button className="justify-center w-full text-lg md:w-auto md:self-end">
            Beginnen
          </Button>
        </Link>
      </div>
    </Layout>
  )
}

// export const getStaticProps: GetStaticProps = async (ctx) => {
//   if (typeof ctx.params?.id !== 'string') {
//     return {
//       redirect: {
//         destination: '/404',
//         permanent: false,
//       },
//     }
//   }

//   const apolloClient = initializeApollo()

//   try {
//     await apolloClient.query({
//       query: GetMicroSessionDocument,
//       variables: { id: ctx.params.id },
//     })
//   } catch (e) {
//     console.error(e)
//     // return {
//     //   redirect: {
//     //     destination: '/404',
//     //     permanent: false,
//     //   },
//     // }
//   }

//   return addApolloState(apolloClient, {
//     props: {
//       id: ctx.params.id,
//     },
//     revalidate: 1,
//   })
// }

// export const getStaticPaths: GetStaticPaths = async () => {
//   return {
//     paths: [],
//     fallback: 'blocking',
//   }
// }

export default MicroSessionIntroduction
