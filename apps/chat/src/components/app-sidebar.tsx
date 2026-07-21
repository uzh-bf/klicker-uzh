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
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import * as React from 'react'
import { useChatStore } from '../stores/chatStore'
import { CreditsFooter } from './credits-footer'
import { SettingsPanel } from './settings-panel'
import { ThreadList } from './thread-list'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'

export function AppSidebar({
  chatbotName,
  ...props
}: React.ComponentProps<typeof Sidebar> & { chatbotName?: string }) {
  const t = useTranslations()
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
            <div className="flex items-center py-1.5 pl-3">
              {chatbotName && (
                <span className="min-w-0 truncate text-sm">{chatbotName}</span>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    data-cy="chat-new-thread-button"
                    onClick={handleNewThread}
                    disabled={participationRequired}
                    className="text-muted-foreground hover:text-foreground ml-auto mr-1 inline-flex size-4 items-center justify-center rounded-sm transition-colors disabled:pointer-events-none disabled:opacity-50"
                  >
                    <Plus className="size-4" />
                    <span className="sr-only">{t('chat.sidebar.newChat')}</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent>{t('chat.sidebar.newChat')}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <SidebarTrigger className="mr-2 size-4 shrink-0" />
                </TooltipTrigger>
                <TooltipContent>
                  {t('chat.sidebar.closeSidebar')}
                </TooltipContent>
              </Tooltip>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <p className="text-foreground px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide">
          {t('chat.sidebar.conversationsLabel')}
        </p>
        <ThreadList />
      </SidebarContent>

      <SidebarRail />
      <SidebarFooter className="p-0">
        <SettingsPanel />
        <CreditsFooter />
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
                  alt={t('chat.sidebar.logoAlt')}
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
