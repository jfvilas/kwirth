export declare enum InstanceMessageChannelEnum {
    NONE = "none",
    LOG = "log",
    METRICS = "metrics",
    AUDIT = "audit",
    OPS = "ops",
    ALERT = "alert",
    TRIVY = "trivy"
}
export declare enum InstanceMessageTypeEnum {
    DATA = "data",
    SIGNAL = "signal"
}
export declare enum InstanceMessageActionEnum {
    NONE = "none",
    ROUTE = "route",
    START = "start",
    STOP = "stop",
    PAUSE = "pause",
    CONTINUE = "continue",
    MODIFY = "modify",
    PING = "ping",
    RECONNECT = "reconnect",
    COMMAND = "command"
}
export declare enum InstanceMessageFlowEnum {
    IMMEDIATE = "immediate",
    REQUEST = "request",
    RESPONSE = "response",
    UNSOLICITED = "unsolicited"
}
export interface InstanceMessage {
    action: InstanceMessageActionEnum;
    flow: InstanceMessageFlowEnum;
    type: InstanceMessageTypeEnum;
    channel: string;
    instance: string;
}
