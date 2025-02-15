"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServiceConfigScopeEnum = exports.ServiceConfigViewEnum = exports.ServiceConfigFlowEnum = exports.ServiceConfigActionEnum = exports.ServiceConfigChannelEnum = void 0;
var ServiceConfigChannelEnum;
(function (ServiceConfigChannelEnum) {
    ServiceConfigChannelEnum["LOG"] = "log";
    ServiceConfigChannelEnum["METRICS"] = "metrics";
    ServiceConfigChannelEnum["AUDIT"] = "audit";
})(ServiceConfigChannelEnum || (exports.ServiceConfigChannelEnum = ServiceConfigChannelEnum = {}));
var ServiceConfigActionEnum;
(function (ServiceConfigActionEnum) {
    ServiceConfigActionEnum["START"] = "start";
    ServiceConfigActionEnum["STOP"] = "stop";
    ServiceConfigActionEnum["PAUSE"] = "pause";
    ServiceConfigActionEnum["CONTINUE"] = "continue";
    ServiceConfigActionEnum["MODIFY"] = "modify";
})(ServiceConfigActionEnum || (exports.ServiceConfigActionEnum = ServiceConfigActionEnum = {}));
var ServiceConfigFlowEnum;
(function (ServiceConfigFlowEnum) {
    ServiceConfigFlowEnum["REQUEST"] = "request";
    ServiceConfigFlowEnum["RESPONSE"] = "response";
})(ServiceConfigFlowEnum || (exports.ServiceConfigFlowEnum = ServiceConfigFlowEnum = {}));
var ServiceConfigViewEnum;
(function (ServiceConfigViewEnum) {
    ServiceConfigViewEnum["NONE"] = "none";
    ServiceConfigViewEnum["CLUSTER"] = "cluster";
    ServiceConfigViewEnum["NAMESPACE"] = "namespace";
    ServiceConfigViewEnum["GROUP"] = "group";
    ServiceConfigViewEnum["POD"] = "pod";
    ServiceConfigViewEnum["CONTAINER"] = "container";
})(ServiceConfigViewEnum || (exports.ServiceConfigViewEnum = ServiceConfigViewEnum = {}));
var ServiceConfigScopeEnum;
(function (ServiceConfigScopeEnum) {
    ServiceConfigScopeEnum["NONE"] = "none";
    // LOG
    ServiceConfigScopeEnum["FILTER"] = "filter";
    ServiceConfigScopeEnum["VIEW"] = "view";
    ServiceConfigScopeEnum["RESTART"] = "restart";
    ServiceConfigScopeEnum["API"] = "api";
    ServiceConfigScopeEnum["CLUSTER"] = "cluster";
    // METRICS
    ServiceConfigScopeEnum["SNAPSHOT"] = "snapshot";
    ServiceConfigScopeEnum["STREAM"] = "stream";
})(ServiceConfigScopeEnum || (exports.ServiceConfigScopeEnum = ServiceConfigScopeEnum = {}));
