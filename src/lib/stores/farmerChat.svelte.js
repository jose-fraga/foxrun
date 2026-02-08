let open = $state(false)
let messages = $state([])
let nearFarmer = $state(false)
let loading = $state(false)

export function getFarmerChat() {
  return { open, messages, nearFarmer, loading }
}

export function setLoading(value) {
  loading = value
}

export function setNearFarmer(value) {
  nearFarmer = value
  if (!value) open = false
}

export function openChat() {
  if (nearFarmer) open = true
}

export function closeChat() {
  open = false
}

export function addMessage(role, text) {
  messages = [...messages, { role, text, time: Date.now() }]
}

export function clearMessages() {
  messages = []
}
