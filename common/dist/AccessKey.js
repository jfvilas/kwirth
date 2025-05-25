"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildResource = exports.parseResources = exports.parseResource = exports.AccessKey = exports.accessKeySerialize = exports.accessKeyDeserialize = exports.accessKeyCreate = exports.accessKeyBuild = void 0;
const uuid_1 = require("uuid");
/*
    Access key format is:

        id|type|resource
    
    where:
        id: is a UUID
        type: is 'volatile', 'permanent' (it is persisted when created)  or 'bearer:....'
            in case of a bearer accessKey, the type contains the expire for the key, that is, for example:
               bearer:
        resource: is a stringified ResourceIdentifier
*/
class AccessKey {
    constructor() {
        this.id = '';
        this.type = 'volatile';
        this.resources = '';
    }
}
exports.AccessKey = AccessKey;
function accessKeyCreate(type, resources) {
    let accessKey = new AccessKey();
    accessKey.id = (0, uuid_1.v4)();
    accessKey.type = type;
    accessKey.resources = resources;
    return accessKey;
}
exports.accessKeyCreate = accessKeyCreate;
function accessKeyBuild(id, type, resources) {
    let accessKey = new AccessKey();
    accessKey.id = id;
    accessKey.type = type;
    accessKey.resources = resources;
    return accessKey;
}
exports.accessKeyBuild = accessKeyBuild;
function accessKeySerialize(accessKey) {
    return `${accessKey.id}|${accessKey.type}|${accessKey.resources}`;
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
        scopes: parts[0],
        namespaces: parts[1],
        groups: parts[2],
        pods: parts[3],
        containers: parts[4]
    };
}
exports.parseResource = parseResource;
function parseResources(key) {
    if (!key)
        return [];
    let ress = key.split(';');
    let result = [];
    for (var res of ress) {
        result.push(parseResource(res));
    }
    return result;
}
exports.parseResources = parseResources;
function buildResource(scopes, namespaces, groups, pods, containers) {
    return `${scopes.join(',')}:${namespaces.join(',')}:${groups.join(',')}:${pods.join(',')}:${containers.join(',')}`;
}
exports.buildResource = buildResource;
