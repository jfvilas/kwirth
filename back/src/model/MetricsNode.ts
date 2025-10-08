interface NodeMetrics {
  nodeName: string
  systemContainers: SystemContainer[]
  startTime: string
  cpu: ResourceUsage
  memory: MemoryUsage
  network: NetworkUsage
  fs: FilesystemUsage
  runtime: RuntimeUsage
  swap: SwapUsage
  pods: PodMetrics[]
}

interface SystemContainer {
  name: string
  startTime: string
  cpu: ResourceUsage
  memory: MemoryUsage
  swap: SwapUsage
}

interface ResourceUsage {
  time: string
  usageNanoCores: number
  usageCoreNanoSeconds: number
}

interface MemoryUsage {
  time: string
  availableBytes: number
  usageBytes: number
  workingSetBytes: number
  rssBytes: number
  pageFaults: number
  majorPageFaults: number
}

interface SwapUsage {
  time: string
  swapAvailableBytes: number
  swapUsageBytes: number
}

interface NetworkUsage {
  time: string
  name: string
  rxBytes: number
  rxErrors: number
  txBytes: number
  txErrors: number
  interfaces: NetworkInterface[]
}

interface NetworkInterface {
  name: string;
  rxBytes: number;
  rxErrors: number;
  txBytes: number;
  txErrors: number;
}

interface FilesystemUsage {
  time: string;
  availableBytes: number;
  capacityBytes: number;
  usedBytes: number;
  inodesFree: number;
  inodes: number;
  inodesUsed: number;
}

interface RuntimeUsage {
  imageFs: FilesystemUsage;
  containerFs: FilesystemUsage;
}

interface PodMetrics {
  podRef: PodReference;
  startTime: string;
  containers: ContainerMetrics[];
  cpu: ResourceUsage;
  memory: MemoryUsage;
  network: NetworkUsage;
  volume: VolumeUsage[];
  ephemeralStorage: FilesystemUsage;
  processStats: ProcessStats;
  swap: SwapUsage;
}

interface PodReference {
  name: string;
  namespace: string;
  uid: string;
}

interface ContainerMetrics {
  name: string;
  startTime: string;
  cpu: ResourceUsage;
  memory: MemoryUsage;
  rootfs: FilesystemUsage;
  logs: FilesystemUsage;
  swap: SwapUsage;
}

interface VolumeUsage {
  time: string;
  availableBytes: number;
  capacityBytes: number;
  usedBytes: number;
  inodesFree: number;
  inodes: number;
  inodesUsed: number;
  name: string;
}

interface ProcessStats {
  processCount: number;
}

export { NodeMetrics }