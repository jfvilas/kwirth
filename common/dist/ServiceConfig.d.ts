export declare enum ServiceConfigChannelEnum {
    UNDEFINED = "undefined",
    LOG = "log",
    METRICS = "metrics"
}
export declare enum ServiceConfigActionEnum {
    START = "start",
    STOP = "stop"
}
export declare enum ServiceConfigFlowEnum {
    REQUEST = "request",
    RESPONSE = "response"
}
export interface ServiceConfig {
    channel: ServiceConfigChannelEnum;
    action: ServiceConfigActionEnum;
    flow: ServiceConfigFlowEnum;
    instance: string;
    accessKey: string;
    view: string;
    scope: string;
    namespace: string;
    group: string;
    set: string;
    pod: string;
    container: string;
}
