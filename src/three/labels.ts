// Pipe labels are plain DOM elements laid over the canvas. A projector inside
// the canvas moves them every frame, which is far cheaper than a React root
// per label.

import type { V3 } from '../model/vec';

export const labelAnchors = new Map<string, V3>();
export const labelElements = new Map<string, HTMLElement>();
