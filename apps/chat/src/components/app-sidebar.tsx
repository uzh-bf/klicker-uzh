import { useChatStore } from '@/src/stores/chatStore'
import { useSettingsStore } from '@/src/stores/settingsStore'
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
import { SettingsPanel } from './settings-panel'
import { ThreadList } from './thread-list'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'

export function AppSidebar({
  chatbotName,
  ...props
}: React.ComponentProps<typeof Sidebar> & { chatbotName?: string }) {
  const { chatbotId } = useParams<{ chatbotId: string }>()
  const router = useRouter()
  const { createThread, participationRequired } = useChatStore()
  const authMode = useSettingsStore((s) => s.authMode)

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
            <div className="flex items-center py-1.5 pl-3">
              {chatbotName && (
                <span className="min-w-0 truncate text-sm">{chatbotName}</span>
              )}
              {authMode === 'anonymous' && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="ml-2 inline-flex shrink-0 items-center rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                      Guest
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    Signed in via LTI. Chats stay separate from any account.
                  </TooltipContent>
                </Tooltip>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleNewThread}
                    disabled={participationRequired}
                    className="text-muted-foreground hover:text-foreground ml-auto mr-1 inline-flex size-4 items-center justify-center rounded-sm transition-colors disabled:pointer-events-none disabled:opacity-50"
                  >
                    <Plus className="size-4" />
                    <span className="sr-only">New Chat</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent>New Chat</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <SidebarTrigger className="mr-2 size-4 shrink-0" />
                </TooltipTrigger>
                <TooltipContent>Close sidebar</TooltipContent>
              </Tooltip>
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
                  className="h-6 w-auto object-contain md:h-8"
                />
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
