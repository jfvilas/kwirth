"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EInstanceConfigScope = exports.EInstanceConfigView = exports.EInstanceConfigObject = exports.InstanceConfigScopeEnum = exports.InstanceConfigViewEnum = exports.InstanceConfigObjectEnum = void 0;
// transient
var InstanceConfigObjectEnum;
(function (InstanceConfigObjectEnum) {
    InstanceConfigObjectEnum["PODS"] = "pods";
    InstanceConfigObjectEnum["EVENTS"] = "events";
})(InstanceConfigObjectEnum || (exports.InstanceConfigObjectEnum = InstanceConfigObjectEnum = {}));
// transient
var InstanceConfigViewEnum;
(function (InstanceConfigViewEnum) {
    InstanceConfigViewEnum["NONE"] = "none";
    InstanceConfigViewEnum["CLUSTER"] = "cluster";
    InstanceConfigViewEnum["NAMESPACE"] = "namespace";
    InstanceConfigViewEnum["GROUP"] = "group";
    InstanceConfigViewEnum["POD"] = "pod";
    InstanceConfigViewEnum["CONTAINER"] = "container";
})(InstanceConfigViewEnum || (exports.InstanceConfigViewEnum = InstanceConfigViewEnum = {}));
// transient
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
    InstanceConfigScopeEnum["RESTART"] = "restart";
    // TRIVY
    InstanceConfigScopeEnum["WORKLOAD"] = "workload";
    InstanceConfigScopeEnum["KUBERNETES"] = "kubernetes";
})(InstanceConfigScopeEnum || (exports.InstanceConfigScopeEnum = InstanceConfigScopeEnum = {}));
var EInstanceConfigObject;
(function (EInstanceConfigObject) {
    EInstanceConfigObject["PODS"] = "pods";
    EInstanceConfigObject["EVENTS"] = "events";
})(EInstanceConfigObject || (exports.EInstanceConfigObject = EInstanceConfigObject = {}));
var EInstanceConfigView;
(function (EInstanceConfigView) {
    EInstanceConfigView["NONE"] = "none";
    EInstanceConfigView["CLUSTER"] = "cluster";
    EInstanceConfigView["NAMESPACE"] = "namespace";
    EInstanceConfigView["GROUP"] = "group";
    EInstanceConfigView["POD"] = "pod";
    EInstanceConfigView["CONTAINER"] = "container";
})(EInstanceConfigView || (exports.EInstanceConfigView = EInstanceConfigView = {}));
var EInstanceConfigScope;
(function (EInstanceConfigScope) {
    EInstanceConfigScope["NONE"] = "none";
    EInstanceConfigScope["API"] = "api";
    EInstanceConfigScope["CLUSTER"] = "cluster";
    // LOG
    EInstanceConfigScope["FILTER"] = "filter";
    EInstanceConfigScope["VIEW"] = "view";
    // METRICS
    EInstanceConfigScope["SNAPSHOT"] = "snapshot";
    EInstanceConfigScope["STREAM"] = "stream";
    // ALARM
    EInstanceConfigScope["CREATE"] = "create";
    EInstanceConfigScope["SUBSCRIBE"] = "subscribe";
    // OPS
    EInstanceConfigScope["GET"] = "get";
    EInstanceConfigScope["EXECUTE"] = "execute";
    EInstanceConfigScope["RESTART"] = "restart";
    // TRIVY
    EInstanceConfigScope["WORKLOAD"] = "workload";
    EInstanceConfigScope["KUBERNETES"] = "kubernetes";
})(EInstanceConfigScope || (exports.EInstanceConfigScope = EInstanceConfigScope = {}));
