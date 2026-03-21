export const pointsBalanceChangedEvent = "app:points-balance-changed"

export const notifyPointsBalanceChanged = () => {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent(pointsBalanceChangedEvent))
}

export const subscribePointsBalanceChanged = (handler: () => void) => {
  if (typeof window === "undefined") {
    return () => {}
  }

  const listener: EventListener = () => {
    handler()
  }

  window.addEventListener(pointsBalanceChangedEvent, listener)
  return () => {
    window.removeEventListener(pointsBalanceChangedEvent, listener)
  }
}
