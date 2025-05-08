import { v4 as uuid } from 'uuid'

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
    public id:string=''
    public type:string='volatile'
    public resources:string=''
}

function accessKeyCreate(type:string, resources:string) : AccessKey {
    let accessKey = new AccessKey()
    accessKey.id = uuid()
    accessKey.type = type
    accessKey.resources = resources
    return accessKey
}

function accessKeyBuild(id:string, type:string, resources:string) : AccessKey {
    let accessKey = new AccessKey()
    accessKey.id = id
    accessKey.type = type
    accessKey.resources = resources
    return accessKey
}

function accessKeySerialize (accessKey:AccessKey) : string {
    return `${accessKey.id}|${accessKey.type}|${accessKey.resources}`
}

function accessKeyDeserialize (key:string) : AccessKey {
    var parts=key.split('|')
    return accessKeyBuild(parts[0], parts[1], parts[2])
}      

function parseResource (key:string) : ResourceIdentifier {
    var parts=key.split(':')
    return {
        scopes:parts[0],
        namespaces:parts[1],
        groups:parts[2],
        pods:parts[3],
        containers:parts[4]
    }
}

function parseResources (key:string) : ResourceIdentifier[] {
    var ress=key.split(';')
    var result:ResourceIdentifier[]=[]
    for (var res of ress) {
        result.push(parseResource(res))
    }
    return result
}

function buildResource (scopes:string[], namespaces:string[], groups:string[], pods:string[], containers:string[]) : string {
    return `${scopes.join(',')}:${namespaces.join(',')}:${groups.join(',')}:${pods.join(',')}:${containers.join(',')}`
}

/*
 
    ResourceIdentifier is composed by:

        scope can a comma-separated list of: cluster, api, view, filter, restart,...
            cluster is the admin level, can do everything
            api can create api keys
            view or filter, can view logs
            restart, can restart pods or deployments
            ...

            for example, a user that can view and restart would have the scope 'view,restart'

        NOTE: group is the type and name of a group: 'replica', 'stateful' or 'daemon', a plus sign ('+'), and the name of the group, example: 'replica+rs1', 'stateful+mongo'

        the rest of fields are comma-separated names according to this rules:
            - it can be a direct name, like: 'mynamespace', 'your-replicaset', 'our-pod'...
            - it can be an '', indicating any resource of the scope is valid
            - it can be a comma-separated list of names, like: namespace 'dev,pre', or pod 'my-pod,our-pod,your-pod'

        full access is created by using cluster scope:
            scope: cluster
            namespace: ''
            group: ''
            pod: ''
            container: ''

        for example, an accessKey that gives access to view logs of namespaces production and staging would be something like
            scope: view
            namespace: 'production,staging'
            group: ''
            pod: ''
            container: ''

        access to restart any pod in 'development' namespace is like this:
            scope: restart
            namespace: 'development'
            group: ''
            pod: ''
            container: ''

        an accessKey that allows viewing logs of pods 'my-pod' and 'your-pod' in the whole cluster would be something like:
            scope: view
            namespace: ''
            group: ''
            pod: 'my-pod,your-pod'
            container: ''      

        In the furture we have plans to treat the names as regex, so, for allowing a requestor to restart any pod of the accounting application in preproduction environment you would use this:
            scope: restart
            namespace: 'preproduction'
            group: ''
            pod: '^account-'
            container: ''      

*/

interface ResourceIdentifier {
    scopes:string,
    namespaces:string,
    groups:string,
    pods:string,
    containers:string
}

export { accessKeyBuild, accessKeyCreate, accessKeyDeserialize, accessKeySerialize, AccessKey, parseResource, parseResources, ResourceIdentifier, buildResource }