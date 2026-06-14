import { VolumeData, VolumeDimensions } from '../types/volume';

type DataCallback = (data: VolumeData) => void;
type StatusCallback = (status: string, connected: boolean) => void;

export class VolumeDataStreamService {
  private ws: WebSocket | null = null;
  private url: string;
  private onDataCallback: DataCallback | null = null;
  private onStatusCallback: StatusCallback | null = null;
  private dimensions: VolumeDimensions | null = null;
  private receivedSlices: number = 0;
  private densityBuffer: Uint8Array | null = null;
  private zeffBuffer: Uint8Array | null = null;
  private reconnectTimer: number | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;

  constructor(url: string = 'ws://localhost:8080/volume-stream') {
    this.url = url;
  }

  onData(callback: DataCallback): void {
    this.onDataCallback = callback;
  }

  onStatus(callback: StatusCallback): void {
    this.onStatusCallback = callback;
  }

  connect(): void {
    try {
      this.ws = new WebSocket(this.url);
      this.ws.binaryType = 'arraybuffer';

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.notifyStatus('已连接到后端网关', true);
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };

      this.ws.onclose = () => {
        this.notifyStatus('连接已断开', false);
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        this.notifyStatus('连接错误', false);
      };
    } catch (e) {
      this.notifyStatus('连接失败: ' + (e as Error).message, false);
      this.scheduleReconnect();
    }
  }

  private handleMessage(data: ArrayBuffer | string): void {
    if (typeof data === 'string') {
      this.handleHeader(JSON.parse(data));
    } else {
      this.handleSliceData(data);
    }
  }

  private handleHeader(header: any): void {
    if (header.type === 'volume_info') {
      this.dimensions = {
        width: header.width,
        height: header.height,
        depth: header.depth
      };
      const totalSize = header.width * header.height * header.depth;
      this.densityBuffer = new Uint8Array(totalSize);
      this.zeffBuffer = new Uint8Array(totalSize);
      this.receivedSlices = 0;
      this.notifyStatus(`接收体数据: ${header.width}x${header.height}x${header.depth}`, true);
    }
  }

  private handleSliceData(arrayBuffer: ArrayBuffer): void {
    if (!this.dimensions || !this.densityBuffer || !this.zeffBuffer) return;

    const { width, height, depth } = this.dimensions;
    const sliceSize = width * height;

    const view = new DataView(arrayBuffer);
    let offset = 0;

    const sliceIndex = view.getUint32(offset, true);
    offset += 4;

    const sliceBytes = new Uint8Array(arrayBuffer, offset, sliceSize * 2);
    
    const densitySlice = sliceBytes.slice(0, sliceSize);
    const zeffSlice = sliceBytes.slice(sliceSize, sliceSize * 2);

    const startIdx = sliceIndex * sliceSize;
    this.densityBuffer.set(densitySlice, startIdx);
    this.zeffBuffer.set(zeffSlice, startIdx);

    this.receivedSlices++;

    if (this.receivedSlices % Math.floor(depth / 10) === 0 || this.receivedSlices === depth) {
      this.notifyStatus(`数据加载进度: ${Math.floor((this.receivedSlices / depth) * 100)}%`, true);
    }

    if (this.receivedSlices >= depth) {
      this.notifyDataComplete();
    }
  }

  private notifyDataComplete(): void {
    if (!this.dimensions || !this.densityBuffer || !this.zeffBuffer) return;

    const volumeData: VolumeData = {
      dimensions: this.dimensions,
      densityData: new Uint8Array(this.densityBuffer),
      zEffectiveData: new Uint8Array(this.zeffBuffer),
      spacing: { x: 1, y: 1, z: 1 }
    };

    if (this.onDataCallback) {
      this.onDataCallback(volumeData);
    }

    this.notifyStatus('体数据加载完成', true);
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.notifyStatus('重连次数已达上限，请检查后端服务', false);
      return;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 10000);
    
    this.notifyStatus(`${delay / 1000}秒后尝试重连 (${this.reconnectAttempts}/${this.maxReconnectAttempts})`, false);

    this.reconnectTimer = window.setTimeout(() => {
      this.connect();
    }, delay);
  }

  private notifyStatus(status: string, connected: boolean): void {
    if (this.onStatusCallback) {
      this.onStatusCallback(status, connected);
    }
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  requestVolume(filename: string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'request_volume',
        filename: filename
      }));
    }
  }
}
