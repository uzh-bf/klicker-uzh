import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
} from '@uzh-bf/design-system'
import { Plus } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import * as React from 'react'
import { useChatStore } from '../stores/chatStore'
import { SettingsPanel } from './settings-panel'
import { ThreadList } from './thread-list'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { chatbotId } = useParams<{ chatbotId: string }>()
  const router = useRouter()
  const { createThread, participationRequired } = useChatStore()

  const handleNewThread = async () => {
    if (participationRequired) return
    try {
      const threadId = await createThread(chatbotId)
      router.push(`/${chatbotId}/threads/${threadId}`)
    } catch {
      /* handled centrally */
    }
  }

  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center gap-2 p-2">
              <button
                data-cy="chat-new-thread-button"
                onClick={handleNewThread}
                disabled={participationRequired}
                className="bg-uzh-blue hover:bg-uzh-blue-80 flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-colors disabled:pointer-events-none disabled:opacity-50"
              >
                <Plus className="size-4" />
                New Chat
              </button>
              <div className="ml-auto">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <SidebarTrigger className="size-5" />
                  </TooltipTrigger>
                  <TooltipContent>Close sidebar</TooltipContent>
                </Tooltip>
              </div>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <ThreadList />
      </SidebarContent>

      <SidebarRail />
      <SidebarFooter className="p-0">
        <SettingsPanel />
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link
                href="https://www.klicker.uzh.ch"
                target="_blank"
                className="flex items-center justify-center"
              >
                <Image
                  src="/KlickerLogo.png"
                  alt="Klicker Logo"
                  width={120}
                  height={60}
                  className="h-8 w-auto object-contain"
                />
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
