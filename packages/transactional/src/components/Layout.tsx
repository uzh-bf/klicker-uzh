import {
  Tailwind,
  Html,
  Head,
  Font,
  Preview,
  Container,
} from '@react-email/components'
import React from 'react'
import tailwindConfig from './tailwind.config'
import Header from './Header'
import Footer from './Footer'

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
      <Html lang="en" className="bg-white">
        <Head>
          <title>{title}</title>
          <Font fontFamily="Source Sans 3" fallbackFontFamily="Verdana" />
        </Head>
        <Preview>{preview}</Preview>
        <Container>
          <Header />
          {children}
          <Footer />
        </Container>
      </Html>
    </Tailwind>
  )
}

export default Layout
