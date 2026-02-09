function randomizePositions() {
  // Bone: random within farm, avoiding spawn (55,-40), pond (-70,-60 r22), and fence edges
  let bx, bz
  do {
    bx = -120 + Math.random() * 240  // -120 to 120
    bz = -150 + Math.random() * 120  // -150 to -30
    const dxSpawn = bx - 55, dzSpawn = bz + 40
    const dxPond = bx + 70, dzPond = bz + 60
    const tooCloseSpawn = dxSpawn * dxSpawn + dzSpawn * dzSpawn < 900  // 30 units
    const tooClosePond = dxPond * dxPond + dzPond * dzPond < 900      // 30 units
    if (!tooCloseSpawn && !tooClosePond) break
  } while (true)

  // Hole: along south fence (z ≈ -178), random X
  const hx = -80 + Math.random() * 160  // -80 to 80

  return {
    boneX: Math.round(bx),
    boneZ: Math.round(bz),
    holeX: Math.round(hx),
    holeZ: -178,
  }
}

const initPos = randomizePositions()

let quests = $state({
  bone: false,
  key: false,
  deer: false,
  cow: false,
  escaped: false,
  cinematicDone: false,
  startTime: Date.now(),
  endTime: null,
  boneX: initPos.boneX,
  boneZ: initPos.boneZ,
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
  return quests.bone && quests.key && quests.deer && quests.cow
}

export function setEscaped() {
  quests.escaped = true
  quests.endTime = Date.now()
}

export function setCinematicDone() {
  quests.cinematicDone = true
}

export function resetQuests() {
  const pos = randomizePositions()
  quests.bone = false
  quests.key = false
  quests.deer = false
  quests.cow = false
  quests.escaped = false
  quests.cinematicDone = false
  quests.startTime = Date.now()
  quests.endTime = null
  quests.boneX = pos.boneX
  quests.boneZ = pos.boneZ
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
