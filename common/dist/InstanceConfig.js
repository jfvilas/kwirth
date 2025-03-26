"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InstanceConfigScopeEnum = exports.InstanceConfigViewEnum = exports.InstanceConfigFlowEnum = exports.InstanceConfigObjectEnum = exports.InstanceConfigActionEnum = exports.InstanceConfigChannelEnum = void 0;
var InstanceConfigChannelEnum;
(function (InstanceConfigChannelEnum) {
    InstanceConfigChannelEnum["NONE"] = "none";
    InstanceConfigChannelEnum["LOG"] = "log";
    InstanceConfigChannelEnum["METRICS"] = "metrics";
    InstanceConfigChannelEnum["AUDIT"] = "audit";
    InstanceConfigChannelEnum["ALARM"] = "alarm";
    InstanceConfigChannelEnum["ALERT"] = "alert";
})(InstanceConfigChannelEnum || (exports.InstanceConfigChannelEnum = InstanceConfigChannelEnum = {}));
var InstanceConfigActionEnum;
(function (InstanceConfigActionEnum) {
    InstanceConfigActionEnum["START"] = "start";
    InstanceConfigActionEnum["STOP"] = "stop";
    InstanceConfigActionEnum["PAUSE"] = "pause";
    InstanceConfigActionEnum["CONTINUE"] = "continue";
    InstanceConfigActionEnum["MODIFY"] = "modify";
    InstanceConfigActionEnum["PING"] = "ping";
    InstanceConfigActionEnum["RECONNECT"] = "reconnect";
})(InstanceConfigActionEnum || (exports.InstanceConfigActionEnum = InstanceConfigActionEnum = {}));
var InstanceConfigObjectEnum;
(function (InstanceConfigObjectEnum) {
    InstanceConfigObjectEnum["PODS"] = "pods";
    InstanceConfigObjectEnum["EVENTS"] = "events";
})(InstanceConfigObjectEnum || (exports.InstanceConfigObjectEnum = InstanceConfigObjectEnum = {}));
var InstanceConfigFlowEnum;
(function (InstanceConfigFlowEnum) {
    InstanceConfigFlowEnum["REQUEST"] = "request";
    InstanceConfigFlowEnum["RESPONSE"] = "response";
})(InstanceConfigFlowEnum || (exports.InstanceConfigFlowEnum = InstanceConfigFlowEnum = {}));
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
