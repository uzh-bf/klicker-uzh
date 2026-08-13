interface TeamMember {
  imgSrc: string
  name: string
  position: string
}

// Array of team members

function Team({ teamMembers }: { teamMembers: TeamMember[] }) {
  return (
    <section className="pt-12">
      <div className="container mx-auto">
        <div className="mb-12 text-center">
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Our Team
          </h2>
        </div>
        <div className="flex flex-wrap justify-center gap-8">
          {teamMembers.map((item) => (
            <div
              className="w-16 overflow-hidden rounded-lg shadow-lg sm:w-1/2 md:w-1/3 lg:w-1/4"
              key={item.name}
            >
              <div className="h-52 overflow-hidden bg-white p-2 pt-3">
                <img
                  src={item.imgSrc}
                  alt={item.name}
                  className="h-full w-full transform object-contain"
                />
              </div>
              <div className="pb-0 pt-2 text-center">
                <h4 className="text-primary mb-2 text-xl font-medium">
                  {item.name}
                </h4>
                <p className="mb-2 text-sm text-gray-600">{item.position}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default Team
