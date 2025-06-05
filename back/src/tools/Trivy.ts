//import { ApiextensionsV1Api, AppsV1Api, CoreV1Api, RbacAuthorizationV1Api } from '@kubernetes/client-node'
import { ClusterInfo } from '../model/ClusterInfo'

// Función para aplicar todos los recursos en el archivo YAML
async function applyAllResources(yamlContent:string, clusterInfo:ClusterInfo) {
    const fs = require('fs')
    const yaml = require('js-yaml')
    const resources:any[] = []

    yaml.loadAll(yamlContent, (doc: any) => {
        resources.push(doc)
    })
    async function applyResource(resource:any) {
        const kind = resource.kind
        const namespace = resource.metadata && resource.metadata.namespace

        switch (kind) {
            case 'Namespace':
                console.log(`Applying Namespace: ${resource.metadata.name}`)
                await clusterInfo.coreApi.createNamespace(resource)
                break

            case 'ConfigMap':
                console.log(`Applying ConfigMap: ${resource.metadata.name}`)
                await clusterInfo.coreApi.createNamespacedConfigMap(namespace, resource)
                break

            case 'Secret':
                console.log(`Applying Secret: ${resource.metadata.name}`)
                await clusterInfo.coreApi.createNamespacedSecret(namespace, resource)
                break

            case 'CustomResourceDefinition':
                console.log(`Applying CRD: ${resource.metadata.name}`)
                await clusterInfo.extensionApi.createCustomResourceDefinition(resource)
                break

            case 'Deployment':
                console.log(`Applying Deployment: ${resource.metadata.name}`)
                await clusterInfo.appsApi.createNamespacedDeployment(namespace, resource)
                break

            case 'Service':
                console.log(`Applying Service: ${resource.metadata.name}`)
                await clusterInfo.coreApi.createNamespacedService(namespace, resource)
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
    }

    for (const resource of resources) {
        try {
            await applyResource(resource)
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


export { applyAllResources, deleteAllResources } 