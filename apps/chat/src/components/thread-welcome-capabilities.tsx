import type { ComponentType, FC } from 'react'

// Short capability bullets (icon + text) shown between the welcome greeting
// and the suggestions on the thread's empty state (e.g. the manage assistant
// explaining what it can help with). Extracted out of thread.tsx to keep
// that file focused on the thread/composer/message rendering itself.
export type ThreadWelcomeCapability = {
  icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
  text: string
}

export const ThreadWelcomeCapabilities: FC<{
  capabilities: ThreadWelcomeCapability[]
  limitsNote?: string
}> = ({ capabilities, limitsNote }) => (
  <div className="mt-3 flex w-full max-w-sm flex-col gap-1.5 text-left">
    <ul className="flex flex-col gap-1">
      {capabilities.map(({ icon: Icon, text }, index) => (
        <li
          key={`${text}-${index}`}
          className="text-muted-foreground flex items-start gap-1.5 text-xs leading-snug"
        >
          <Icon aria-hidden className="mt-0.5 size-3 shrink-0" />
          <span>{text}</span>
        </li>
      ))}
    </ul>
    {limitsNote && (
      <p className="text-muted-foreground/70 text-[11px] leading-snug">
        {limitsNote}
      </p>
    )}
  </div>
)
