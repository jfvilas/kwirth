import { BatchV1Api, CoreV1Api, NetworkingV1Api, V1Eviction, V1Job } from '@kubernetes/client-node'
import { ClusterInfo } from '../model/ClusterInfo'
//const fs = require('fs')
const yaml = require('js-yaml')

async function applyResource(resource:any, clusterInfo:ClusterInfo) : Promise<string> {
    try {
        // const namespace = (resource.metadata && resource.metadata.namespace) || 'default'
        // const name = resource.metadata.name
        const kind = resource.kind

        if (resource.metadata.managedFields) delete resource['metadata']['managedFields']
        await clusterInfo.objectsApi.patch(resource, undefined, undefined, 'kwirth', true, 'application/apply-patch+yaml')
        return `${kind} '${resource.metadata.name}' applied successfully.`
    }
    catch (err:any) {
        console.log('Error applying:*********************')
        console.log(err)
        return 'Error applying: '+err
    }
}

async function applyAllResources(yamlContent:string, clusterInfo:ClusterInfo) {
    //+++ test this with apply without splitting source
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

async function deleteAllResources(yamlContent: string, clusterInfo:ClusterInfo) {
    const yaml = require('js-yaml')

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

async function nodeSetSchedulable(coreApi: CoreV1Api, nodeName: string, unschedulable: boolean): Promise<void> {
    const patch = [
        {
            op: "replace",
            path: "/spec/unschedulable",
            value: unschedulable
        }
    ]
    try {
        await coreApi.patchNode({
            name: nodeName,
            body: patch
        })
        console.log(`Node ${nodeName}: unschedulable = ${unschedulable}`);
    }
    catch (err: any) {
        console.error(`Error in patchNode: ${err.body?.message || err.message}`)
        throw err
    }
}

async function nodeCordon(coreApi: CoreV1Api, nodeName: string): Promise<void> {
    await nodeSetSchedulable(coreApi, nodeName, true)
}

async function nodeUnCordon(coreApi: CoreV1Api, nodeName: string): Promise<void> {
    await nodeSetSchedulable(coreApi, nodeName, false)
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

async function throttleExcute(invoke:any): Promise<void> {
    let repeat = true
    while (repeat) {
        repeat = false
        try {
            invoke()
        }
        catch (err:any) {
            if (err.code === 429) {
                repeat = true
                await new Promise ( (resolve) => { setTimeout(resolve, (+err.headers['retry-after']||1)*1000)})
            }
            else {
                throw (err)
            }
        }
    }
}

async function cronJobTrigger (namespace: string, cronJobName: string, batchApi: BatchV1Api): Promise<void> {
        try {
            // 1. Obtener el CronJob original
            const cronJob = await batchApi.readNamespacedCronJob({
                name: cronJobName,
                namespace: namespace
            })

            if (!cronJob.spec?.jobTemplate) {
                throw new Error("El CronJob no tiene un jobTemplate definido.");
            }

            // 2. Definir el Job manual
            const manualJobName = `${cronJobName}-manual-${Math.floor(Date.now() / 1000)}`;
            const jobManifest: V1Job = {
                metadata: {
                    name: manualJobName,
                    labels: { 'triggered-by': 'node-client' }
                },
                spec: cronJob.spec.jobTemplate.spec
            };

            // 3. Crear el Job
            await batchApi.createNamespacedJob({
                namespace: namespace,
                body: jobManifest
            })

            console.log(`✅ Job manual creado con éxito: ${manualJobName}`);
        } 
        catch (err: any) {
            console.error('❌ Error al disparar el CronJob:', err.response?.body?.message || err.message);
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

export { applyResource, applyAllResources, deleteAllResources, nodeDrain, nodeCordon, nodeUnCordon, throttleExcute, cronJobStatus, cronJobTrigger, podEvict, setIngressClassAsDefault }