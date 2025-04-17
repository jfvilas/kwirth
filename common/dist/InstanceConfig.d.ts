export declare enum InstanceConfigChannelEnum {
    NONE = "none",
    LOG = "log",
    METRICS = "metrics",
    AUDIT = "audit",
    ALARM = "alarm",
    ALERT = "alert"
}
export declare enum InstanceConfigActionEnum {
    START = "start",
    STOP = "stop",
    PAUSE = "pause",
    CONTINUE = "continue",
    MODIFY = "modify",
    PING = "ping",
    RECONNECT = "reconnect"
}
export declare enum InstanceConfigObjectEnum {
    PODS = "pods",
    EVENTS = "events"
}
export declare enum InstanceConfigFlowEnum {
    REQUEST = "request",
    RESPONSE = "response"
}
export declare enum InstanceConfigViewEnum {
    NONE = "none",
    CLUSTER = "cluster",
    NAMESPACE = "namespace",
    GROUP = "group",
    POD = "pod",
    CONTAINER = "container"
}
export declare enum InstanceConfigScopeEnum {
    NONE = "none",
    FILTER = "filter",
    VIEW = "view",
    RESTART = "restart",
    API = "api",
    CLUSTER = "cluster",
    SNAPSHOT = "snapshot",
    STREAM = "stream",
    CREATE = "create",
    SUBSCRIBE = "subscribe"
}
export interface InstanceConfig {
    channel: string;
    objects: InstanceConfigObjectEnum;
    action: InstanceConfigActionEnum;
    flow: InstanceConfigFlowEnum;
    instance: string;
    accessKey: string;
    scope: string;
    view: InstanceConfigViewEnum;
    namespace: string;
    group: string;
    pod: string;
    container: string;
    reconnectKey?: string;
    data?: any;
}
export interface InstanceConfigResponse {
    action: InstanceConfigActionEnum;
    flow: InstanceConfigFlowEnum;
    channel: string;
    instance: string;
    type: string;
    text: string;
}
