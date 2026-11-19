import { Vector3 } from 'three'

/** Dimensions in decimeters, shared by the meshes and contact solver. */
export const COLUMNS = 15
export const WIDTH = 1.94
export const PITCH = 0.112
export const SHEET_ROWS = 19
export const FLOOR = -0.78
export const REAR_WALL = -2.46
export const BOX_LENGTH = 2.33
export const BOX_DEPTH = 1.18
export const BOX_HEIGHT = 0.73
export const TOP = FLOOR + BOX_HEIGHT
export const SLOT_HALF_LENGTH = 0.79
export const SLOT_HALF_DEPTH = 0.155
export const PAPER_CLEARANCE = 0.012
export const LIP_HALF_LENGTH = SLOT_HALF_LENGTH - 0.058
export const LIP_HALF_DEPTH = SLOT_HALF_DEPTH * 0.44

export type PaperPoint = { position: Vector3; previous: Vector3 }
export type PaperRow = { id: number; points: PaperPoint[] }
export type CartonPose = { x: number; z: number; yaw: number; lift: number }
