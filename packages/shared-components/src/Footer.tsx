import React from 'react'
import { twMerge } from 'tailwind-merge'

interface FooterProps {
  className?: string
  children?: React.ReactNode
}

function Footer({ className, children }: FooterProps): React.ReactElement {
  return (
    <footer className={twMerge('bg-slate-100 px-4 print:hidden', className)}>
      <hr className="bg-linear-to-r h-px border-0 from-transparent via-gray-500 to-transparent" />
      {children ? (
        children
      ) : (
        <>
          <p className="m-0 py-2 text-center text-xs leading-5 text-gray-600">
            &copy;
            {new Date().getFullYear()} DF Teaching Center, Department of
            Finance, University of Zurich. All rights reserved.
          </p>
        </>
      )}
    </footer>
  )
}

export default Footer
