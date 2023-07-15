export default function CaseSummary({ goals, tags, children }) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-8">
      <div className="flex-1 md:w-64 md:flex-initial md:rounded md:border md:border-solid md:border-gray-300 md:px-4 md:py-2 md:shadow">
        <div className="font-bold">Goals</div>
        <ul className="mt-2 pl-4 text-sm">
          {goals.map((goal) => (
            <li>{goal}</li>
          ))}
        </ul>
      </div>
      <div className="flex-1">
        <div className="mt-2 font-bold">Scenario Description</div>

        <div className="mt-2 flex flex-row flex-wrap gap-1">
          {tags.map((tag) => (
            <div className="rounded border border-solid border-gray-300 px-2 py-1 text-xs shadow-sm">
              {tag}
            </div>
          ))}
        </div>

        <div className="mt-4">{children}</div>
      </div>
    </div>
  )
}
