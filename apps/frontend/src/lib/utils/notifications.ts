export function createNotification(title: string, text: string, icon?: string): any {
  if (!('Notification' in window) || Notification.permission !== 'granted') return null

  try {
    if (icon) {
      return new Notification(title, {
        body: text,
        icon,
      })
    }

    return new Notification(title, {
      body: text,
    })
  } catch (e) {
    console.error(e)
  }

  return null
}

export function requestNotificationPermissions(cb?: any) {
  if ('Notification' in window && Notification.permission !== 'granted') {
    if (cb) {
      Notification.requestPermission(cb)
    } else {
      Notification.requestPermission()
    }
  }
}
