'use client'

import { RuntimeProvider } from '@/app/RuntimeProvider'
import { AppSidebar } from '@/components/app-sidebar'
import { Thread } from '@/components/assistant-ui/thread'
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

export const Assistant = () => {
  return (
    <RuntimeProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink asChild>
                    <div className="cursor-pointer">Klicker Chat</div>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>New Chat</BreadcrumbPage>
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
