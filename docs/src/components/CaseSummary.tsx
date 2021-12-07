import React from 'react'

export default function CaseSummary({ goals, tags, children }) {
  return (
    <div className="flex flex-col gap-8 md:items-start md:flex-row">
      <div className="flex-1 p-4 border border-solid rounded shadow md:flex-initial md:w-80">
        <div className="text-lg font-bold">Goals</div>
        <ul className="pl-4 mt-2">
          {goals.map((goal) => (
            <li>{goal}</li>
          ))}
        </ul>

        <div className="mt-4 text-lg font-bold">Scenarios</div>
        <div className="flex flex-row flex-wrap gap-1 mt-2">
          {tags.map((tag) => (
            <div className="px-1 border border-solid rounded">{tag}</div>
          ))}
        </div>
      </div>
      <div className="flex-1">{children}</div>
    </div>
  )
}
