interface Props {
  count: number
}

function NotificationBadge({ count }: Props) {
  if (count < 10 && count > 0) {
    return (
      <div className="absolute z-10 w-5 h-5 rounded-xl text-white text-sm text-center bg-red-600 right-0 top-0.5">
        {count}
      </div>
    )
  }

  if (count >= 10) {
    return (
      <div className="absolute right-0 pt-[0.1rem] z-10 w-5 h-5 text-xs text-center text-white bg-red-600 rounded-xl top-0.5">
        9+
      </div>
    )
  }

  return null
}

export default NotificationBadge
