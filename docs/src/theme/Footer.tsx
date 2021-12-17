import React from 'react'
import useThemeContext from '@theme/hooks/useThemeContext'
import clsx from 'clsx'

const Footer = () => {
  const { isDarkTheme } = useThemeContext()

  return (
    <div className={clsx('w-full bg-gray-100', isDarkTheme && 'bg-gray-700')}>
      <div className="mt-6 text-center ">
        <a href="/">
          <img
            src="/img/KlickerUZH_Gray_Transparent.png"
            className="transition-opacity duration-1000 ease-out opacity-50 w-52 hover:opacity-100"
          />
        </a>
      </div>
      <div className="flex flex-col justify-center w-full mb-6 text-center md:px-10 lg:px-18">
        <div className="self-center max-w-6xl px-10">
          Copyright 2021 @{' '}
          <a href="https://www.bf.uzh.ch/de/studies/general/teaching-center.html">
            Teaching Center
          </a>
          , Department of Banking and Finance, University of Zurich. All rights
          reserved. Products and Services displayed herein are trademarks or
          registered trademarks of their respective owners.
        </div>
        <div className="self-center max-w-6xl px-10">
          <a href="/privacy_policy" className="whitespace-nowrap">
            Privacy Policy
          </a>
          {' | '}
          <a href="/terms_of_service" className="whitespace-nowrap">
            Terms of Service
          </a>
          {' | '}
          <a
            href="https://klicker-uzh.betteruptime.com/"
            className="whitespace-nowrap"
            target="_blank"
          >
            System Status
          </a>
          {' | '}
          <a href="mailto:klicker.support@uzh.ch" className="whitespace-nowrap">
            Contact
          </a>
        </div>
      </div>
    </div>
  )
}

export default Footer
