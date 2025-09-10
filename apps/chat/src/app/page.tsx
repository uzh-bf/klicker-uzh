import Link from 'next/link'

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="mb-4 text-2xl font-bold">KlickerUZH Chat</h1>
        <p className="text-gray-600">
          Please access this chatbot through your course page or with a direct
          link.
        </p>
        <p className="mt-2 text-sm text-gray-500">
          For testing: {/*TODO: remove*/}
          <Link
            href="/8f9c2e1d-4b7a-4c3e-9f5d-1a2b3c4d5e6f"
            className="text-blue-500 underline"
          >
            Access Bennibot
          </Link>
        </p>
      </div>
    </div>
  )
}
