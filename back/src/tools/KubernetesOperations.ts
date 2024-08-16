import { AppsV1Api } from "@kubernetes/client-node";

export const restartDeployment = async (appsV1Api:AppsV1Api, namespace:string, deploymentName:string) => {
    try {
        console.log(`Restarting ${namespace}/${deploymentName}`);
        const { body: deployment } = await appsV1Api.readNamespacedDeployment(deploymentName, namespace);
        if (!deployment!.spec!.template!.metadata!.annotations) deployment!.spec!.template!.metadata!.annotations = {};
        deployment!.spec!.template!.metadata!.annotations['kwirth/restartedAt'] = new Date().toISOString();
        appsV1Api.replaceNamespacedDeployment(deploymentName, namespace, deployment);
    }
    catch (err) {
        console.error(`Error restarting deployment ${deploymentName}:`, err);
    }
}

export const pauseDeployment = async (appsV1Api:AppsV1Api, namespace:string, deploymentName:string) => {
    console.log(`Pausing ${namespace}/${deploymentName}`);
    const deployment = await appsV1Api.readNamespacedDeployment(deploymentName, namespace);
    deployment.body.spec!.paused = true;
    await appsV1Api.replaceNamespacedDeployment(deploymentName, namespace, deployment.body);
}
