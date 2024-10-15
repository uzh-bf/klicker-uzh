import {
  Container,
  Font,
  Head,
  Html,
  Preview,
  Tailwind,
} from '@react-email/components'
import React from 'react'
import Footer from './Footer.js'
import Header from './Header.js'
import tailwindConfig from './tailwind.config.js'

function Layout({
  title,
  preview,
  children,
}: {
  title: string
  preview: string
  children: React.ReactNode
}) {
  return (
    <Tailwind config={tailwindConfig}>
      <Html lang="en" className="bg-white text-base">
        <Head>
          <title>{title}</title>
          <Font fontFamily="Source Sans 3" fallbackFontFamily="Verdana" />
        </Head>
        <Preview>{preview}</Preview>
        <Container className="max-w-3xl">
          <Header />
          {children}
          <Footer />
        </Container>
      </Html>
    </Tailwind>
  )
}

export default Layout
