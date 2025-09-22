'use client'

import { useEffect, useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/app/components/ui/alert-dialog'
import { CookieService } from '@/app/cookies'
import { useSearchParams } from 'next/navigation'
import disclaimersMap, {
  DisclaimerName,
} from '@/app/components/disclaimer-content/disclaimer-map'

export default function DisclaimerDialog() {
  const searchParams = useSearchParams()

  const disclaimerName = process.env.NEXT_PUBLIC_DISCLAIMER_NAME as
    | DisclaimerName
    | undefined
  const disclaimerTitle = process.env.NEXT_PUBLIC_DISCLAIMER_TITLE
  const contentExists =
    disclaimerName !== undefined && disclaimerTitle !== undefined

  const [open, setOpen] = useState(false)
  useEffect(() => {
    let shouldShowDisclaimer = contentExists

    try {
      shouldShowDisclaimer = contentExists && !CookieService.getIsConsented()

      const disclaimerShown = localStorage.getItem('disclaimer-shown')
      if (disclaimerShown === 'true') {
        shouldShowDisclaimer = false
      }
    } catch (e) {}

    // workaround to have default open without hydration error - set open after mount
    // https://github.com/radix-ui/primitives/issues/1386#issuecomment-1171798282
    setOpen(shouldShowDisclaimer)
  }, [searchParams, contentExists])

  const onContinueClick = () => {
    try {
      localStorage.setItem('disclaimer-shown', 'true')
      CookieService.setIsConsented(true)
    } catch (e) {}
  }

  const DisclaimerComponent = disclaimersMap[disclaimerName!]

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent className="min-h-content max-h-[95%] w-full min-w-[60%] max-w-[95%] overflow-y-auto xl:max-w-5xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-center text-xl md:text-left">
            {disclaimerTitle}
          </AlertDialogTitle>
          <AlertDialogDescription>
            <DisclaimerComponent />
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={onContinueClick}>
            Continue
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
