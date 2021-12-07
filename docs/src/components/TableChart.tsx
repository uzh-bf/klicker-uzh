import clsx from 'clsx'
import React from 'react'

export default function TableChart({ className, title, data }) {
  return (
    <div className={clsx('max-w-lg border border-solid p-2', className)}>
      {title && (
        <div className="bg-gray-100 rounded py-1 px-2 font-bold shadow mb-2">
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
    </div>
  )
}
