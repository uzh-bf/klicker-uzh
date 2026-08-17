'use client'

import { BotIcon } from 'lucide-react'
import Image from 'next/image'
import { type ComponentType, useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'

type ChatbotAvatarProps = {
  avatar?: string | null
  alt?: string
  className?: string
  fallbackIcon?: ComponentType<{ className?: string }>
  iconClassName?: string
}

export function ChatbotAvatar({
  avatar,
  alt = '',
  className,
  fallbackIcon: FallbackIcon = BotIcon,
  iconClassName,
}: ChatbotAvatarProps) {
  const [failed, setFailed] = useState(false)
  const src = getChatbotAvatarSrc(avatar)

  useEffect(() => {
    setFailed(false)
  }, [src])

  return (
    <span
      className={twMerge(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white text-slate-600',
        className
      )}
      aria-hidden={alt ? undefined : true}
    >
      {src && !failed ? (
        <Image
          src={src}
          alt={alt}
          width={48}
          height={48}
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <FallbackIcon className={twMerge('size-4', iconClassName)} />
      )}
    </span>
  )
}

function getChatbotAvatarSrc(avatar?: string | null): string | null {
  const basePath = process.env.NEXT_PUBLIC_AVATAR_BASE_PATH
  if (!avatar || !basePath) return null
  return `${basePath}/${avatar}.svg`
}
