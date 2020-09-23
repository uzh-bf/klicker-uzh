import React from 'react'
import Error from 'next/error'

export default function NotFound(): React.ReactElement {
  return <Error statusCode={404} />
}
