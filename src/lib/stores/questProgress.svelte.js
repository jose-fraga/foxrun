function randomizeHolePosition() {
  // Hole: along south fence (z ≈ -178), random X
  const hx = -80 + Math.random() * 160  // -80 to 80
  return {
    holeX: Math.round(hx),
    holeZ: -178,
  }
}

const initPos = randomizeHolePosition()

let quests = $state({
  tomatoes: false,
  softspot: false,
  farmerInfo: false,
  shovel: false,
  escaped: false,
  cinematicDone: false,
  startTime: Date.now(),
  endTime: null,
  holeX: initPos.holeX,
  holeZ: initPos.holeZ,
})

export function getQuests() {
  return quests
}

export function completeQuest(name) {
  if (quests[name] !== undefined) {
    quests[name] = true
  }
}

export function allQuestsComplete() {
  return quests.tomatoes && quests.softspot && quests.farmerInfo && quests.shovel
}

export function setEscaped() {
  quests.escaped = true
  quests.endTime = Date.now()
}

export function setCinematicDone() {
  quests.cinematicDone = true
}

export function resetQuests() {
  const pos = randomizeHolePosition()
  quests.tomatoes = false
  quests.softspot = false
  quests.farmerInfo = false
  quests.shovel = false
  quests.escaped = false
  quests.cinematicDone = false
  quests.startTime = Date.now()
  quests.endTime = null
  quests.holeX = pos.holeX
  quests.holeZ = pos.holeZ
}

export function getElapsedTime() {
  const end = quests.endTime || Date.now()
  const ms = end - quests.startTime
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}
