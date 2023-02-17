import { ApolloProvider } from '@apollo/client'
import { config } from '@fortawesome/fontawesome-svg-core'
import '@fortawesome/fontawesome-svg-core/styles.css'
import { useApollo } from '@lib/apollo'
import { Source_Sans_Pro } from '@next/font/google'
import { ThemeProvider } from '@uzh-bf/design-system'
import type { AppProps } from 'next/app'
import ErrorBoundary from '../components/ErrorBoundary'
config.autoAddCss = false

import '../globals.css'

const sourceSansPro = Source_Sans_Pro({
  subsets: ['latin'],
  variable: '--source-sans-pro',
  weight: ['300', '400', '700'],
})

function App({ Component, pageProps }: AppProps) {
  const apolloClient = useApollo(pageProps)

  return (
    <ErrorBoundary>
      <ApolloProvider client={apolloClient}>
        <ThemeProvider
          theme={{
            primaryBg: 'bg-uzh-blue-20',
            primaryBgMedium: 'bg-uzh-blue-60',
            primaryBgDark: 'bg-uzh-blue-80',
            primaryBgHover: 'hover:bg-uzh-blue-20',
            primaryBgMediumHover: 'hover:bg-uzh-blue-60',
            primaryBgDarkHover: 'hover:bg-uzh-blue-80',
            primaryBorder: 'border-uzh-blue-40',
            primaryBorderDark: 'border-uzh-blue-80',
            primaryBorderHover: 'hover:border-uzh-blue-40',
            primaryBorderDarkHover: 'hover:border-uzh-blue-80',
            primaryBorderFocus: 'focus:border-uzh-blue-40',
            primaryBorderDarkFocus: 'focus:border-uzh-blue-80',
            primaryText: 'text-uzh-blue-100',
            primaryTextHover: 'hover:text-uzh-blue-100',
            primaryFill: 'fill-uzh-blue-80',
            primaryFillHover: 'hover:fill-uzh-blue-100',
            primaryProseHover: 'hover:text-uzh-blue-100',
          }}
        >
          <link
            rel="stylesheet"
            href="https://cdn.jsdelivr.net/npm/katex@0.16.4/dist/katex.min.css"
            integrity="sha384-vKruj+a13U8yHIkAyGgK1J3ArTLzrFGBbBc0tDp4ad/EyewESeXE/Iv67Aj8gKZ0"
            crossOrigin="anonymous"
          />
          <Component {...pageProps} />
        </ThemeProvider>
      </ApolloProvider>
    </ErrorBoundary>
  )
}

export default App
