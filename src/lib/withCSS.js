import Head from 'next/head'
import React from 'react'

export default (WrappedComponent, links) => {
  const head = (
    <Head>
      {links.map(link =>
        (<link
          rel="stylesheet"
          href={`https://cdnjs.cloudflare.com/ajax/libs/semantic-ui/2.2.10/components/${link}.min.css`}
        />),
      )}
    </Head>
  )

  return props => <WrappedComponent head={head} {...props} />
}
