// This component is now just a fallback - middleware handles the redirect
export default function Student() {
  return (
    <div className="flex h-full flex-col items-center justify-center">
      <div className="text-center">
        <h1 className="mb-4 text-2xl font-semibold">
          Redirecting to Edu-ID...
        </h1>
        <p className="text-gray-600">
          Please wait while we redirect you to the authentication service.
        </p>
        <p className="mt-4 text-xs text-gray-400">
          If you are not redirected automatically, please check your URL
          parameters.
        </p>
      </div>
    </div>
  )
}
