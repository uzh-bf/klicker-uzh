import Image from 'next/image'
import type { ReactNode } from 'react'

interface ChatRecoveryCardProps {
  readonly dataCy: string
  readonly logoAlt: string
  readonly title: string
  readonly message: string
  readonly children: ReactNode
}

export function ChatRecoveryCard({
  dataCy,
  logoAlt,
  title,
  message,
  children,
}: ChatRecoveryCardProps) {
  return (
    <main
      data-cy={dataCy}
      id="main-content"
      tabIndex={-1}
      className="bg-muted flex min-h-screen w-full items-center justify-center px-4 py-8"
    >
      <section
        aria-labelledby={`${dataCy}-title`}
        aria-describedby={`${dataCy}-message`}
        className="bg-card w-full max-w-lg rounded-xl border p-8 text-center shadow-sm sm:p-10"
      >
        <Image
          src="/KlickerLogo.png"
          alt={logoAlt}
          width={180}
          height={40}
          priority
          className="mx-auto h-10 w-auto"
        />
        <h1
          data-cy={`${dataCy}-title`}
          className="text-foreground mt-8 text-2xl font-semibold text-balance"
          id={`${dataCy}-title`}
        >
          {title}
        </h1>
        <p
          id={`${dataCy}-message`}
          className="text-muted-foreground mt-4 text-base text-pretty"
        >
          {message}
        </p>
        <div
          data-cy={`${dataCy}-actions`}
          className="mt-8 flex flex-col justify-center gap-3 sm:flex-row"
        >
          {children}
        </div>
      </section>
    </main>
  )
}
