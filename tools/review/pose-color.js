function luminance(data, index) {
  return 0.2126 * data[index] + 0.7152 * data[index + 1] + 0.0722 * data[index + 2];
}

function hueAndChroma(data, index) {
  const red = data[index], green = data[index + 1], blue = data[index + 2];
  const max = Math.max(red, green, blue), min = Math.min(red, green, blue), chroma = max - min;
  if (!chroma) return { hue: null, chroma };
  let hue;
  if (max === red) hue = ((green - blue) / chroma) % 6;
  else if (max === green) hue = (blue - red) / chroma + 2;
  else hue = (red - green) / chroma + 4;
  hue = (hue * 60 + 360) % 360;
  return { hue, chroma };
}

function darkInkMetrics(data, width, height, dataWidth, offsetX, offsetY, alphaThreshold) {
  let count = 0, chromaTotal = 0, hueX = 0, hueY = 0, hueWeight = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = ((y + offsetY) * dataWidth + x + offsetX) * 4;
      if ((data[index + 3] ?? 255) < alphaThreshold || luminance(data, index) >= 80) continue;
      const { hue, chroma } = hueAndChroma(data, index);
      count++;
      chromaTotal += chroma;
      if (hue !== null) {
        const radians = (hue * Math.PI) / 180;
        hueX += Math.cos(radians) * chroma;
        hueY += Math.sin(radians) * chroma;
        hueWeight += chroma;
      }
    }
  }
  const hue = hueWeight ? (Math.atan2(hueY, hueX) * 180 / Math.PI + 360) % 360 : null;
  return { count, hue, chroma: count ? chromaTotal / count : null };
}

export function compareDarkInk(frameData, frameWidth, frameHeight, plateData, plateWidth, plateHeight, originX, originY) {
  if (originX < 0 || originY < 0 || originX + frameWidth > plateWidth || originY + frameHeight > plateHeight) {
    return { ok: false, frameCount: 0, plateCount: 0, hueDifference: null, chromaDifference: Infinity };
  }
  const frame = darkInkMetrics(frameData, frameWidth, frameHeight, frameWidth, 0, 0, 128);
  const plate = darkInkMetrics(plateData, frameWidth, frameHeight, plateWidth, originX, originY, 0);
  const hueDifference = frame.hue === null || plate.hue === null
    ? null
    : Math.abs(((frame.hue - plate.hue + 540) % 360) - 180);
  const chromaDifference = frame.chroma === null || plate.chroma === null
    ? Infinity
    : Math.abs(frame.chroma - plate.chroma);
  return {
    ok: frame.count > 0 && plate.count > 0 && chromaDifference < 8 && (hueDifference === null || hueDifference < 15),
    frameCount: frame.count,
    plateCount: plate.count,
    hueDifference,
    chromaDifference,
  };
}
