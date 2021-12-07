import React from 'react'

export default function CaseSummary({ goals, children }) {
  return (
    <div className="flex flex-col gap-8 md:items-start md:flex-row">
      <div className="flex-1 p-4 bg-gray-100 border border-solid rounded shadow md:flex-initial md:w-80">
        <div className="text-lg font-bold">Goals</div>
        <ul className="pl-4 mt-2">
          {goals.map((goal) => (
            <li>{goal}</li>
          ))}
        </ul>
      </div>
      <div className="flex-1">{children}</div>
    </div>
  )
}
