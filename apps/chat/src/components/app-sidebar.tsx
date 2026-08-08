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
  useSidebar,
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

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const t = useTranslations()
  const { chatbotId } = useParams<{ chatbotId: string }>()
  const router = useRouter()
  const { createThread, participationRequired } = useChatStore()
  const { setOpenMobile } = useSidebar()

  const handleNewThread = async () => {
    if (participationRequired) return
    try {
      const threadId = await createThread(chatbotId)
      router.push(`/${chatbotId}/threads/${threadId}`)
      setOpenMobile(false)
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
              {/* Name lives in the persistent top header now (assistant.tsx
                  SidebarMain) — showing it again here while the sidebar is
                  open would just duplicate it. */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    data-cy="chat-new-thread-button"
                    onClick={handleNewThread}
                    disabled={participationRequired}
                    className="text-muted-foreground hover:text-foreground ml-auto mr-1 inline-flex size-11 items-center justify-center rounded-sm transition-colors touch-manipulation disabled:pointer-events-none disabled:opacity-50 sm:size-8"
                  >
                    <Plus className="size-4" />
                    <span className="sr-only">{t('chat.sidebar.newChat')}</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent>{t('chat.sidebar.newChat')}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  {/* The design-system trigger ships a hardcoded English
                      "Toggle Sidebar" sr-only label; an explicit aria-label
                      wins over it so screen readers follow the UI locale. */}
                  <SidebarTrigger
                    className="mr-2 size-11 shrink-0 touch-manipulation sm:size-8"
                    aria-label={t('chat.sidebar.closeSidebar')}
                  />
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

      <SidebarRail aria-label={t('chat.sidebar.toggleSidebar')} />
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
                  unoptimized
                  className="h-6 w-auto object-contain md:h-8"
                />
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        {/* V4/D6: the standalone chat view no longer renders the shared
            <Footer> band; its legal line moves here instead (embedded mode
            never showed the footer or this sidebar, so nothing changes for
            it). Wording matches packages/shared-components/src/Footer.tsx,
            which is hardcoded English there too — kept as-is rather than
            introducing a new i18n key for reused copy. */}
        <p className="text-muted-foreground px-3 pb-2 text-center text-xs">
          &copy;{new Date().getFullYear()} DF Teaching Center, Department of
          Finance, University of Zurich. All rights reserved.
        </p>
      </SidebarFooter>
    </Sidebar>
  )
}
