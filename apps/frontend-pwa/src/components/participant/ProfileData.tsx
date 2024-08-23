import { faStar } from '@fortawesome/free-regular-svg-icons'
import { faShieldHeart, faTrophy } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  Achievement,
  Level,
  ParticipantAchievementInstance,
} from '@klicker-uzh/graphql/dist/ops'
import { Label, Progress } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import { useMemo } from 'react'
import PossibleAchievementsTile from './PossibleAchievementsTile'
import ReceivedAchievementTile from './ReceivedAchievementTile'

interface ProfileProps {
  isSelf?: boolean
  username: string
  xp: number
  level?: Level | null
  achievements?: ParticipantAchievementInstance[] | null
  possibleAchievements?: Achievement[] | null
  avatar?: string | null
  showProfileDetails?: boolean | null
}

function ProfileData({
  isSelf = false,
  username,
  xp,
  level,
  achievements,
  possibleAchievements,
  avatar,
  showProfileDetails,
}: ProfileProps) {
  const t = useTranslations()

  const remainingAchievements = useMemo(
    () =>
      possibleAchievements?.filter(
        (a) => !achievements?.some((b) => b.achievement.id === a.id)
      ),
    [achievements, possibleAchievements]
  )

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-center p-4 md:min-w-[400px]">
      <div className="relative mb-2">
        <div className="h-[200px] w-[200px] rounded-full border border-solid border-black">
          <Image
            src={
              avatar
                ? `${process.env.NEXT_PUBLIC_AVATAR_BASE_PATH}/${avatar}.svg`
                : '/user-solid.svg'
            }
            alt=""
            className="h-[200px] w-[200px] overflow-hidden rounded-full"
            fill
          />
          {level && (
            <div className="absolute -bottom-2 right-0">
              <Image
                src={`${process.env.NEXT_PUBLIC_IMAGE_BASE_PATH}/levels/level_${level.index}.svg`}
                width={50}
                height={50}
                alt="Level"
                className="object-contain"
              />
            </div>
          )}
        </div>
      </div>
      <Label
        label={username}
        className={{ root: 'w-full justify-center pb-4 text-xl font-bold' }}
      />
      <div className="text-md flex w-full flex-col gap-4">
        {level && (
          <div className="flex flex-row items-center">
            <FontAwesomeIcon icon={faTrophy} className="pr-2" />
            <Label
              label={t('shared.generic.levelX', { number: level.index })}
              className={{ root: 'font-bold' }}
            />
          </div>
        )}
        <div>
          <div className="mb-2 flex flex-row items-center">
            <FontAwesomeIcon icon={faStar} className="pr-2" />
            <Label
              label={t('shared.generic.experiencePoints')}
              className={{ root: 'font-bold' }}
            />
          </div>
          <div>
            {level?.nextLevel?.requiredXp && (
              <Progress
                value={xp}
                max={level.nextLevel.requiredXp}
                formatter={Number}
                offset={level.requiredXp}
                className={{ indicator: 'min-w-[55px]' }}
              />
            )}
          </div>
        </div>
        <div>
          <div className="mb-2 flex flex-row items-center">
            <FontAwesomeIcon icon={faShieldHeart} className="pr-2" />
            <Label
              label={t('pwa.profile.achievements')}
              className={{ root: 'font-bold' }}
            />
          </div>
          <div>
            {((!isSelf && (!achievements || achievements.length === 0)) ||
              (isSelf &&
                (!achievements || achievements.length === 0) &&
                (!possibleAchievements ||
                  possibleAchievements.length === 0))) && (
              <div>{t('pwa.achievements.noAchievements')}</div>
            )}
          </div>
          <div className="grid grid-cols-1 justify-items-center gap-3 pb-3 pt-3 md:grid-cols-2">
            {achievements?.map((achievement) => (
              <ReceivedAchievementTile
                key={achievement.id}
                instance={achievement}
              />
            ))}
            {isSelf &&
              remainingAchievements?.map((achievement) => (
                <PossibleAchievementsTile
                  key={achievement.id}
                  achievement={achievement}
                />
              ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProfileData
