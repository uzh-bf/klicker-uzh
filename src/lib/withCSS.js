import Head from 'next/head'
import React from 'react'

// take in a WrappedComponent and a list of semantic ui css file links
// links=[dropdown] will lead to inclusion of dropdown.min.css from CDN
export default (WrappedComponent, links) => {
  // construct next/head by mapping over all requested links
  // TODO: extension => check whether link is semantic or full
  // HACK: this might lead to duplicate link declarations in <head>
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

  // return the enhanced component, passing head and remaining props
  return props => <WrappedComponent head={head} {...props} />
}
