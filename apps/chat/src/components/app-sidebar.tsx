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
import { MessagesSquare } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import * as React from 'react'
import { SettingsPanel } from './settings-panel'
import { ThreadList } from './thread-list'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="mt-2 flex items-center justify-between gap-2 p-2 pr-0">
              <div className="flex items-center gap-2">
                <MessagesSquare className="size-6" />
                <span className="text-lg font-semibold">Chat History</span>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <SidebarTrigger className="mr-1 size-5" />
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
