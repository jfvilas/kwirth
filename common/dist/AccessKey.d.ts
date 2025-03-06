declare class AccessKey {
    id: string;
    type: string;
    resource: string;
}
declare function accessKeyCreate(type: string, resource: string): AccessKey;
declare function accessKeyBuild(id: string, type: string, resource: string): AccessKey;
declare function accessKeySerialize(accessKey: AccessKey): string;
declare function accessKeyDeserialize(key: string): AccessKey;
declare function parseResource(key: string): ResourceIdentifier;
declare function parseResources(key: string): ResourceIdentifier[];
declare function buildResource(scope: string, namespace: string, groupType: string, groupName: string, pod: string, container: string): string;
interface ResourceIdentifier {
    scope: string;
    namespace: string;
    set: string;
    pod: string;
    container: string;
}
export { accessKeyBuild, accessKeyCreate, accessKeyDeserialize, accessKeySerialize, AccessKey, parseResource, parseResources, ResourceIdentifier, buildResource };
