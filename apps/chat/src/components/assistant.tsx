'use client'

import Footer from '@klicker-uzh/shared-components/src/Footer'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  SidebarInset,
  SidebarProvider,
} from '@uzh-bf/design-system'
import { RuntimeProvider } from '../app/RuntimeProvider'
import { useChatStore } from '../stores/chatStore'
import { AppSidebar } from './app-sidebar'
import { Thread } from './thread'

export const Assistant = ({
  chatbot,
}: {
  chatbot: { id: string; name: string }
}) => {
  const { activeThreadId, threads } = useChatStore()

  const activeThread = threads.find((t) => t.id === activeThreadId)

  return (
    <RuntimeProvider chatbotId={chatbot.id}>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-10 shrink-0 items-center gap-2 border-b bg-gray-50 px-4">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden sm:block">
                  <BreadcrumbLink asChild>
                    <div className="cursor-pointer">{chatbot.name}</div>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden sm:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>
                    {activeThread?.title || 'New Chat'}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </header>
          <div className="flex flex-1 flex-col">
            <Thread />
            <Footer />
          </div>
        </SidebarInset>
      </SidebarProvider>
    </RuntimeProvider>
  )
}
