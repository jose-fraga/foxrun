let prompt = $state('')

export function setInteractionPrompt(text) {
  prompt = text
}

export function getInteractionPrompt() {
  return prompt
}
