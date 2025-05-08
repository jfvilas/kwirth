declare class AccessKey {
    id: string;
    type: string;
    resources: string;
}
declare function accessKeyCreate(type: string, resources: string): AccessKey;
declare function accessKeyBuild(id: string, type: string, resources: string): AccessKey;
declare function accessKeySerialize(accessKey: AccessKey): string;
declare function accessKeyDeserialize(key: string): AccessKey;
declare function parseResource(key: string): ResourceIdentifier;
declare function parseResources(key: string): ResourceIdentifier[];
declare function buildResource(scopes: string[], namespaces: string[], groups: string[], pods: string[], containers: string[]): string;
interface ResourceIdentifier {
    scopes: string;
    namespaces: string;
    groups: string;
    pods: string;
    containers: string;
}
export { accessKeyBuild, accessKeyCreate, accessKeyDeserialize, accessKeySerialize, AccessKey, parseResource, parseResources, ResourceIdentifier, buildResource };
