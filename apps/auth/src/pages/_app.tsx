import { SessionProvider } from 'next-auth/react'
import { Source_Sans_3 } from 'next/font/google'

import '@/styles/globals.css'

const sourceSans3 = Source_Sans_3({ subsets: ['latin'] })

import type { AppProps } from 'next/app'

export default function App({
  Component,
  pageProps: { session, ...pageProps },
}: AppProps) {
  return (
    <div id="__app" className="font-sans">
      <SessionProvider session={session}>
        <Component {...pageProps} />{' '}
      </SessionProvider>

      <style jsx global>{`
        :root {
          --theme-font-primary: ${sourceSans3.style.fontFamily};
        }

        #__app {
          min-height: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
        }
      `}</style>
    </div>
  )
}
