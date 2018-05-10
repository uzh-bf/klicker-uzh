import App, { Container } from 'next/app'
import { ApolloProvider } from 'react-apollo'
import React from 'react'

import { withApolloClient } from '../lib'

class Klicker extends App {
  render() {
    const { Component, pageProps, apolloClient } = this.props
    return (
      <Container>
        <ApolloProvider client={apolloClient}>
          <Component {...pageProps} />
        </ApolloProvider>
      </Container>
    )
  }
}

export default withApolloClient(Klicker)
