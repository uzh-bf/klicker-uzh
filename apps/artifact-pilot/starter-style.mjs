export const artifactRootClass = 'uzh-artifact'

export const artifactClasses = {
  body: 'm-0 min-h-screen bg-uzh-grey-20 p-4 font-sans text-black sm:p-8',
  main: 'mx-auto w-full max-w-2xl rounded-lg border border-uzh-grey-60 bg-white p-5 sm:p-8',
  heading:
    'mt-0 text-2xl font-semibold leading-tight text-uzh-blue sm:text-3xl',
  label: 'mt-6 block text-sm font-medium',
  input:
    'mt-2 block w-full rounded-md border border-uzh-grey-60 bg-white px-3 py-2 text-lg text-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-uzh-blue',
  result:
    'mt-6 block rounded-md border border-uzh-grey-60 bg-uzh-grey-20 px-4 py-3 text-lg font-semibold leading-relaxed tabular-nums text-uzh-blue',
}

export const artifactCandidates = [
  ...new Set(
    Object.values(artifactClasses).flatMap((classes) => classes.split(/\s+/))
  ),
]
