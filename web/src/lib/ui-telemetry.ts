export type UIEventPayload = {
  screen: string
  component: string
  event_name: string
  resource_id?: string
  state_from?: string
  state_to?: string
  metadata?: Record<string, unknown>
}

export const trackUIEvent = async (payload: UIEventPayload) => {
  try {
    await fetch("/api/app/ui-events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    })
  } catch {
    // Fire-and-forget telemetry should not break UI flow.
  }
}
