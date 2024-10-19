export declare enum ServiceConfigTypeEnum {
    LOG = "log",
    METRICS = "metrics"
}
export interface ServiceConfig {
    type: ServiceConfigTypeEnum;
    accessKey: string;
    view: string;
    scope: string;
    namespace: string;
    group: string;
    set: string;
    pod: string;
    container: string;
}
