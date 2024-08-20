import Guid from 'guid';

/*
    Access key format is:

        id|type|resource
    
    where:
        id: is a GUID
        type: is volatile' or 'permanent' (the second type is persisted when created)
        resource: is a stringified ResourceIdentifier
*/
class AccessKey {
    public id:string='';
    public type:string='volatile';
    public resource:string='';
}

function accessKeyCreate(type:string, resource:string) : AccessKey {
    var accessKey=new AccessKey();
    accessKey.id=Guid.create().toString();
    accessKey.type=type;
    accessKey.resource=resource;
    return accessKey;
}

function accessKeyBuild(id:string, type:string, resource:string) : AccessKey {
    var accessKey=new AccessKey();
    accessKey.id=id;
    accessKey.type=type;
    accessKey.resource=resource;
    return accessKey;
}

function accessKeySerialize (accessKey:AccessKey) : string {
    return `${accessKey.id}|${accessKey.type}|${accessKey.resource}`;
}

function accessKeyDeserialize (key:string) : AccessKey {
    var parts=key.split('|');
    return accessKeyBuild(parts[0], parts[1], parts[2]);
}      

function parseResource (key:string) : ResourceIdentifier {
    var parts=key.split(':');
    return {
        scope:parts[0],
        namespace:parts[1],
        set:parts[2],
        pod:parts[3],
        container:parts[4]
    }
}

function buildResource (scope:string, namespace:string, setType:string, setName:string, pod:string, container:string) : string {
    return `${scope}:${namespace}:${setType}+${setName}:${pod}:${container}`;
}

/*
    ResourceIdentifier is composed by:

        scope: one of: cluster(5), namespace(4), set(3), pod(2), container(1)
        setType is the type of set: replica, stateful or daemon      
        The rest of fields are names according to this rules:
            - it can be a direct name, like: 'mynamespace', 'your-replica-set', 'our-pod'...
            - it can be an '*' (without the apostrophe or ''), indicating any resource of the scope is valid
            - it can be an array of names, like: namespace ['dev','pre'], or pod ['my-pod','our-pod','your-pod']

        For example, an accessKey that gives access to namespaces production and staging would be something like

            scope: namespace
            namespace: ['production','staging']
            set: *
            pod: *
            container: *

        An accessKey that gives access to pod 'my-pod' in the whole cluster would be something like:
            scope: pod
            namespace: *
            set: *
            pod: my-pod
            container: *
        
        If you want to restrict access to 'dev' and 'pre' namespaces, you should modify previous ResourceIdentifier this way:
            scope: pod
            namespace: ['dev','pre']
            set: *
            pod: my-pod
            container: *

            That is, 'scope' keeps being 'pod', but we restrict namespace.
*/

interface ResourceIdentifier {
    scope:string,
    namespace:string,
    set:string,
    pod:string,
    container:string
}

export { accessKeyBuild, accessKeyCreate, accessKeyDeserialize, accessKeySerialize, AccessKey, parseResource, ResourceIdentifier, buildResource };