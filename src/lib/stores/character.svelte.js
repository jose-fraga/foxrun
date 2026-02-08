export const characters = [
  { id: 'fox', name: 'Fox', model: '/Fox.gltf' },
  { id: 'husky', name: 'Husky', model: '/Husky.gltf' },
  { id: 'wolf', name: 'Wolf', model: '/Wolf.gltf' },
  { id: 'shiba', name: 'Shiba', model: '/ShibaInu.gltf' },
]

let selected = $state(characters[0])

export function getSelectedCharacter() {
  return selected
}

export function setSelectedCharacter(char) {
  selected = char
}
