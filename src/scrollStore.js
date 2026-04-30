// Global shared scroll state — updated by native scroll listener
// Read inside R3F useFrame without React re-renders
export const scrollStore = {
  progress: 0,        // 0–1 normalized scroll
  velocity: 0,        // scroll speed for momentum effects
  prevProgress: 0,
}
