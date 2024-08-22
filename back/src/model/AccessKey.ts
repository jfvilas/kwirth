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

        scope: one of: cluster(6), namespace(5), set(4), pod(3), container(2), filter(1) 
        setType is the type of set: replica, stateful or daemon      
        The rest of fields are names according to this rules:
            - it can be a direct name, like: 'mynamespace', 'your-replica-set', 'our-pod'...
            - it can be an '', indicating any resource of the scope is valid
            - it can be an array of names, like: namespace ['dev','pre'], or pod ['my-pod','our-pod','your-pod']

        Full access is created by using cluster scope:
            scope: cluster
            namespace: ''
            set: ''
            pod: ''
            container: ''

        For example, an accessKey that gives access to namespaces production and staging would be something like
            scope: namespace
            namespace: ['production','staging']
            set: ''
            pod: ''
            container: ''

        Access to just 'default' namespace is like this (remember, '' means no limits, defualt namespace must be specified):
            scope: namespace
            namespace: 'default'
            set: ''
            pod: ''
            container: ''

        An accessKey that gives access to pod 'my-pod' in the whole cluster would be something like:
            scope: pod
            namespace: namespace1
            set: set1
            pod: my-pod
            container: ''
        
        If you want to restrict access to 'dev' and 'pre' namespaces for a specific pod (my-pod'), you should use 'filter' scope, and create a ResourceIdentifier like this:
            scope: filter
            namespace: ['dev','pre']
            set: ''
            pod: my-pod
            container: ''

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