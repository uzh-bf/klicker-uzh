import Error from 'next/error'
import React from 'react'

export default function NotFound(): React.ReactElement {
  return <Error statusCode={404} />
}
