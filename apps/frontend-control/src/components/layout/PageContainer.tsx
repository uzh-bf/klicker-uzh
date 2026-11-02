import { twMerge } from 'tailwind-merge'

// Content column: 16px inset on phones, 24px from 720px, capped at 1040px.
function PageContainer({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={twMerge(
        'mx-auto w-full max-w-[1040px] px-4 min-[720px]:px-6',
        className
      )}
    >
      {children}
    </div>
  )
}

export default PageContainer
