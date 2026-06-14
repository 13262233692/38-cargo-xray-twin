export interface VolumeDimensions {
  width: number;
  height: number;
  depth: number;
}

export interface VolumeData {
  dimensions: VolumeDimensions;
  densityData: Uint8Array;
  zEffectiveData: Uint8Array;
  spacing?: { x: number; y: number; z: number };
}

export interface TransferFunctionPoint {
  value: number;
  color: [number, number, number];
  opacity: number;
}

export interface TransferFunction {
  densityPoints: TransferFunctionPoint[];
  zEffectivePoints: TransferFunctionPoint[];
}

export interface VolumeRenderingSettings {
  sampleRate: number;
  brightness: number;
  contrast: number;
  slicePlane: { x: number; y: number; z: number };
  sliceEnabled: { x: boolean; y: boolean; z: boolean };
  highlightHeavyMetals: boolean;
  highlightContraband: boolean;
  adaptiveStepEnabled: boolean;
  maxStepFactor: number;
  minStepFactor: number;
}

export interface SlicePlane {
  origin: [number, number, number];
  normal: [number, number, number];
  up: [number, number, number];
}

export interface ROIBoundingBox {
  min: [number, number, number];
  max: [number, number, number];
}

export interface SuspiciousRegion {
  center: [number, number, number];
  size: [number, number, number];
  avgDensity: number;
  avgZeff: number;
  maxDensity: number;
  maxZeff: number;
  volumeVoxels: number;
  type: 'heavy_metal' | 'contraband' | 'high_density' | 'suspicious';
}

export interface QuantitativeAnalysisResult {
  totalVolumeVoxels: number;
  totalPhysicalVolume: number;
  avgDensity: number;
  avgZEffective: number;
  maxDensity: number;
  maxZEffective: number;
  densityHistogram: number[];
  zeffHistogram: number[];
  contrabandProbability: number;
  heavyMetalContent: number;
  organicContent: number;
  suspiciousRegions: SuspiciousRegion[];
  volumeCm3: number;
  estimatedMassKg: number;
}

export interface TomographySliceData {
  density: Float32Array;
  zeff: Float32Array;
  width: number;
  height: number;
}

export interface ContrabandAlert {
  id: string;
  timestamp: number;
  type: 'heavy_metal' | 'contraband' | 'suspicious';
  severity: 'low' | 'medium' | 'high' | 'critical';
  probability: number;
  location: [number, number, number];
  size: [number, number, number];
  description: string;
  volumeCm3: number;
  estimatedMassKg: number;
  avgZeff: number;
  avgDensity: number;
  acknowledged: boolean;
}

export const DEFAULT_TRANSFER_FUNCTION: TransferFunction = {
  densityPoints: [
    { value: 0, color: [0, 0, 0], opacity: 0 },
    { value: 0.2, color: [0.1, 0.3, 0.5], opacity: 0.05 },
    { value: 0.4, color: [0.3, 0.6, 0.4], opacity: 0.15 },
    { value: 0.6, color: [0.7, 0.6, 0.2], opacity: 0.4 },
    { value: 0.8, color: [0.9, 0.4, 0.1], opacity: 0.7 },
    { value: 1.0, color: [1.0, 0.1, 0.0], opacity: 1.0 }
  ],
  zEffectivePoints: [
    { value: 0, color: [0, 0, 0], opacity: 0 },
    { value: 0.3, color: [0.2, 0.5, 0.8], opacity: 0.1 },
    { value: 0.6, color: [0.8, 0.7, 0.3], opacity: 0.3 },
    { value: 1.0, color: [1.0, 0.2, 0.0], opacity: 0.9 }
  ]
};

export const DEFAULT_RENDERING_SETTINGS: VolumeRenderingSettings = {
  sampleRate: 512,
  brightness: 1.0,
  contrast: 1.0,
  slicePlane: { x: 0.5, y: 0.5, z: 0.5 },
  sliceEnabled: { x: false, y: false, z: false },
  highlightHeavyMetals: true,
  highlightContraband: true,
  adaptiveStepEnabled: true,
  maxStepFactor: 3.0,
  minStepFactor: 0.5
};
