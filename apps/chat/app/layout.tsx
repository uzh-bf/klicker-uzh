import { sourceSansPro } from '@klicker-uzh/shared-components/src/font'
import 'katex/dist/katex.min.css'
import type { Metadata } from 'next'
import { Geist_Mono } from 'next/font/google'
import './globals.css'

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'KlickerUZH Tutor Chatbot',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body
        className={`${sourceSansPro.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  )
}
