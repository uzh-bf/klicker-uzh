import localFont from 'next/font/local'

export const sourceSansPro = localFont({
  src: './fonts/source-sans-3/SourceSans3VF-Upright.ttf.woff2',
  weight: '300 700',
  adjustFontFallback: 'Arial',
  variable: '--source-sans-pro',
})

export const monoSpaceFont = localFont({
  src: [
    {
      path: './fonts/jetbrains-mono/JetBrainsMono-Light.woff2',
      weight: '300',
    },
    {
      path: './fonts/jetbrains-mono/JetBrainsMono-Regular.woff2',
      weight: '400',
    },
    {
      path: './fonts/jetbrains-mono/JetBrainsMono-Bold.woff2',
      weight: '700',
    },
  ],
  adjustFontFallback: 'Arial',
  variable: '--mono-space-font',
})
