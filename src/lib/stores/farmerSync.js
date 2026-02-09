// Farmer sync state — tracks whether this client is the farmer host
// and the latest remote farmer state from the network
export const farmerSync = {
  isHost: false,
  remote: null, // { x, z, ry, anim } — updated by network
}
