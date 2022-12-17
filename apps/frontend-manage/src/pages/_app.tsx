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
            primaryBgMedium: 'bg-uzh-blue-60',
            primaryBgDark: 'bg-uzh-blue-80',
            primaryBgHover: 'hover:bg-uzh-blue-20',
            primaryBgMediumHover: 'hover:bg-uzh-blue-60',
            primaryBgDarkHover: 'hover:bg-uzh-blue-80',
            primaryBorder: 'border-uzh-blue-40',
            primaryBorderHover: 'hover:border-uzh-blue-40',
            primaryText: 'text-uzh-blue-100',
            primaryTextHover: 'hover:text-uzh-blue-100',
            primaryFill: 'fill-uzh-blue-80',
            primaryFillHover: 'hover:fill-uzh-blue-100',
            primaryProseHover: 'hover:text-uzh-blue-100',
          }}
        >
          <link
            rel="stylesheet"
            href="https://cdn.jsdelivr.net/npm/katex@0.16.2/dist/katex.min.css"
            integrity="sha384-bYdxxUwYipFNohQlHt0bjN/LCpueqWz13HufFEV1SUatKs1cm4L6fFgCi1jT643X"
            crossOrigin="anonymous"
          />
          <Component {...pageProps} />
        </ThemeProvider>
      </DndProvider>
    </ApolloProvider>
  )
}

export default App
