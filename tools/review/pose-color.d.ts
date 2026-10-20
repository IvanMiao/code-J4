export interface DarkInkComparison {
  ok: boolean;
  frameCount: number;
  plateCount: number;
  hueDifference: number | null;
  chromaDifference: number;
}

export function compareDarkInk(
  frameData: ArrayLike<number>,
  frameWidth: number,
  frameHeight: number,
  plateData: ArrayLike<number>,
  plateWidth: number,
  plateHeight: number,
  originX: number,
  originY: number,
): DarkInkComparison;
