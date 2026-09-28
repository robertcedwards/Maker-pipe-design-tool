import type { PipeSize } from '../model/types';

/**
 * EMT (electrical metallic tubing) data per trade size, from the ANSI C80.3 /
 * UL 797 dimension tables. Lengths in inches, weight in pounds per foot.
 */
export interface EmtSpec {
  size: PipeSize;
  label: string;
  od: number;
  wall: number;
  lbPerFt: number;
}

export const EMT: Record<PipeSize, EmtSpec> = {
  '1/2': { size: '1/2', label: '1/2" EMT', od: 0.706, wall: 0.042, lbPerFt: 0.3 },
  '3/4': { size: '3/4', label: '3/4" EMT', od: 0.922, wall: 0.049, lbPerFt: 0.46 },
  '1': { size: '1', label: '1" EMT', od: 1.163, wall: 0.057, lbPerFt: 0.67 },
};

/** EMT is sold in 10 ft sticks. */
export const STICK_LENGTH = 120;

export const radius = (size: PipeSize): number => EMT[size].od / 2;

/**
 * Approximate connector envelope used for cut-length deductions, spacing
 * checks and the 3D models. Maker Pipe does not publish drawings, so these are
 * measured-from-photo estimates; cut lists call them out as approximate.
 */
export interface ConnectorDims {
  /** Length of the clamp that wraps a through pipe, measured along that pipe. */
  clampLength: number;
  /** Length of the sleeve that grips a pipe end. */
  sleeveLength: number;
  /** Steel thickness + clearance added to the pipe radius for clamp shells. */
  shell: number;
  /** Extra distance from the through pipe to the end of a hinged (adjustable) arm. */
  hingeOffset: number;
}

export const CONNECTOR_DIMS: Record<PipeSize, ConnectorDims> = {
  '1/2': { clampLength: 1.5, sleeveLength: 1.5, shell: 0.08, hingeOffset: 1.0 },
  '3/4': { clampLength: 1.75, sleeveLength: 1.75, shell: 0.08, hingeOffset: 1.25 },
  '1': { clampLength: 2.0, sleeveLength: 2.0, shell: 0.09, hingeOffset: 1.5 },
};

/** How far a pipe must run past a joint centre when it is the through pipe of an elbow or corner. */
export const overhang = (size: PipeSize): number => CONNECTOR_DIMS[size].clampLength / 2 + 0.125;
