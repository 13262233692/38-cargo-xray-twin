import {
  VolumeData,
  SlicePlane,
  ROIBoundingBox,
  TomographySliceData,
  QuantitativeAnalysisResult,
  ContrabandAlert
} from '../types/volume';

interface WorkerRequest {
  type: 'extract_slice' | 'fbp_reconstruct' | 'quantitative_analysis';
  volumeData: {
    densityData: Uint8Array;
    zeffData: Uint8Array;
    width: number;
    height: number;
    depth: number;
  };
  slicePlane?: {
    origin: [number, number, number];
    normal: [number, number, number];
    up: [number, number, number];
  };
  roi?: {
    min: [number, number, number];
    max: [number, number, number];
  };
  targetResolution?: number;
  projections?: number;
  requestId?: number;
}

export class TomographyService {
  private worker: Worker | null = null;
  private pendingRequests: Map<number, {
    resolve: (value: any) => void;
    reject: (reason: any) => void;
  }> = new Map();
  private requestId = 0;
  private workerUrl: string | null = null;

  constructor() {
    this.initWorker();
  }

  private initWorker() {
    try {
      const workerCode = `
        const HISTOGRAM_BINS = 32;
        const DEFAULT_TARGET_RESOLUTION = 256;

        function trilinearSample(data, w, h, d, x, y, z) {
          if (x < 0 || x >= w - 1 || y < 0 || y >= h - 1 || z < 0 || z >= d - 1) return 0;
          const x0 = Math.floor(x), y0 = Math.floor(y), z0 = Math.floor(z);
          const x1 = x0 + 1, y1 = y0 + 1, z1 = z0 + 1;
          const fx = x - x0, fy = y - y0, fz = z - z0;
          const i000 = z0 * w * h + y0 * w + x0;
          const i100 = z0 * w * h + y0 * w + x1;
          const i010 = z0 * w * h + y1 * w + x0;
          const i110 = z0 * w * h + y1 * w + x1;
          const i001 = z1 * w * h + y0 * w + x0;
          const i101 = z1 * w * h + y0 * w + x1;
          const i011 = z1 * w * h + y1 * w + x0;
          const i111 = z1 * w * h + y1 * w + x1;
          const v00 = data[i000] * (1 - fx) + data[i100] * fx;
          const v10 = data[i010] * (1 - fx) + data[i110] * fx;
          const v01 = data[i001] * (1 - fx) + data[i101] * fx;
          const v11 = data[i011] * (1 - fx) + data[i111] * fx;
          const v0 = v00 * (1 - fy) + v10 * fy;
          const v1 = v01 * (1 - fy) + v11 * fy;
          return v0 * (1 - fz) + v1 * fz;
        }

        function extractSlice(volDensity, volZeff, w, h, d, origin, normal, up, targetSize) {
          const dot = normal[0]*up[0] + normal[1]*up[1] + normal[2]*up[2];
          const ux = up[0] - dot * normal[0];
          const uy = up[1] - dot * normal[1];
          const uz = up[2] - dot * normal[2];
          const uLen = Math.sqrt(ux*ux + uy*uy + uz*uz);
          const rightX = ux / uLen, rightY = uy / uLen, rightZ = uz / uLen;
          const upX = normal[1]*rightZ - normal[2]*rightY;
          const upY = normal[2]*rightX - normal[0]*rightZ;
          const upZ = normal[0]*rightY - normal[1]*rightX;
          
          const densityOut = new Float32Array(targetSize * targetSize);
          const zeffOut = new Float32Array(targetSize * targetSize);
          const halfSize = targetSize / 2;
          const pixelSize = 1.0 / targetSize * 1.5;

          for (let y = 0; y < targetSize; y++) {
            for (let x = 0; x < targetSize; x++) {
              const fx = (x - halfSize) * pixelSize;
              const fy = (y - halfSize) * pixelSize;
              const wx = origin[0] + fx * rightX + fy * upX;
              const wy = origin[1] + fx * rightY + fy * upY;
              const wz = origin[2] + fx * rightZ + fy * upZ;
              const vx = (wx + 0.5) * (w - 1);
              const vy = (wy + 0.5) * (h - 1);
              const vz = (wz + 0.5) * (d - 1);
              const idx = y * targetSize + x;
              densityOut[idx] = trilinearSample(volDensity, w, h, d, vx, vy, vz) / 255.0;
              zeffOut[idx] = trilinearSample(volZeff, w, h, d, vx, vy, vz) / 255.0;
            }
          }
          return { density: densityOut, zeff: zeffOut, width: targetSize, height: targetSize };
        }

        function analyzeRegion(volDensity, volZeff, w, h, d, roiMin, roiMax) {
          const x0 = Math.max(0, Math.floor(roiMin[0] * w));
          const x1 = Math.min(w - 1, Math.ceil(roiMax[0] * w));
          const y0 = Math.max(0, Math.floor(roiMin[1] * h));
          const y1 = Math.min(h - 1, Math.ceil(roiMax[1] * h));
          const z0 = Math.max(0, Math.floor(roiMin[2] * d));
          const z1 = Math.min(d - 1, Math.ceil(roiMax[2] * d));
          
          const densityHist = new Array(HISTOGRAM_BINS).fill(0);
          const zeffHist = new Array(HISTOGRAM_BINS).fill(0);
          
          let totalDensity = 0, totalZeff = 0, maxDensity = 0, maxZeff = 0;
          let voxelCount = 0, nonZeroVoxels = 0;
          let heavyMetalVoxels = 0, organicVoxels = 0, contrabandVoxels = 0;
          
          const suspiciousRegions = [];
          const regionSize = 16;

          for (let z = z0; z < z1; z += regionSize) {
            for (let y = y0; y < y1; y += regionSize) {
              for (let x = x0; x < x1; x += regionSize) {
                let regDensSum = 0, regZeffSum = 0, regMaxDens = 0, regMaxZeff = 0, regVoxels = 0;
                const rx0 = x, rx1 = Math.min(x1, x + regionSize);
                const ry0 = y, ry1 = Math.min(y1, y + regionSize);
                const rz0 = z, rz1 = Math.min(z1, z + regionSize);
                
                for (let rz = rz0; rz < rz1; rz++) {
                  for (let ry = ry0; ry < ry1; ry++) {
                    for (let rx = rx0; rx < rx1; rx++) {
                      const idx = rz * w * h + ry * w + rx;
                      const density = volDensity[idx] / 255.0;
                      const zeff = volZeff[idx] / 255.0;
                      
                      totalDensity += density; totalZeff += zeff;
                      maxDensity = Math.max(maxDensity, density);
                      maxZeff = Math.max(maxZeff, zeff);
                      voxelCount++;
                      if (density > 0.05) nonZeroVoxels++;
                      if (zeff > 0.75 && density > 0.5) heavyMetalVoxels++;
                      if (density > 0.3 && density < 0.7 && zeff > 0.3 && zeff < 0.6) organicVoxels++;
                      if (density > 0.6 && density < 0.85 && zeff > 0.4 && zeff < 0.7) contrabandVoxels++;
                      
                      const dBin = Math.min(HISTOGRAM_BINS - 1, Math.floor(density * HISTOGRAM_BINS));
                      const zBin = Math.min(HISTOGRAM_BINS - 1, Math.floor(zeff * HISTOGRAM_BINS));
                      densityHist[dBin]++;
                      zeffHist[zBin]++;
                      
                      regDensSum += density; regZeffSum += zeff;
                      regMaxDens = Math.max(regMaxDens, density);
                      regMaxZeff = Math.max(regMaxZeff, zeff);
                      regVoxels++;
                    }
                  }
                }
                
                if (regVoxels > 0 && regMaxDens > 0.6) {
                  const avgDensity = regDensSum / regVoxels;
                  const avgZeff = regZeffSum / regVoxels;
                  let type = null;
                  if (avgZeff > 0.75 && avgDensity > 0.5) type = 'heavy_metal';
                  else if (avgDensity > 0.6 && avgDensity < 0.85 && avgZeff > 0.4 && avgZeff < 0.7) type = 'contraband';
                  else if (avgDensity > 0.7) type = 'high_density';
                  
                  if (type) {
                    suspiciousRegions.push({
                      center: [(rx0+rx1)/2/w, (ry0+ry1)/2/h, (rz0+rz1)/2/d],
                      size: [(rx1-rx0)/w, (ry1-ry0)/h, (rz1-rz0)/d],
                      avgDensity, avgZeff,
                      maxDensity: regMaxDens, maxZeff: regMaxZeff,
                      volumeVoxels: regVoxels, type
                    });
                  }
                }
              }
            }
          }
          
          const avgDensity = voxelCount > 0 ? totalDensity / voxelCount : 0;
          const avgZeff = voxelCount > 0 ? totalZeff / voxelCount : 0;
          const totalVolVox = (x1-x0) * (y1-y0) * (z1-z0);
          const volumeCm3 = totalVolVox * 0.001;
          const estimatedMassKg = volumeCm3 * avgDensity * 0.008;
          
          const contrabandScore = Math.min(1, contrabandVoxels / Math.max(1, nonZeroVoxels) * 5);
          const heavyMetalScore = Math.min(1, heavyMetalVoxels / Math.max(1, nonZeroVoxels) * 3);
          const contrabandProbability = Math.min(1, contrabandScore * 0.6 + heavyMetalScore * 0.4);
          
          return {
            totalVolumeVoxels: totalVolVox,
            totalPhysicalVolume: totalVolVox,
            avgDensity, avgZEffective: avgZeff,
            maxDensity, maxZEffective: maxZeff,
            densityHistogram: densityHist.map(v => v / voxelCount),
            zeffHistogram: zeffHist.map(v => v / voxelCount),
            contrabandProbability,
            heavyMetalContent: heavyMetalVoxels / Math.max(1, nonZeroVoxels),
            organicContent: organicVoxels / Math.max(1, nonZeroVoxels),
            suspiciousRegions: suspiciousRegions.sort((a,b) => b.maxDensity - a.maxDensity).slice(0, 10),
            volumeCm3, estimatedMassKg
          };
        }

        self.onmessage = function(e) {
          const startTime = performance.now();
          const request = e.data;
          
          try {
            const { densityData, zeffData, width, height, depth } = request.volumeData;
            
            if (request.type === 'extract_slice') {
              const origin = request.slicePlane.origin;
              const normal = request.slicePlane.normal;
              const up = request.slicePlane.up;
              const resolution = request.targetResolution || DEFAULT_TARGET_RESOLUTION;
              
              const sliceData = extractSlice(
                densityData, zeffData, width, height, depth,
                origin, normal, up, resolution
              );
              
              self.postMessage({
                type: 'slice_result',
                success: true,
                sliceData,
                processingTime: performance.now() - startTime
              }, [sliceData.density.buffer, sliceData.zeff.buffer]);
            }
            else if (request.type === 'quantitative_analysis') {
              const roi = request.roi;
              const analysis = analyzeRegion(
                densityData, zeffData, width, height, depth,
                roi.min, roi.max
              );
              
              self.postMessage({
                type: 'analysis_result',
                success: true,
                analysis,
                processingTime: performance.now() - startTime
              });
            }
          } catch (error) {
            self.postMessage({
              type: request.type === 'quantitative_analysis' ? 'analysis_result' : 'slice_result',
              success: false,
              error: error.message,
              processingTime: performance.now() - startTime
            });
          }
        };
      `;

      const blob = new Blob([workerCode], { type: 'application/javascript' });
      this.workerUrl = URL.createObjectURL(blob);
      this.worker = new Worker(this.workerUrl);
      this.worker.onmessage = this.handleMessage.bind(this);
      this.worker.onerror = this.handleError.bind(this);
    } catch (error) {
      console.warn('[Tomography] Failed to initialize Web Worker, using main thread fallback');
    }
  }

  private handleMessage(event: MessageEvent) {
    const response = event.data;
    const requestId = response.requestId || 0;
    const pending = this.pendingRequests.get(requestId);
    
    if (pending) {
      this.pendingRequests.delete(requestId);
      if (response.success) {
        pending.resolve(response);
      } else {
        pending.reject(new Error(response.error || 'Unknown error'));
      }
    }
  }

  private handleError(error: ErrorEvent) {
    console.error('[Tomography] Worker error:', error);
    this.pendingRequests.forEach(pending => {
      pending.reject(new Error(error.message));
    });
    this.pendingRequests.clear();
  }

  private sendRequest<T>(request: Omit<WorkerRequest, 'volumeData'> & { volumeData?: any }): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.worker) {
        reject(new Error('Worker not initialized'));
        return;
      }

      const id = this.requestId++;
      this.pendingRequests.set(id, { resolve, reject });
      
      const fullRequest = { ...request, requestId: id };
      this.worker.postMessage(fullRequest);
    });
  }

  async extractSlice(
    volumeData: VolumeData,
    slicePlane: SlicePlane,
    targetResolution: number = 256
  ): Promise<TomographySliceData> {
    const response = await this.sendRequest<{
      sliceData: TomographySliceData;
      processingTime: number;
    }>({
      type: 'extract_slice',
      volumeData: {
        densityData: new Uint8Array(volumeData.densityData),
        zeffData: new Uint8Array(volumeData.zEffectiveData),
        width: volumeData.dimensions.width,
        height: volumeData.dimensions.height,
        depth: volumeData.dimensions.depth
      },
      slicePlane: {
        origin: slicePlane.origin,
        normal: slicePlane.normal,
        up: slicePlane.up
      },
      targetResolution
    });

    return response.sliceData;
  }

  async analyzeRegion(
    volumeData: VolumeData,
    roi: ROIBoundingBox
  ): Promise<QuantitativeAnalysisResult> {
    const response = await this.sendRequest<{
      analysis: QuantitativeAnalysisResult;
      processingTime: number;
    }>({
      type: 'quantitative_analysis',
      volumeData: {
        densityData: new Uint8Array(volumeData.densityData),
        zeffData: new Uint8Array(volumeData.zEffectiveData),
        width: volumeData.dimensions.width,
        height: volumeData.dimensions.height,
        depth: volumeData.dimensions.depth
      },
      roi: {
        min: roi.min,
        max: roi.max
      }
    });

    return response.analysis;
  }

  generateAlerts(analysis: QuantitativeAnalysisResult): ContrabandAlert[] {
    const alerts: ContrabandAlert[] = [];

    if (analysis.contrabandProbability > 0.8) {
      const region = analysis.suspiciousRegions[0];
      if (region) {
        alerts.push({
          id: `alert-${Date.now()}-contraband`,
          timestamp: Date.now(),
          type: 'contraband',
          severity: 'critical',
          probability: analysis.contrabandProbability,
          location: region.center,
          size: region.size,
          description: '检测到高概率违禁物品，建议立即开箱检查',
          volumeCm3: analysis.volumeCm3,
          estimatedMassKg: analysis.estimatedMassKg,
          avgZeff: analysis.avgZEffective,
          avgDensity: analysis.avgDensity,
          acknowledged: false
        });
      }
    }

    if (analysis.heavyMetalContent > 0.3) {
      const region = analysis.suspiciousRegions.find(r => r.type === 'heavy_metal');
      if (region) {
        alerts.push({
          id: `alert-${Date.now()}-heavymetal`,
          timestamp: Date.now(),
          type: 'heavy_metal',
          severity: 'high',
          probability: analysis.heavyMetalContent,
          location: region.center,
          size: region.size,
          description: '检测到大量重金属成分，请核实是否为申报物品',
          volumeCm3: analysis.volumeCm3,
          estimatedMassKg: analysis.estimatedMassKg,
          avgZeff: analysis.avgZEffective,
          avgDensity: analysis.avgDensity,
          acknowledged: false
        });
      }
    }

    if (analysis.maxDensity > 0.85 && analysis.contrabandProbability > 0.4) {
      alerts.push({
        id: `alert-${Date.now()}-suspicious`,
        timestamp: Date.now(),
        type: 'suspicious',
        severity: 'medium',
        probability: analysis.contrabandProbability,
        location: [0.5, 0.5, 0.5],
        size: [0.2, 0.2, 0.2],
        description: '发现异常高密度区域，建议重点检查',
        volumeCm3: analysis.volumeCm3,
        estimatedMassKg: analysis.estimatedMassKg,
        avgZeff: analysis.avgZEffective,
        avgDensity: analysis.avgDensity,
        acknowledged: false
      });
    }

    return alerts;
  }

  dispose() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    if (this.workerUrl) {
      URL.revokeObjectURL(this.workerUrl);
      this.workerUrl = null;
    }
    this.pendingRequests.clear();
  }
}

export const tomographyService = new TomographyService();
