import {
  monoSpaceFont,
  sourceSansPro,
} from '@klicker-uzh/shared-components/src/font'
import 'katex/dist/katex.min.css'
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'KlickerUZH Chat',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        <style>{`
          :root {
            --source-sans-pro: ${sourceSansPro.variable};
            --theme-font-primary: ${sourceSansPro.variable};
            --mono-space-font: ${monoSpaceFont.variable};
          }
        `}</style>
      </head>
      <body
        className={`${sourceSansPro.variable} ${monoSpaceFont.variable} font-sans antialiased`}
      >
        {children}
      </body>
    </html>
  )
}
