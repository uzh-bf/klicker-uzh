import MainStyles from '@docusaurus/theme-classic/lib/theme/DocRoot/Layout/Main/styles.module.css'
import SidebarStyles from '@docusaurus/theme-classic/lib/theme/DocRoot/Layout/Sidebar/styles.module.css'
import DocPageStyles from '@docusaurus/theme-classic/lib/theme/DocRoot/Layout/styles.module.css'
import { ThemeClassNames } from '@docusaurus/theme-common'
import DocSidebar from '@theme/DocSidebar'
import Layout from '@theme/Layout'
import { twMerge } from 'tailwind-merge'
import { USE_CASES, USE_CASE_CATEGORIES } from '../../constants'

// Generate sidebar items for a use case
const getUseCaseItems = (slug: string) => {
  const items = [
    {
      type: 'link',
      label: 'Introduction',
      href: `/use_cases/${slug}#Introduction`,
    },
    {
      type: 'link',
      label: 'Background',
      href: `/use_cases/${slug}#Background`,
    },
    {
      type: 'link',
      label: 'Scenario',
      href: `/use_cases/${slug}#Scenario`,
    },
    {
      type: 'link',
      label: 'Learnings',
      href: `/use_cases/${slug}#Learnings`,
    },
  ]

  return items
}

interface UseCaseLayoutProps {
  path: string
  children: React.ReactNode
}

function UseCaseLayout({ path, children }: UseCaseLayoutProps) {
  // Generate sidebar structure
  const sidebar = [
    { type: 'link', href: '/use_cases', label: 'Overview' },
    ...Object.entries(USE_CASE_CATEGORIES).flatMap(([categoryId, category]) => [
      {
        type: 'html',
        value: `<div class="menu__list-item p-2 font-semibold uppercase text-sm tracking-wider text-primary mt-4">${category.title}</div>`,
      },
      ...category.useCases.map((slug) => ({
        type: 'category',
        label: USE_CASES[slug].title,
        collapsible: true,
        collapsed: true,
        href: `/use_cases/${slug}`,
        items: getUseCaseItems(slug),
      })),
    ]),
  ]

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
            isHidden={false}
            onCollapse={null}
            sidebar={sidebar}
            path={path}
          />
        </aside>
        <main
          className={twMerge(
            MainStyles.docMainContainer,
            'flex-1 overflow-hidden p-4 lg:p-8'
          )}
        >
          <div className="container max-w-[1200px] px-0">{children}</div>
        </main>
      </div>
    </Layout>
  )
}

export default UseCaseLayout
