import Link from '@docusaurus/Link'
import { faArrowRight, faQuoteLeft } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

interface Testimonial {
  id: string
  name: string
  role: string
  institution: string
  quote: string
  impact: {
    metric: string
    value: string
    improvement: string
  }
  useCase: string
  classSize: string
  subject: string
}

const testimonials: Testimonial[] = [
  {
    id: 'meyer',
    name: 'Prof. Dr. Sarah Meyer',
    role: 'Professor of Economics',
    institution: 'University of Zurich',
    quote:
      'I teach 300+ students per lecture. Before KlickerUZH, I had no idea if they understood the material until exam time. Now I get instant feedback and can adjust my teaching on the spot. The anonymous mode finally got my international students participating.',
    impact: {
      metric: 'Student Participation',
      value: '85%',
      improvement: 'up from 25%',
    },
    useCase: 'Large Lectures',
    classSize: '300+ students',
    subject: 'Macroeconomics',
  },
  {
    id: 'schmidt',
    name: 'Dr. Thomas Schmidt',
    role: 'Senior Lecturer',
    institution: 'ETH Zurich',
    quote:
      'The gamification features transformed my programming course. Students actually compete to answer questions now! The automatic grading saves me 4 hours per week, which I can now spend on actual teaching.',
    impact: {
      metric: 'Exam Pass Rate',
      value: '78%',
      improvement: 'up from 62%',
    },
    useCase: 'Technical Courses',
    classSize: '120 students',
    subject: 'Computer Science',
  },
  {
    id: 'wagner',
    name: 'Prof. Anna Wagner',
    role: 'Head of Medical Education',
    institution: 'University of Basel',
    quote:
      "In medical education, checking understanding is crucial. KlickerUZH helps me identify knowledge gaps immediately. The analytics show me exactly which concepts need more explanation. It's become essential for my hybrid classes.",
    impact: {
      metric: 'Concept Retention',
      value: '91%',
      improvement: 'up from 67%',
    },
    useCase: 'Hybrid Teaching',
    classSize: '80 students',
    subject: 'Clinical Medicine',
  },
]

export function EducatorTestimonials() {
  return (
    <section className="bg-white py-20">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-16 text-center">
          <h2 className="mb-4 text-3xl font-bold text-gray-900">
            Trusted by Educators Who Transform Classrooms
          </h2>
          <p className="mx-auto max-w-3xl text-xl text-gray-600">
            See how professors across disciplines use KlickerUZH to solve real
            teaching challenges
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {testimonials.map((testimonial) => (
            <div
              key={testimonial.id}
              className="relative rounded-2xl bg-gray-50 p-8"
            >
              <FontAwesomeIcon
                icon={faQuoteLeft}
                className="absolute right-6 top-6 text-4xl text-red-100"
              />

              <div className="mb-6">
                <p className="relative z-10 italic leading-relaxed text-gray-700">
                  "{testimonial.quote}"
                </p>
              </div>

              <div className="mb-6 border-t border-gray-200 pt-6">
                <div className="mb-4">
                  <p className="font-semibold text-gray-900">
                    {testimonial.name}
                  </p>
                  <p className="text-sm text-gray-600">{testimonial.role}</p>
                  <p className="text-sm text-gray-500">
                    {testimonial.institution}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">Use Case</p>
                    <p className="font-medium text-gray-900">
                      {testimonial.useCase}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Class Size</p>
                    <p className="font-medium text-gray-900">
                      {testimonial.classSize}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-white p-4">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm text-gray-600">
                    {testimonial.impact.metric}
                  </p>
                  <p className="text-xs font-medium text-green-600">
                    {testimonial.impact.improvement}
                  </p>
                </div>
                <div className="flex items-end gap-2">
                  <span className="text-3xl font-bold text-gray-900">
                    {testimonial.impact.value}
                  </span>
                  <div className="h-2 flex-1 rounded-full bg-gradient-to-r from-red-500 to-green-500" />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-16 rounded-2xl bg-gradient-to-r from-gray-50 to-gray-100 p-8">
          <div className="grid grid-cols-1 items-center gap-8 md:grid-cols-2">
            <div>
              <h3 className="mb-4 text-2xl font-bold text-gray-900">
                Join 100+ Universities Already Using KlickerUZH
              </h3>
              <div className="mb-6 space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-red-100">
                    <span className="font-bold text-red-600">1</span>
                  </div>
                  <p className="text-gray-700">
                    <strong>Large Lectures:</strong> Engage 500+ students
                    simultaneously
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-red-100">
                    <span className="font-bold text-red-600">2</span>
                  </div>
                  <p className="text-gray-700">
                    <strong>Seminars:</strong> Foster deep discussions with
                    anonymous Q&A
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-red-100">
                    <span className="font-bold text-red-600">3</span>
                  </div>
                  <p className="text-gray-700">
                    <strong>Hybrid Classes:</strong> Include remote students
                    seamlessly
                  </p>
                </div>
              </div>
              <Link
                to="/use_cases"
                className="inline-flex items-center gap-2 font-medium text-red-600 hover:text-red-700"
              >
                Explore all use cases
                <FontAwesomeIcon icon={faArrowRight} />
              </Link>
            </div>

            <div className="rounded-xl bg-white p-6 shadow-lg">
              <h4 className="mb-4 font-semibold text-gray-900">
                Success by the Numbers
              </h4>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">
                    Average participation increase
                  </span>
                  <span className="text-2xl font-bold text-green-600">
                    +185%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Time saved on grading</span>
                  <span className="text-2xl font-bold text-blue-600">
                    4 hrs/week
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Student satisfaction</span>
                  <span className="text-2xl font-bold text-purple-600">
                    4.8/5
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Exam score improvement</span>
                  <span className="text-2xl font-bold text-red-600">+22%</span>
                </div>
              </div>
              <div className="mt-6 border-t border-gray-200 pt-6">
                <p className="text-center text-sm text-gray-500">
                  Based on feedback from 1,000+ educators
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
