import { TransferFunction, TransferFunctionPoint } from '../types/volume';

export function createTransferFunctionTexture(
  points: TransferFunctionPoint[],
  resolution: number = 256
): Uint8Array {
  const data = new Uint8Array(resolution * 4);

  for (let i = 0; i < resolution; i++) {
    const value = i / (resolution - 1);
    const color = interpolateTransferFunction(points, value);

    data[i * 4] = Math.floor(color.r * 255);
    data[i * 4 + 1] = Math.floor(color.g * 255);
    data[i * 4 + 2] = Math.floor(color.b * 255);
    data[i * 4 + 3] = Math.floor(color.a * 255);
  }

  return data;
}

function interpolateTransferFunction(
  points: TransferFunctionPoint[],
  value: number
): { r: number; g: number; b: number; a: number } {
  if (value <= points[0].value) {
    return { r: points[0].color[0], g: points[0].color[1], b: points[0].color[2], a: points[0].opacity };
  }

  if (value >= points[points.length - 1].value) {
    const last = points[points.length - 1];
    return { r: last.color[0], g: last.color[1], b: last.color[2], a: last.opacity };
  }

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];

    if (value >= p1.value && value <= p2.value) {
      const t = (value - p1.value) / (p2.value - p1.value);
      return {
        r: p1.color[0] + (p2.color[0] - p1.color[0]) * t,
        g: p1.color[1] + (p2.color[1] - p1.color[1]) * t,
        b: p1.color[2] + (p2.color[2] - p1.color[2]) * t,
        a: p1.opacity + (p2.opacity - p1.opacity) * t
      };
    }
  }

  return { r: 0, g: 0, b: 0, a: 0 };
}

export function buildTransferFunctionTextureData(tf: TransferFunction): {
  densityData: Uint8Array;
  zeffData: Uint8Array;
} {
  return {
    densityData: createTransferFunctionTexture(tf.densityPoints),
    zeffData: createTransferFunctionTexture(tf.zEffectivePoints)
  };
}

export function generateMockVolumeData(
  width: number,
  height: number,
  depth: number
): { densityData: Uint8Array; zEffectiveData: Uint8Array } {
  const size = width * height * depth;
  const densityData = new Uint8Array(size);
  const zEffectiveData = new Uint8Array(size);

  for (let z = 0; z < depth; z++) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = z * width * height + y * width + x;

        const nx = (x - width / 2) / (width / 2);
        const ny = (y - height / 2) / (height / 2);
        const nz = (z - depth / 2) / (depth / 2);

        const containerWall = Math.min(
          Math.abs(nx) > 0.85 ? 1.0 : 0.0,
          Math.abs(ny) > 0.8 ? 1.0 : 0.0,
          Math.abs(nz) > 0.9 ? 1.0 : 0.0
        );

        const cargoDist = Math.sqrt(nx * nx * 0.8 + ny * ny + nz * nz * 0.7);
        const cargoBase = cargoDist < 0.6 ? 0.3 : 0.0;

        const sphere1Dist = Math.sqrt(
          Math.pow(nx - 0.2, 2) +
          Math.pow(ny + 0.1, 2) +
          Math.pow(nz - 0.15, 2)
        );
        const heavyMetalSphere = sphere1Dist < 0.12 ? 0.95 : 0.0;

        const sphere2Dist = Math.sqrt(
          Math.pow(nx + 0.25, 2) +
          Math.pow(ny - 0.15, 2) +
          Math.pow(nz + 0.1, 2)
        );
        const contrabandSphere = sphere2Dist < 0.15 ? 0.72 : 0.0;

        const boxDist = Math.max(
          Math.abs(nx - 0.05),
          Math.abs(ny + 0.25),
          Math.abs(nz + 0.2)
        );
        const steelBox = boxDist < 0.18 ? 0.85 : 0.0;

        const noise = (Math.sin(nx * 15 + ny * 7 + nz * 11) * 0.5 + 0.5) * 0.15;

        let density = Math.max(containerWall * 0.6, cargoBase + noise * 0.5);
        density = Math.max(density, heavyMetalSphere);
        density = Math.max(density, contrabandSphere);
        density = Math.max(density, steelBox);

        let zeff = density * 0.4;
        if (heavyMetalSphere > 0) zeff = 0.92;
        if (steelBox > 0) zeff = 0.78;
        if (contrabandSphere > 0) zeff = 0.55;
        if (containerWall > 0) zeff = 0.65;

        densityData[idx] = Math.floor(density * 255);
        zEffectiveData[idx] = Math.floor(zeff * 255);
      }
    }
  }

  return { densityData, zEffectiveData };
}
