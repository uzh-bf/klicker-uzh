import Link from '@docusaurus/Link'
import MainStyles from '@docusaurus/theme-classic/lib/theme/DocRoot/Layout/Main/styles.module.css'
import SidebarStyles from '@docusaurus/theme-classic/lib/theme/DocRoot/Layout/Sidebar/styles.module.css'
import DocPageStyles from '@docusaurus/theme-classic/lib/theme/DocRoot/Layout/styles.module.css'
import { ThemeClassNames } from '@docusaurus/theme-common'
import { faArrowRight } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import DocSidebar from '@theme/DocSidebar'
import Layout from '@theme/Layout'
import { Button, H1, H3 } from '@uzh-bf/design-system'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { useCases } from '../../constants'

function Card({ title, image, children, detailsRef }) {
  return (
    <div className="mt-4 flex max-h-80 flex-row rounded-xl bg-slate-100">
      <div className="flex flex-1 flex-col justify-center p-8 md:p-16">
        <H3 className={{ root: 'text-xl' }}>{title}</H3>
        <p className="font-sans text-lg">{children}</p>
        <div>
          <Link href={`/use_cases/${detailsRef}`}>
            <Button>
              <FontAwesomeIcon icon={faArrowRight} />
              Read More
            </Button>
          </Link>
        </div>
      </div>
      <div className="relative hidden flex-1 items-center justify-items-center md:flex">
        <img className="h-full w-full rounded-r-xl object-cover" src={image} />
      </div>
    </div>
  )
}

function Index() {
  const [filteredUseCases, setFilteredUseCases] = useState(useCases)

  return (
    <Layout>
      <div className={twMerge(DocPageStyles.docPage, 'flex flex-row')}>
        <aside
          className={twMerge(
            ThemeClassNames.docs.docSidebarContainer,
            SidebarStyles.docSidebarContainer
          )}
        >
          <DocSidebar
            sidebar={[
              { type: 'link', href: '/myCustomPage', label: 'My Custom Page' },
              {
                type: 'link',
                href: '/anotherCustomPage',
                label: 'Another Custom Page',
              },
            ]}
            path="/myCustomPage"
          />
        </aside>
        <main className={twMerge(MainStyles.docMainContainer)}>
          <div
            className={twMerge(
              'container',
              'padding-top--md',
              'padding-bottom--lg'
            )}
          >
            <div onClick={() => setFilteredUseCases(useCases)}>
              <H1>Use Cases</H1>
            </div>
            {filteredUseCases.map((useCase) => (
              <Card
                title={useCase.title}
                image={useCase.imageSrc}
                detailsRef={useCase.detailsRef}
              >
                {useCase.description}
              </Card>
            ))}
          </div>
        </main>
      </div>
    </Layout>
  )
}

export default Index
