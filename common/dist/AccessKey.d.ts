export declare class AccessKey {
    id: string;
    type: string;
    resource: string;
}
export declare function accessKeyCreate(type: string, resource: string): AccessKey;
export declare function accessKeyBuild(id: string, type: string, resource: string): AccessKey;
export declare function accessKeySerialize(accessKey: AccessKey): string;
export declare function accessKeyDeserialize(key: string): AccessKey;
