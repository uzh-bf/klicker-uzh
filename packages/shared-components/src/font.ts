import { JetBrains_Mono, Source_Sans_3 } from 'next/font/google'

export const sourceSansPro = Source_Sans_3({
  subsets: ['latin'],
  variable: '--source-sans-pro',
  weight: ['300', '400', '700'],
})

export const monoSpaceFont = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--mono-space-font',
  weight: ['300', '400', '700'],
})
