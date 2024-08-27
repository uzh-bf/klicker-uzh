import { useTranslations } from 'next-intl'
import React from 'react'
import { twMerge } from 'tailwind-merge'

interface FooterProps {
  browserLink?: string
  className?: string
}

function Footer({ browserLink, className }: FooterProps): React.ReactElement {
  const t = useTranslations()

  return (
    <footer
      className={twMerge(
        '-mb-4 -ml-4 -mr-4 hidden bg-slate-100 md:block print:hidden',
        className
      )}
    >
      <hr className="h-[1px] border-0 bg-gradient-to-r from-transparent via-gray-500 to-transparent" />

      {browserLink && (
        <div className="mt-4 text-center text-sm text-slate-700">
          <a href={browserLink} target="_blank" rel="noreferrer">
            {t('pwa.general.openInBrowser')}
          </a>
        </div>
      )}

      <p className="m-0 py-4 text-center text-xs leading-5 text-gray-400">
        &copy;
        {new Date().getFullYear()} DF Teaching Center, Department of Finance,
        University of Zurich. All rights reserved.
        <br />
        Products and Services displayed herein are trademarks or registered
        trademarks of their respective owners.
      </p>
    </footer>
  )
}

export default Footer
