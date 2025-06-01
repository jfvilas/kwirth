"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InstanceConfigScopeEnum = exports.InstanceConfigViewEnum = exports.InstanceConfigObjectEnum = void 0;
var InstanceConfigObjectEnum;
(function (InstanceConfigObjectEnum) {
    InstanceConfigObjectEnum["PODS"] = "pods";
    InstanceConfigObjectEnum["EVENTS"] = "events";
})(InstanceConfigObjectEnum || (exports.InstanceConfigObjectEnum = InstanceConfigObjectEnum = {}));
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
    InstanceConfigScopeEnum["API"] = "api";
    InstanceConfigScopeEnum["CLUSTER"] = "cluster";
    // LOG
    InstanceConfigScopeEnum["FILTER"] = "filter";
    InstanceConfigScopeEnum["VIEW"] = "view";
    // METRICS
    InstanceConfigScopeEnum["SNAPSHOT"] = "snapshot";
    InstanceConfigScopeEnum["STREAM"] = "stream";
    // ALARM
    InstanceConfigScopeEnum["CREATE"] = "create";
    InstanceConfigScopeEnum["SUBSCRIBE"] = "subscribe";
    // OPS
    InstanceConfigScopeEnum["GET"] = "get";
    InstanceConfigScopeEnum["EXECUTE"] = "execute";
    InstanceConfigScopeEnum["SHELL"] = "shell";
    InstanceConfigScopeEnum["RESTART"] = "restart";
    // TRIVY
    InstanceConfigScopeEnum["WORKLOAD"] = "workload";
    InstanceConfigScopeEnum["KUBERNETES"] = "kubernetes";
})(InstanceConfigScopeEnum || (exports.InstanceConfigScopeEnum = InstanceConfigScopeEnum = {}));
