import { Source_Sans_3 } from 'next/font/google'

const sourceSans3 = Source_Sans_3({ subsets: ['latin'] })

export default function Home() {
  return <main className={sourceSans3.className}>hallo</main>
}
