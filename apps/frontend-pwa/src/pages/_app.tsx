import { ApolloProvider } from '@apollo/client'
import { useApollo } from '@lib/apollo'
import type { AppProps } from 'next/app'

import '../globals.css'

function App({ Component, pageProps }: AppProps) {
  const apolloClient = useApollo(pageProps)

  return (
    <ApolloProvider client={apolloClient}>
      <Component {...pageProps} />
    </ApolloProvider>
  )
}

export default App
