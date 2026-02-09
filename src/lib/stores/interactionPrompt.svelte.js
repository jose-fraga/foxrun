// Stores the current interaction action word (e.g., "dig", "Escape", "talk")
// Empty string means no prompt active
let action = $state('')

export function setInteractionPrompt(text) {
  action = text
}

export function getInteractionPrompt() {
  return action
}
