import Guid from 'guid'

/*
    Access key format is:

        id|type|resource
    
    where:
        id: is a GUID
        type: is volatile' or 'permanent' (the second type is persisted when created)
        resource: is a stringified ResourceIdentifier
*/
class AccessKey {
    public id:string=''
    public type:string='volatile'
    public resource:string=''
}

function accessKeyCreate(type:string, resource:string) : AccessKey {
    var accessKey=new AccessKey()
    accessKey.id=Guid.create().toString()
    accessKey.type=type
    accessKey.resource=resource
    return accessKey
}

function accessKeyBuild(id:string, type:string, resource:string) : AccessKey {
    var accessKey=new AccessKey()
    accessKey.id=id
    accessKey.type=type
    accessKey.resource=resource
    return accessKey
}

function accessKeySerialize (accessKey:AccessKey) : string {
    return `${accessKey.id}|${accessKey.type}|${accessKey.resource}`
}

function accessKeyDeserialize (key:string) : AccessKey {
    var parts=key.split('|')
    return accessKeyBuild(parts[0], parts[1], parts[2])
}      

function parseResource (key:string) : ResourceIdentifier {
    var parts=key.split(':')
    return {
        scope:parts[0],
        namespace:parts[1],
        set:parts[2],
        pod:parts[3],
        container:parts[4]
    }
}

function parseResources (key:string) : ResourceIdentifier[] {
    var ress=key.split(',')
    var result:ResourceIdentifier[]=[]
    for (var res of ress) {
        result.push(parseResource(res))
    }
    return result
}

function buildResource (scope:string, namespace:string, groupType:string, groupName:string, pod:string, container:string) : string {
    return `${scope}:${namespace}:${groupType}+${groupName}:${pod}:${container}`
}

/*
    +++ review all this info, it is not fresh
    
    ResourceIdentifier is composed by:

        scope can a comma-separated list of: cluster, api, view|filter, restart
            cluster is the admin level, can do everything
            api can create api keys
            view or filter, can view logs
            restart, can restart pods or deployments

            for example, a user that can view and restart would have the scope 'view,restart'

        NOTE: group is the type and name of a group: 'replica', 'stateful' or 'daemon', a plus sign ('+'), and the name of the group, example: 'replica+rs1', 'stateful+mongo'

        the rest of fields are names (regex in fact) according to this rules:
            - it can be a direct name, like: 'mynamespace', 'your-replicaset', 'our-pod'...
            - it can be an '', indicating any resource of the scope is valid
            - it can be a comma-separated list of names, like: namespace 'dev,pre', or pod 'my-pod,our-pod,your-pod'

        full access is created by using cluster scope:
            scope: cluster
            namespace: ''
            set: ''
            pod: ''
            container: ''

        for example, an accessKey that gives access to view logs of namespaces production and staging would be something like
            scope: view
            namespace: ['production','staging']
            set: ''
            pod: ''
            container: ''

        access to restart any pod in 'development' namespace is like this:
            scope: restart
            namespace: 'development'
            set: ''
            pod: ''
            container: ''

        an accessKey that allows viewing logs of pod 'my-pod' in the whole cluster would be something like:
            scope: view
            namespace: ''
            set: ''
            pod: my-pod
            container: ''      

        the names are infact regex, so you, for allowing a requestor to restart any pod of the accounting application in preproduction environment you would use this:
            scope: restart
            namespace: 'preproduction'
            set: ''
            pod: '^account-'
            container: ''      

*/

interface ResourceIdentifier {
    scope:string,
    namespace:string,
    set:string,
    pod:string,
    container:string
}

export { accessKeyBuild, accessKeyCreate, accessKeyDeserialize, accessKeySerialize, AccessKey, parseResource, parseResources, ResourceIdentifier, buildResource }