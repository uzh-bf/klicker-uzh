import React from 'react'
import { twMerge } from 'tailwind-merge'

interface FooterProps {
  browserLink?: string
  className?: string
}

const defaultProps = {
  browserLink: undefined,
  className: '',
}

function Footer({ browserLink, className }: FooterProps): React.ReactElement {
  return (
    <footer
      className={twMerge(
        'hidden md:block bg-slate-100 print:hidden -ml-4 -mr-4 -mb-4',
        className
      )}
    >
      <hr className="h-[1px] border-0 bg-gradient-to-r from-transparent via-gray-500 to-transparent" />

      {browserLink && (
        <div className="mt-4 text-sm text-center text-slate-700">
          <a href={browserLink} target="_blank" rel="noreferrer">
            Im Browser öffnen
          </a>
        </div>
      )}

      <p className="py-4 m-0 text-xs leading-5 text-center text-gray-400">
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
