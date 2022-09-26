import { ApolloProvider } from '@apollo/client'
import type { AppProps } from 'next/app'
import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'


import { ThemeProvider } from '@uzh-bf/design-system'
import { useApollo } from '../lib/apollo'

import '../globals.css'

function App({ Component, pageProps }: AppProps) {
  const apolloClient = useApollo(pageProps)

  return (
    <ApolloProvider client={apolloClient}>
      <DndProvider backend={HTML5Backend}>
      <ThemeProvider
        theme={{
          primaryBg: 'bg-uzh-blue-20',
          primaryBgDark: 'bg-uzh-blue-60',
          primaryBgHover: 'hover:bg-uzh-blue-20',
          primaryBgHoverNavbar: 'hover:bg-uzh-blue-40',
          primaryBorder: 'border-uzh-blue-40',
          primaryBorderHover: 'hover:border-uzh-blue-40',
          primaryText: 'text-uzh-blue-100',
          primaryTextHover: 'hover:text-uzh-blue-100',
          primaryFill: 'fill-uzh-blue-80',
          primaryFillHover: 'hover:fill-uzh-blue-100',
          primaryProseHover: 'hover:text-uzh-blue-100',
        }}
      >
        <Component {...pageProps} />
      </ThemeProvider>
      </DndProvider>
    </ApolloProvider>
  )
}

export default App
