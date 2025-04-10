"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildResource = exports.parseResources = exports.parseResource = exports.AccessKey = exports.accessKeySerialize = exports.accessKeyDeserialize = exports.accessKeyCreate = exports.accessKeyBuild = void 0;
const guid_1 = __importDefault(require("guid"));
/*
    Access key format is:

        id|type|resource
    
    where:
        id: is a GUID
        type: is 'volatile', 'permanent' (it is persisted when created)  or 'bearer:....'
            in case of a bearer accessKey, the type contains the expire for the key, that is, for example:
               bearer:
        resource: is a stringified ResourceIdentifier
*/
class AccessKey {
    constructor() {
        this.id = '';
        this.type = 'volatile';
        this.resource = '';
    }
}
exports.AccessKey = AccessKey;
function accessKeyCreate(type, resource) {
    var accessKey = new AccessKey();
    accessKey.id = guid_1.default.create().toString();
    accessKey.type = type;
    accessKey.resource = resource;
    return accessKey;
}
exports.accessKeyCreate = accessKeyCreate;
function accessKeyBuild(id, type, resource) {
    var accessKey = new AccessKey();
    accessKey.id = id;
    accessKey.type = type;
    accessKey.resource = resource;
    return accessKey;
}
exports.accessKeyBuild = accessKeyBuild;
function accessKeySerialize(accessKey) {
    return `${accessKey.id}|${accessKey.type}|${accessKey.resource}`;
}
exports.accessKeySerialize = accessKeySerialize;
function accessKeyDeserialize(key) {
    var parts = key.split('|');
    return accessKeyBuild(parts[0], parts[1], parts[2]);
}
exports.accessKeyDeserialize = accessKeyDeserialize;
function parseResource(key) {
    var parts = key.split(':');
    return {
        scope: parts[0],
        namespace: parts[1],
        set: parts[2],
        pod: parts[3],
        container: parts[4]
    };
}
exports.parseResource = parseResource;
function parseResources(key) {
    var ress = key.split(',');
    var result = [];
    for (var res of ress) {
        result.push(parseResource(res));
    }
    return result;
}
exports.parseResources = parseResources;
function buildResource(scope, namespace, groupType, groupName, pod, container) {
    return `${scope}:${namespace}:${groupType}+${groupName}:${pod}:${container}`;
}
exports.buildResource = buildResource;
