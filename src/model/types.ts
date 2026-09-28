import type { V3 } from './vec';

/** EMT conduit trade sizes the connectors are made for. */
export type PipeSize = '1/2' | '3/4' | '1';

export const PIPE_SIZES: PipeSize[] = ['1/2', '3/4', '1'];

/**
 * What sits on a pipe end that is not part of a joint.
 * - open:   bare cut end
 * - cap:    End Cap (plastic plug, tapped in flush)
 * - foot:   Rubber Pipe Foot (pushed onto the end)
 * - caster: locking swivel caster on a Caster Insert tapped into the end
 * - flange: Flange Connector, pipe square to a flat surface
 * - angle-flange: Adjustable Angle Flange, pipe at an angle to a flat surface
 */
export type EndFitting = 'open' | 'cap' | 'foot' | 'caster' | 'flange' | 'angle-flange';

export const END_FITTINGS: EndFitting[] = ['cap', 'foot', 'caster', 'flange', 'angle-flange', 'open'];

export interface Pipe {
  id: string;
  a: V3;
  b: V3;
  size: PipeSize;
  /** Fitting on end A/B when that end is free. Undefined means the design default. */
  endA?: EndFitting;
  endB?: EndFitting;
}

/** User choices for a joint, keyed by the joint's point key. */
export interface JointOverride {
  /** For joints where every pipe ends: which pipe runs through the connector. */
  throughPipeId?: string;
  /** Use the Adjustable Angle Connector even where a fixed-angle one fits. */
  preferAdjustable?: boolean;
}

export type Finish = 'silver' | 'black';

export interface Design {
  version: 1;
  name: string;
  pipes: Pipe[];
  joints: Record<string, JointOverride>;
  /** Fitting applied to free ends that have no explicit choice. */
  defaultEnd: EndFitting;
  /** Connector coating: zinc (silver) or black. */
  finish?: Finish;
  /** Extra catalog items added by hand, keyed by `${productId}|${size ?? ''}`. */
  extras?: Record<string, number>;
  notes?: string;
}

/**
 * Connector kinds the analyser can place. Each maps to a catalog product.
 * Arms are the terminating pipes; every kind except the coupling clamps one through pipe.
 * - t:          T Connector, 1 arm at 90 deg
 * - 90:         90 Degree Connector, 2 arms at 90 deg to each other (box corner)
 * - 180:        180 Degree Connector, 2 arms in line on opposite sides
 * - 135:        135 Degree Connector, 2 arms 135 deg apart (octagons, roofs)
 * - 4way:       4 Way Connector, 3 arms at 90 deg steps
 * - 5way:       5 Way Connector, 4 arms in a plus
 * - 45:         45 Degree Connector, 1 arm tilted 45 deg along the through pipe
 * - adjustable: Adjustable Angle Hinge Connector, 1 arm at any angle
 * - adjustable-180: Adjustable 180 Degree Connector, 2 arms on opposite sides, each at any angle
 * - coupling:   EMT Conduit Structural Coupling, joins two pipe ends in line
 */
export type ConnectorKind =
  | 't'
  | '90'
  | '180'
  | '135'
  | '4way'
  | '5way'
  | '45'
  | 'adjustable'
  | 'adjustable-180'
  | 'coupling';

export type IssueLevel = 'error' | 'warning' | 'info';

export interface Issue {
  level: IssueLevel;
  message: string;
  pipeIds?: string[];
  jointKey?: string;
  pos?: V3;
}
