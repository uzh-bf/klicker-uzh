import MainStyles from '@docusaurus/theme-classic/lib/theme/DocRoot/Layout/Main/styles.module.css'
import SidebarStyles from '@docusaurus/theme-classic/lib/theme/DocRoot/Layout/Sidebar/styles.module.css'
import DocPageStyles from '@docusaurus/theme-classic/lib/theme/DocRoot/Layout/styles.module.css'
import { ThemeClassNames } from '@docusaurus/theme-common'
import DocSidebar from '@theme/DocSidebar'
import Layout from '@theme/Layout'
import { twMerge } from 'tailwind-merge'

interface UseCaseLayoutProps {
  path: string
  children: React.ReactNode
}

function UseCaseLayout({ path, children }: UseCaseLayoutProps) {
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
            sidebar={[
              { type: 'link', href: '/use_cases', label: 'Overview' },
              {
                type: 'category',
                label: '(Gamified) Live Quizzes',
                collapsible: true,
                collapsed: true,
                href: '/use_cases/live_quiz',
                items: [
                  {
                    type: 'link',
                    label: 'Introduction',
                    href: `/use_cases/live_quiz#Introduction`,
                  },
                  {
                    type: 'link',
                    label: 'Background',
                    href: '/use_cases/live_quiz#Background',
                  },
                  {
                    type: 'link',
                    label: 'Scenario',
                    href: '/use_cases/live_quiz#Scenario',
                  },
                  {
                    type: 'link',
                    label: 'Learnings',
                    href: '/use_cases/live_quiz#Learnings',
                  },
                ],
              },
              {
                type: 'category',
                label: 'Flipped Classroom',
                collapsible: true,
                collapsed: true,
                href: '/use_cases/flipped_classroom',
                items: [
                  {
                    type: 'link',
                    label: 'Introduction',
                    href: `/use_cases/flipped_classroom#Introduction`,
                  },
                  {
                    type: 'link',
                    label: 'Background',
                    href: '/use_cases/flipped_classroom#Background',
                  },
                  {
                    type: 'link',
                    label: 'Scenario',
                    href: '/use_cases/flipped_classroom#Scenario',
                  },
                  {
                    type: 'link',
                    label: 'Learnings',
                    href: '/use_cases/flipped_classroom#Learnings',
                  },
                ],
              },
              {
                type: 'category',
                label: 'Microlearning',
                collapsible: true,
                collapsed: true,
                href: '/use_cases/microlearning',
                items: [
                  {
                    type: 'link',
                    label: 'Introduction',
                    href: `/use_cases/microlearning#Introduction`,
                  },
                  {
                    type: 'link',
                    label: 'Background',
                    href: '/use_cases/microlearning#Background',
                  },
                  {
                    type: 'link',
                    label: 'Scenario',
                    href: '/use_cases/microlearning#Scenario',
                  },
                  {
                    type: 'link',
                    label: 'Learnings',
                    href: '/use_cases/microlearning#Learnings',
                  },
                ],
              },
              {
                type: 'category',
                label: 'Practice Quizzes and Flashcards',
                collapsible: true,
                collapsed: true,
                href: '/use_cases/practice_quiz',
                items: [
                  {
                    type: 'link',
                    label: 'Introduction',
                    href: `/use_cases/practice_quiz#Introduction`,
                  },
                  {
                    type: 'link',
                    label: 'Background',
                    href: '/use_cases/practice_quiz#Background',
                  },
                  {
                    type: 'link',
                    label: 'Scenario',
                    href: '/use_cases/practice_quiz#Scenario',
                  },
                  {
                    type: 'link',
                    label: 'Learnings',
                    href: '/use_cases/practice_quiz#Learnings',
                  },
                ],
              },
              {
                type: 'category',
                label: 'Group Activities',
                collapsible: true,
                collapsed: true,
                href: '/use_cases/group_activity',
                items: [
                  {
                    type: 'link',
                    label: 'Introduction',
                    href: `/use_cases/group_activity#Introduction`,
                  },
                  {
                    type: 'link',
                    label: 'Background',
                    href: '/use_cases/group_activity#Background',
                  },
                  {
                    type: 'link',
                    label: 'Scenario',
                    href: '/use_cases/group_activity#Scenario',
                  },
                  {
                    type: 'link',
                    label: 'Learnings',
                    href: '/use_cases/group_activity#Learnings',
                  },
                ],
              },
              {
                type: 'category',
                label: 'Live Q&A and Real-Time Feedback',
                collapsible: true,
                collapsed: true,
                href: '/use_cases/live_qa',
                items: [
                  {
                    type: 'link',
                    label: 'Introduction',
                    href: `/use_cases/live_qa#Introduction`,
                  },
                  {
                    type: 'link',
                    label: 'Background',
                    href: '/use_cases/live_qa#Background',
                  },
                  {
                    type: 'link',
                    label: 'Scenario',
                    href: '/use_cases/live_qa#Scenario',
                  },
                  {
                    type: 'link',
                    label: 'Learnings',
                    href: '/use_cases/live_qa#Learnings',
                  },
                ],
              },
              {
                type: 'category',
                label: 'Gamification',
                collapsible: true,
                collapsed: true,
                href: '/use_cases/gamification',
                items: [
                  {
                    type: 'link',
                    label: 'Introduction',
                    href: `/use_cases/gamification#Introduction`,
                  },
                  {
                    type: 'link',
                    label: 'Background',
                    href: '/use_cases/gamification#Background',
                  },
                  {
                    type: 'link',
                    label: 'Scenario',
                    href: '/use_cases/gamification#Scenario',
                  },
                  {
                    type: 'link',
                    label: 'Learnings',
                    href: '/use_cases/gamification#Learnings',
                  },
                ],
              },
            ]}
            path={path}
          />
        </aside>
        <main className={twMerge(MainStyles.docMainContainer)}>
          <div className={twMerge('m-auto w-full max-w-7xl p-4')}>
            {children}
          </div>
        </main>
      </div>
    </Layout>
  )
}

export default UseCaseLayout
