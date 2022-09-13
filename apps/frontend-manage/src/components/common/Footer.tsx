import React from 'react'
import { twMerge } from 'tailwind-merge'

interface FooterProps {
  className?: string
}

const defaultProps = {
  className: '',
}

function Footer({ className }: FooterProps): React.ReactElement {
  return (
    <footer className={twMerge('absolute bottom-0 w-full -ml-4', className)}>
      <hr className="h-[1px] border-0 bg-gradient-to-r from-transparent via-gray-500 to-transparent" />
      <p className="py-4 m-0 text-xs leading-5 text-center text-gray-400 bg-gray-50">
        &copy;
        {new Date().getFullYear()} IBF Teaching Center, Department of Banking
        and Finance, University of Zurich. All rights reserved.
        <br />
        Products and Services displayed herein are trademarks or registered
        trademarks of their respective owners.
      </p>
    </footer>
  )
}

Footer.defaultProps = defaultProps

export default Footer
