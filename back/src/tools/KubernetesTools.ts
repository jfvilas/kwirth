import { AppsV1ApiPatchNamespacedDaemonSetRequest, AppsV1ApiPatchNamespacedDeploymentRequest, AppsV1ApiPatchNamespacedReplicaSetRequest, AppsV1ApiPatchNamespacedStatefulSetRequest, CoreV1Api, CoreV1ApiListPodForAllNamespacesRequest, CoreV1ApiPatchNamespacedConfigMapRequest, CoreV1ApiPatchNamespacedSecretRequest, CoreV1ApiPatchNamespacedServiceRequest, V1Eviction } from '@kubernetes/client-node'
import { ClusterInfo } from '../model/ClusterInfo'
const fs = require('fs')
const yaml = require('js-yaml')

async function applyResource(resource:any, clusterInfo:ClusterInfo) : Promise<string> {
    try {
        const namespace = (resource.metadata && resource.metadata.namespace) || 'default'
        const name = resource.metadata.name
        const kind = resource.kind
        console.log('Apply*********************************')
        console.log(name, namespace, kind)
        console.log('Apply*********************************')

        if (resource.metadata.managedFields) delete resource['metadata']['managedFields']

        switch (kind) {
            case 'Namespace':
                console.log(`Applying Namespace: ${resource.metadata.name}`)
                await clusterInfo.coreApi.createNamespace(resource)
                break

            case 'ConfigMap':
                console.log(`Applying ConfigMap: ${resource.metadata.name}`)
                let paramConfigMap: CoreV1ApiPatchNamespacedConfigMapRequest = {
                    name: name,
                    namespace: namespace,
                    body: resource,
                    fieldManager:'kwirth',
                    fieldValidation: 'Ignore',
                    force: true
                }
                await clusterInfo.coreApi.patchNamespacedConfigMap(paramConfigMap)
                break

            case 'Secret':
                console.log(`Applying Secret: ${resource.metadata.name}`)
                let paramSecret:CoreV1ApiPatchNamespacedSecretRequest = {
                    name: name,
                    namespace: namespace,
                    body: resource,
                    fieldManager:'kwirth',
                    fieldValidation: 'Ignore',
                    force: true
                }
                await clusterInfo.coreApi.patchNamespacedSecret(paramSecret)
                break

            case 'CustomResourceDefinition':
                console.log(`Applying CRD: ${resource.metadata.name}`)
                await clusterInfo.extensionApi.createCustomResourceDefinition(resource)
                break

            case 'Deployment':
                console.log(`Applying Deployment: ${resource.metadata.name}`)
                let paramDeployent:AppsV1ApiPatchNamespacedDeploymentRequest={
                    name: name,
                    namespace: namespace,
                    body: resource,
                    fieldManager:'kwirth',
                    fieldValidation: 'Ignore',
                    force: true
                }
                await clusterInfo.appsApi.patchNamespacedDeployment(paramDeployent)
                break

            case 'StatefulSet':
                console.log(`Applying StatefulSet: ${resource.metadata.name}`)
                let paramStatefulSet:AppsV1ApiPatchNamespacedStatefulSetRequest = {
                    name: name,
                    namespace: namespace,
                    body: resource,
                    fieldManager:'kwirth',
                    fieldValidation: 'Ignore',
                    force: true
                }
                await clusterInfo.appsApi.patchNamespacedStatefulSet(paramStatefulSet)
                break

            case 'DaemonSet':
                console.log(`Applying DaemonSet: ${resource.metadata.name}`)
                let paramDaemonSet:AppsV1ApiPatchNamespacedDaemonSetRequest = {
                    name: name,
                    namespace: namespace,
                    body: resource,
                    fieldManager:'kwirth',
                    fieldValidation: 'Ignore',
                    force: true
                }
                await clusterInfo.appsApi.patchNamespacedDaemonSet(paramDaemonSet)
                break

            case 'ReplicaSet':
                console.log(`Applying ReplicaSet: ${resource.metadata.name}`)
                let paramReplicaSet:AppsV1ApiPatchNamespacedReplicaSetRequest = {
                    name: name,
                    namespace: namespace,
                    body: resource,
                    fieldManager:'kwirth',
                    fieldValidation: 'Ignore',
                    force: true
                }
                await clusterInfo.appsApi.patchNamespacedReplicaSet(paramReplicaSet)
                break

            case 'Service':
                console.log(`Applying Service: ${resource.metadata.name}`)
                let paramService:CoreV1ApiPatchNamespacedServiceRequest = {
                    name: name,
                    namespace: namespace,
                    body: resource,
                    fieldManager:'kwirth',
                    fieldValidation: 'Ignore',
                    force: true
                }
                await clusterInfo.coreApi.patchNamespacedService(paramService)
                break

            case 'ClusterRole':
                console.log(`Applying ClusterRole: ${resource.metadata.name}`)
                await clusterInfo.rbacApi.createClusterRole(resource)
                break

            case 'ClusterRoleBinding':
                console.log(`Applying ClusterRoleBinding: ${resource.metadata.name}`)
                await clusterInfo.rbacApi.createClusterRoleBinding(resource)
                break

            case 'Role':
                console.log(`Applying Role: ${resource.metadata.name}`)
                await clusterInfo.rbacApi.createNamespacedRole(namespace, resource)
                break

            case 'RoleBinding':
                console.log(`Applying RoleBinding: ${resource.metadata.name}`)
                await clusterInfo.rbacApi.createNamespacedRoleBinding(namespace, resource)
                break

            case 'ServiceAccount':
                console.log(`Applying ServiceAccount: ${resource.metadata.name}`)
                await clusterInfo.coreApi.createNamespacedServiceAccount(namespace, resource)
                break

            default:
                console.log(`Resource ${kind} not implementaded.`)
                break
        }

        console.log(`${kind} applied succesfully.`)
        return ''
    }
    catch (err:any) {
        console.log('Error applying:*********************')
        console.log(err.response.body)
        return 'Error applying: '+err.response?.body?.message
    }
}

// Función para aplicar todos los recursos en el archivo YAML
async function applyAllResources(yamlContent:string, clusterInfo:ClusterInfo) {
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

            const eviction: V1Eviction = {
                apiVersion: 'policy/v1',
                kind: 'Eviction',
                metadata: { name, namespace }
            }

            try {
                await coreApi.createNamespacedPodEviction({ name, namespace, body: eviction })
                console.log(`Evcition succesfully requested for: ${name}`);
            }
            catch (e: any) {
                console.error(`Error evicting ${name}: ${e.body?.message || e.message}`);
            }
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

export { applyResource, applyAllResources, deleteAllResources, nodeDrain, nodeCordon, nodeUnCordon, throttleExcute }