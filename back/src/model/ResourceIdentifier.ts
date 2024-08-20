/*
    ResourceIdentifier is composed by:

        scope: one of: cluster(5), namespace(4), set(3), pod(2), container(1)
        setType is the type of set: replica, stateful or daemon      
        The rest of fields are names according to this rules:
            - it can be a direct name, like: 'mynamespace', 'your-replica-set', 'our-pod'...
            - it can be an '*' (without the apostrophe), indicating any resource of the scope is valid
            - it can be an array of names, like: namespace ['dev','pre'], or pod ['my-pod','our-pod','your-pod']

        For example, an accessKey that gives access to namespaces production and staging would be something like

            scope: namespace
            namespace: ['production','staging']
            setType: *
            pod: *
            container: *

        An accessKey that gives access to pod 'my-pod' in the whole cluster would be something like:
            scope: pod
            namespace: *
            setType: *
            pod: my-pod
            container: *
        
        If you want to restrict access to 'dev' and 'pre' namespaces, you should modify previous ResourceIdentifier this way:
            scope: pod
            namespace: ['dev','pre']
            setType: *
            pod: my-pod
            container: *

            That is, 'scope' keeps being 'pod', but we restrict namespace.
*/

export interface ResourceIdentifier {
    scope:string,
    namespace:string,
    setType:string,
    setName:string,
    pod:string,
    container:string
}