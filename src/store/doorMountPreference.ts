import type { FrontMount } from '../domain/fronts/types'

export const DOOR_MOUNT_STORAGE_KEY = 'cabinet-designer:door-mount'

/** An editor preference, like the language: never part of Project JSON. */
export function loadDoorMount(): FrontMount {
  try {
    return localStorage.getItem(DOOR_MOUNT_STORAGE_KEY) === 'inset'
      ? 'inset'
      : 'overlay'
  } catch {
    return 'overlay'
  }
}

export function saveDoorMount(mount: FrontMount) {
  try {
    localStorage.setItem(DOOR_MOUNT_STORAGE_KEY, mount)
  } catch {
    // Unavailable storage only costs the remembered choice.
  }
}
