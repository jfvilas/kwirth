"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.accessKeyDeserialize = exports.accessKeySerialize = exports.accessKeyBuild = exports.accessKeyCreate = exports.AccessKey = void 0;
const guid_1 = __importDefault(require("guid"));
/*
    Access key format is:

        id|type|resource
    
    where:
        id: is a GUID
        type: is volatile' or 'permanent' (the second type is persisted when created)
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
