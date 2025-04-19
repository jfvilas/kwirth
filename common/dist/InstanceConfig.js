"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InstanceConfigScopeEnum = exports.InstanceConfigViewEnum = exports.InstanceConfigObjectEnum = void 0;
// export enum InstanceConfigChannelEnum {
//     NONE = 'none',
//     LOG = 'log',
//     METRICS = 'metrics',
//     AUDIT = 'audit',
//     ALARM = 'alarm',
//     ALERT = 'alert'
// }
// export enum InstanceConfigActionEnum {
//     NONE = 'none',
//     START = 'start',
//     STOP = 'stop',
//     PAUSE = 'pause',
//     CONTINUE = 'continue',
//     MODIFY = 'modify',
//     PING = 'ping',
//     RECONNECT = 'reconnect'
// }
var InstanceConfigObjectEnum;
(function (InstanceConfigObjectEnum) {
    InstanceConfigObjectEnum["PODS"] = "pods";
    InstanceConfigObjectEnum["EVENTS"] = "events";
})(InstanceConfigObjectEnum || (exports.InstanceConfigObjectEnum = InstanceConfigObjectEnum = {}));
// export enum InstanceConfigFlowEnum {
//     REQUEST = 'request',
//     RESPONSE = 'response',
//     UNSOLICITED = 'unsolicited'
// }
var InstanceConfigViewEnum;
(function (InstanceConfigViewEnum) {
    InstanceConfigViewEnum["NONE"] = "none";
    InstanceConfigViewEnum["CLUSTER"] = "cluster";
    InstanceConfigViewEnum["NAMESPACE"] = "namespace";
    InstanceConfigViewEnum["GROUP"] = "group";
    InstanceConfigViewEnum["POD"] = "pod";
    InstanceConfigViewEnum["CONTAINER"] = "container";
})(InstanceConfigViewEnum || (exports.InstanceConfigViewEnum = InstanceConfigViewEnum = {}));
var InstanceConfigScopeEnum;
(function (InstanceConfigScopeEnum) {
    InstanceConfigScopeEnum["NONE"] = "none";
    // LOG
    InstanceConfigScopeEnum["FILTER"] = "filter";
    InstanceConfigScopeEnum["VIEW"] = "view";
    InstanceConfigScopeEnum["RESTART"] = "restart";
    InstanceConfigScopeEnum["API"] = "api";
    InstanceConfigScopeEnum["CLUSTER"] = "cluster";
    // METRICS
    InstanceConfigScopeEnum["SNAPSHOT"] = "snapshot";
    InstanceConfigScopeEnum["STREAM"] = "stream";
    // ALARM
    InstanceConfigScopeEnum["CREATE"] = "create";
    InstanceConfigScopeEnum["SUBSCRIBE"] = "subscribe";
})(InstanceConfigScopeEnum || (exports.InstanceConfigScopeEnum = InstanceConfigScopeEnum = {}));
