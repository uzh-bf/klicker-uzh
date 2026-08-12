import localFont from 'next/font/local'

export const sourceSansPro = localFont({
  src: './fonts/source-sans-3/SourceSans3-Latin.woff2',
  weight: '300 700',
  adjustFontFallback: 'Arial',
  variable: '--source-sans-pro',
})

export const monoSpaceFont = localFont({
  src: './fonts/jetbrains-mono/JetBrainsMono-Latin.woff2',
  weight: '300 700',
  adjustFontFallback: 'Arial',
  variable: '--mono-space-font',
})
