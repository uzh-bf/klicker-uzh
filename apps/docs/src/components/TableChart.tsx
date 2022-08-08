import { twMerge } from 'tailwind-merge'

export default function TableChart({ className, title, data }) {
  const total = data.reduce((acc, item) => item.count + acc, 0)

  return (
    <div
      className={twMerge(
        'max-w-lg border border-gray-300 border-solid rounded p-2',
        className
      )}
    >
      {title && (
        <div className="px-2 py-1 mb-2 font-bold bg-gray-100 rounded shadow">
          {title}
        </div>
      )}
      <table className="mb-0">
        <thead className="bg-gray-100">
          <th className="text-right">Name</th>
          <th className="text-center">Count</th>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr>
              <td className="w-full text-right">{item.name}</td>
              <td className="text-center">{item.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-2 text-sm italic text-gray-500">
        Own depicition based on preliminary data from {total} respondents.
      </div>
    </div>
  )
}
