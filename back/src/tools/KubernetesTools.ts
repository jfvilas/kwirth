import { BatchV1Api, CoreV1Api, NetworkingV1Api, V1Eviction, V1Job } from '@kubernetes/client-node'
import { ClusterInfo } from '../model/ClusterInfo'
const yaml = require('js-yaml')

async function getSelector(kind:string, namespace:string, name:string, clusterInfo:ClusterInfo) {
    try {
        switch(kind) {
            case 'Deployment': {
                    const res = await clusterInfo.appsApi.readNamespacedDeployment({name, namespace});
                    if (res.spec) return res.spec.selector.matchLabels;
                }
                break
            case 'ReplicaSet': {
                    const res = await clusterInfo.appsApi.readNamespacedReplicaSet({name, namespace})
                    if (res.spec) return res.spec.selector.matchLabels;
                }
                break
            case 'DaemonSet': {
                    const res = await clusterInfo.appsApi.readNamespacedDaemonSet({name, namespace});
                    if (res.spec) return res.spec.selector.matchLabels;
                }
                break
            case 'StatefulSet': {
                    const res = await clusterInfo.appsApi.readNamespacedStatefulSet({name, namespace});
                    if (res.spec) return res.spec.selector.matchLabels;
                }
                break
            case 'ReplicationController': {
                    const res = await clusterInfo.coreApi.readNamespacedReplicationController({name, namespace})
                    if (res.spec) return res.spec.selector; // RC usa .spec.selector directamente, no matchLabels
                }
                break
            case 'Job': {
                    const res = await clusterInfo.batchApi.readNamespacedJob({name, namespace})
                    if (res.spec && res.spec.selector) return res.spec.selector.matchLabels
                }
                break
        }
    }
    catch (err) {
        console.log('error getting info for restart', err)
        return undefined
    }
}

async function restartController (kind:string, namespace:string, name:string, clusterInfo:ClusterInfo) {
    try {
        const labels = await getSelector(kind, namespace, name, clusterInfo)
        if (labels) {
            const labelSelector = Object.entries(labels).map(([k, v]) => `${k}=${v}`).join(',');
            console.log(`Found selector: ${labelSelector}. Restrating pods...`);
            const pods = await clusterInfo.coreApi.listNamespacedPod({namespace, labelSelector})
            for (const pod of pods.items) {
                if (pod.metadata && pod.metadata.name) {
                    await clusterInfo.coreApi.deleteNamespacedPod({name:pod.metadata.name, namespace})
                    console.log(`Pod ${pod.metadata.name} deleted.`);
                }
            }
        }
    }
    catch (err) {
        console.log('Error restaring deployment', err)
    }
}

async function scaleController(kind:string, namespace:string, name:string, replicas:number, clusterInfo:ClusterInfo) {    
    try {
        const patch = [
            {
                op: "replace",
                path: "/spec/replicas",
                value: replicas
            }
        ]

        switch (kind) {
            case 'Deployment':
                await clusterInfo.appsApi.patchNamespacedDeployment({name, namespace, body: patch})
                break;
            case 'StatefulSet':
                await clusterInfo.appsApi.patchNamespacedStatefulSet({name, namespace, body: patch})
                break;
            case 'ReplicaSet':
                await clusterInfo.appsApi.patchNamespacedReplicaSet({name, namespace, body: patch})
                break;
            case 'ReplicationController':
                await clusterInfo.coreApi.patchNamespacedReplicationController({name, namespace, body:patch})
                break;
            default:
                break
        }
        console.log(`${kind} ${name} scaled to ${replicas}`)
    }
    catch (err) {
        console.error('Error scaling:', err)
    }
}

async function applyResource(resource:any, clusterInfo:ClusterInfo) : Promise<string> {
    try {
        const kind = resource.kind

        if (resource.metadata.managedFields) delete resource['metadata']['managedFields']
        await clusterInfo.objectsApi.patch(resource, undefined, undefined, 'kwirth', true, 'application/apply-patch+yaml')
        return `${kind} '${resource.metadata.name}' applied successfully.`
    }
    catch (err:any) {
        console.log('Error applying')
        console.log(err)
        return 'Error applying: '+err
    }
}

async function applyAllResources(yamlContent:string, clusterInfo:ClusterInfo): Promise<void> {
    //+++ test this with apply without splitting source
    try {
        const resources:any[] = []

        yaml.loadAll(yamlContent, (doc: any) => {
            resources.push(doc)
        })

        for (const resource of resources) {
            try {
                let result = await applyResource(resource, clusterInfo)
                if (result!=='') console.error(result)
            }
            catch (err) {
                console.log('Error applying resource:', err)
                break
            }
        }
    }
    catch (err) {
        console.log('Error applyig all resources')
        console.log(err)
    }
}

async function deleteAllResources(yamlContent: string, clusterInfo:ClusterInfo) : Promise<void> {
    try {
        const resources:any[] = []
        yaml.loadAll(yamlContent, (doc: any) => {
            resources.push(doc)
        })

        async function deleteResource(resource: any) {
            const kind = resource.kind
            const namespace = resource.metadata && resource.metadata.namespace

            switch (kind) {
                case 'Namespace':
                    console.log(`Removing Namespace: ${resource.metadata.name}`)
                    await clusterInfo.coreApi.deleteNamespace(resource.metadata.name)
                    break

                case 'ConfigMap':
                    console.log(`Removing ConfigMap: ${resource.metadata.name}`)
                    await clusterInfo.coreApi.deleteNamespacedConfigMap(resource.metadata.name, namespace)
                    break

                case 'Secret':
                    console.log(`Removing Secret: ${resource.metadata.name}`)
                    await clusterInfo.coreApi.deleteNamespacedSecret(resource.metadata.name, namespace)
                    break

                case 'CustomResourceDefinition':
                    console.log(`Removing CRD: ${resource.metadata.name}`)
                    await clusterInfo.extensionApi.deleteCustomResourceDefinition(resource.metadata.name)
                    break

                case 'Deployment':
                    console.log(`Removing Deployment: ${resource.metadata.name}`)
                    await clusterInfo.appsApi.deleteNamespacedDeployment(resource.metadata.name, namespace)
                    break

                case 'Service':
                    console.log(`Removing Service: ${resource.metadata.name}`)
                    await clusterInfo.coreApi.deleteNamespacedService(resource.metadata.name, namespace)
                    break

                case 'ClusterRole':
                    console.log(`Removing ClusterRole: ${resource.metadata.name}`)
                    await clusterInfo.rbacApi.deleteClusterRole(resource.metadata.name)
                    break

                case 'ClusterRoleBinding':
                    console.log(`Removing ClusterRoleBinding: ${resource.metadata.name}`)
                    await clusterInfo.rbacApi.deleteClusterRoleBinding(resource.metadata.name)
                    break

                case 'RoleBinding':
                    console.log(`Removing RoleBinding: ${resource.metadata.name}`)
                    await clusterInfo.rbacApi.deleteNamespacedRoleBinding(resource.metadata.name, namespace)
                    break

                case 'ServiceAccount':
                    console.log(`Removing ServiceAccount: ${resource.metadata.name}`)
                    await clusterInfo.coreApi.deleteNamespacedServiceAccount(resource.metadata.name, namespace)
                    break

                default:
                    console.log(`Resource ${kind} not implementaded.`)
                    break
            }
            console.log(`${kind} succcessfully removed.`)
        }

        for (const resource of resources) {
            try {
                await deleteResource(resource)
            }
            catch (err) {
                console.log('Error removing resource:', err)
                break
            }
        }
    }
    catch (err) {
        console.log('Error deleting resource')
        console.log(err)
    }
}

async function nodeSetSchedulable(coreApi: CoreV1Api, nodeName: string, unschedulable: boolean): Promise<void> {
    try {
        const patch = [
            {
                op: "replace",
                path: "/spec/unschedulable",
                value: unschedulable
            }
        ]
        await coreApi.patchNode({
            name: nodeName,
            body: patch
        })
        console.log(`Node ${nodeName}: unschedulable = ${unschedulable}`);
    }
    catch (err: any) {
        console.error(`Error in patchNode: ${err.body?.message || err.message}`)
    }
}

async function nodeCordon(coreApi: CoreV1Api, nodeName: string): Promise<void> {
    try {
        await nodeSetSchedulable(coreApi, nodeName, true)
    }
    catch (err) {
        console.log('Error in cordon')
        console.log(err)
    }
}

async function nodeUnCordon(coreApi: CoreV1Api, nodeName: string): Promise<void> {
    try {
    await nodeSetSchedulable(coreApi, nodeName, false)
    }
    catch (err) {
        console.log('Error in uncordon')
        console.log(err)
    }
}

async function nodeDrain(coreApi: CoreV1Api, nodeName: string): Promise<void> {
    try {
        await nodeSetSchedulable(coreApi, nodeName, true);

        let result = await coreApi.listPodForAllNamespaces({ fieldSelector: `spec.nodeName=${nodeName}` })

        const evictionPromises = result.items.map(async (pod) => {
            const name = pod.metadata?.name
            const namespace = pod.metadata?.namespace

            if (!name || !namespace) return

            // omissions
            const isDaemonSet = pod.metadata?.ownerReferences?.some( ref => ref.kind === 'DaemonSet' )
            const isStaticPod = pod.metadata?.annotations?.['kubernetes.io/config.mirror']
            
            if (isDaemonSet || isStaticPod) {
                console.log(`Omit system pod: ${name}`)
                return
            }
            await podEvict(coreApi, namespace, name)
        })

        await Promise.all(evictionPromises)
        console.log(`Drain completed for node ${nodeName}`)

    }
    catch (err: any) {
        console.error(`Error draininig node ${nodeName}: ${err.message}`)
    }
}

async function throttleExcute(id:string, invoke:any): Promise<boolean> {
    let repeat = true
    let retry = 3
    while (repeat) {
        repeat = false
        try {
            await invoke()
            return true
        }
        catch (err:any) {
            console.log('Throttling error on',id)
            if (err.code === 429) {
                repeat = true
                await new Promise ( (resolve) => { setTimeout(resolve, (+err.headers['retry-after']||1)*1000)})
            }
            else {
                // unknown error just retry
                retry--
                console.log('Error when throttling', id, err)
                if (retry>0) await new Promise ( (resolve) => { setTimeout(resolve, 3000)})
                return false
            }
        }
    }
    console.log('Unexpected error when throttling', id)
    return false
}

async function cronJobTrigger (namespace: string, cronJobName: string, batchApi: BatchV1Api): Promise<void> {
    try {
        const cronJob = await batchApi.readNamespacedCronJob({
            name: cronJobName,
            namespace: namespace
        })

        if (!cronJob.spec?.jobTemplate) {
            throw new Error("El CronJob no tiene un jobTemplate definido.");
        }

        const manualJobName = `${cronJobName}-manual-${Math.floor(Date.now() / 1000)}`;
        const jobManifest: V1Job = {
            metadata: {
                name: manualJobName,
                labels: { 'triggered-by': 'node-client' }
            },
            spec: cronJob.spec.jobTemplate.spec
        };

        await batchApi.createNamespacedJob({
            namespace: namespace,
            body: jobManifest
        })

        console.log(`✅ Manual Job created: ${manualJobName}`);
    } 
    catch (err: any) {
        console.error('❌ Error launching CronJob:', err.response?.body?.message || err.message);
    }
}    

async function cronJobStatus(namespace: string, cronJobName: string, suspend: boolean, batchApi: BatchV1Api): Promise<void> {
    try {
        const patch = [
            {
                op: "replace",
                path: "/spec/suspend",
                value: suspend
            }
        ]
        await batchApi.patchNamespacedCronJob({
            name: cronJobName,
            namespace,
            body: patch
        })

        console.log(`✅ CronJob "${cronJobName}" ${suspend ? 'suspended' : 'activated'} succesfully.`);
    }
    catch (err: any) {
        console.error('❌ Error patching CronJob:', err.response?.body?.message || err.message);
    }
}

async function podEvict (coreApi: CoreV1Api, namespace: string, name:string): Promise<void> {
    const body: V1Eviction = {
        apiVersion: 'policy/v1',
        kind: 'Eviction',
        metadata: {
            name: name,
            namespace: namespace,
        }
    }

    try {
        await coreApi.createNamespacedPodEviction({name, namespace, body })
        console.log(`Eviction succesful for ${name}`);
    }
    catch (err: any) {
        console.error('Error evicting:', err.response?.body?.message || err.message);
    }
}

async function setIngressClassAsDefault (networkApi: NetworkingV1Api, name:string) {
    const patch = {
        op: 'replace',
        path: '/metadata/annotations',
        value: {
            'ingressclass.kubernetes.io/is-default-class': 'true'
        }
    }
    try {
        await networkApi.patchIngressClass({ name: name, body: [patch]})
        console.log(`✅ IngressClass "${name}" set as default.`)
    }
    catch (err) {
        console.error('Error al pathing igress class IngressClass:', err)
    }        
}

export { applyResource, applyAllResources, deleteAllResources, nodeDrain, nodeCordon, nodeUnCordon, throttleExcute, cronJobStatus, cronJobTrigger, podEvict, setIngressClassAsDefault, restartController, scaleController }