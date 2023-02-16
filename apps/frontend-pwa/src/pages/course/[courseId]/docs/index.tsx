import DocsLayout from '@components/DocsLayout'
import Markdown from '@klicker-uzh/markdown'
import { H3 } from '@uzh-bf/design-system'
import Image from 'next/image'

function Landing() {
  return (
    <DocsLayout>
      {(courseInformation) => (
        <>
          <H3>Kursinformationen</H3>
          <Markdown
            content={courseInformation.description}
            components={{
              img: ({ src }: { src: string }) => (
                <div className="relative h-96">
                  <Image
                    src={src}
                    alt="Image"
                    fill
                    className="object-contain m-0"
                  />
                </div>
              ),
            }}
          />
        </>
      )}
    </DocsLayout>
  )
}

export default Landing
