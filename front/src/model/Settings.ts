import { MetricsConfigModeEnum } from '@jfvilas/kwirth-common'

class Settings {
    public logMaxMessages:number = 1000
    public logPrevious:boolean = false
    public logTimestamp:boolean = false

    public metricsMode:MetricsConfigModeEnum = MetricsConfigModeEnum.STREAM
    public metricsDepth:number = 10
    public metricsWidth:number = 3
    public metricsInterval:number = 60
    public metricsMetrics:string[] = [
        'container_fs_writes_total',
        'container_fs_reads_total',
        'container_cpu_usage_seconds_total',
        'container_memory_usage_bytes',
        'container_network_receive_bytes_total',
        'container_network_transmit_bytes_total'
    ]
    public metricsAggregate:boolean = true

    public clusterMetricsInterval:number = 120
}

export { Settings }