import Link from '@docusaurus/Link'
import { faGithub } from '@fortawesome/free-brands-svg-icons'
import { faBook, faCode, faServer } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

export function MinimalOSSFooter() {
  return (
    <section className="border-t border-gray-200 bg-gray-50 py-12">
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          <div className="flex items-center gap-3">
            <FontAwesomeIcon icon={faCode} className="text-gray-400" />
            <div>
              <p className="text-sm font-medium text-gray-700">
                Open Source Software
              </p>
              <p className="text-xs text-gray-500">
                MIT Licensed • Free Forever • Self-Hostable
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <Link
              to="https://github.com/uzh-bf/klicker-uzh"
              className="flex items-center gap-2 text-sm text-gray-600 transition-colors hover:text-gray-900"
            >
              <FontAwesomeIcon icon={faGithub} />
              <span>Source Code</span>
            </Link>

            <Link
              to="/docs/deployment"
              className="flex items-center gap-2 text-sm text-gray-600 transition-colors hover:text-gray-900"
            >
              <FontAwesomeIcon icon={faServer} />
              <span>Self-Host</span>
            </Link>

            <Link
              to="/docs/api"
              className="flex items-center gap-2 text-sm text-gray-600 transition-colors hover:text-gray-900"
            >
              <FontAwesomeIcon icon={faBook} />
              <span>API Docs</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
