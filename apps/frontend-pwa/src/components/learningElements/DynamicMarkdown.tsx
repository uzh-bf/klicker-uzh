import dynamic from 'next/dynamic'

const DynamicMarkdown = dynamic(
  () => import('@klicker-uzh/markdown').then((pkg) => pkg.Markdown),
  {
    ssr: false,
  }
)

export default DynamicMarkdown
