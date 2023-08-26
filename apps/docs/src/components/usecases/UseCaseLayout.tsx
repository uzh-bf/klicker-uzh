import MainStyles from '@docusaurus/theme-classic/lib/theme/DocRoot/Layout/Main/styles.module.css'
import SidebarStyles from '@docusaurus/theme-classic/lib/theme/DocRoot/Layout/Sidebar/styles.module.css'
import DocPageStyles from '@docusaurus/theme-classic/lib/theme/DocRoot/Layout/styles.module.css'
import { ThemeClassNames } from '@docusaurus/theme-common'
import DocSidebar from '@theme/DocSidebar'
import Layout from '@theme/Layout'
import { twMerge } from 'tailwind-merge'

interface UseCaseLayoutProps {
  path: string
  headerImage?: React.ReactNode
  children: React.ReactNode
}

function UseCaseLayout({ path, headerImage, children }: UseCaseLayoutProps) {
  return (
    <Layout>
      {headerImage}
      <div className={twMerge(DocPageStyles.docPage, 'flex flex-row')}>
        <aside
          className={twMerge(
            ThemeClassNames.docs.docSidebarContainer,
            SidebarStyles.docSidebarContainer
          )}
        >
          <DocSidebar
            sidebar={[
              { type: 'link', href: '/use_cases', label: 'Overview' },
              {
                type: 'link',
                href: '/use_cases/live_quiz',
                label: '(Gamified) Live Quizzes',
              },
              {
                type: 'link',
                href: '/use_cases/flipped_classroom',
                label: 'Flipped Classroom',
              },
              {
                type: 'link',
                href: '/use_cases/microlearning',
                label: 'Microlearning',
              },
              {
                type: 'link',
                href: '/use_cases/practive_quiz',
                label: 'Practice Quizzes and Flashcards',
              },
              {
                type: 'link',
                href: '/use_cases/group_activity',
                label: 'Group Activities',
              },
              {
                type: 'link',
                href: '/use_cases/live_qa',
                label: 'Live Q&A and Real-Time Feedback',
              },
              {
                type: 'link',
                href: '/use_cases/gamification',
                label: 'Gamification',
              },
            ]}
            path={path}
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
            {children}
          </div>
        </main>
      </div>
    </Layout>
  )
}

export default UseCaseLayout
