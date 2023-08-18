import { faMessage } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

export default function AnnouncementBanner() {
  return (
    <div className="flex flex-row items-center gap-6 bg-uzh-red-20 p-4">
      <div>
        <FontAwesomeIcon icon={faMessage} />
      </div>
      <div>
        <div className="font-bold">KlickerUZH v3.0 - Release Announcement</div>
        <div>
          The new KlickerUZH v3.0 will be released on August 26, 2023. This
          version (v2) of the KlickerUZH will be available until the end of
          2023. Refer to our{' '}
          <a
            href="https://community.klicker.uzh.ch/t/klickeruzh-v3-0-release-announcement-26-08-2023/79"
            target="_blank"
          >
            community post
          </a>{' '}
          for more information.
        </div>
      </div>
    </div>
  )
}
