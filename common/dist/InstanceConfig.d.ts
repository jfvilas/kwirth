import { InstanceMessage } from "./InstanceMessage";
export declare enum InstanceConfigObjectEnum {
    PODS = "pods",
    EVENTS = "events"
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
export interface InstanceConfig extends InstanceMessage {
    objects: InstanceConfigObjectEnum;
    accessKey: string;
    scope: string;
    view: InstanceConfigViewEnum;
    namespace: string;
    group: string;
    pod: string;
    container: string;
    data?: any;
}
export interface InstanceConfigResponse extends InstanceMessage {
    text: string;
}
