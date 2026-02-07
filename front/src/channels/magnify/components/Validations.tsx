import { Stack } from "@mui/material"
import { ENotifyLevel } from "../../../tools/Global"
import { IFileObject } from "@jfvilas/react-file-manager"
const _ = require('lodash')

export interface IIssue {
    kind:string
    name:string
    level:ENotifyLevel
    text:string
}
const formatIssues = (isssues:IIssue[], onLink:(kind:string, name:string) => void) => {
    return <Stack direction={'column'}>{
        isssues.map ( (i, index) => {
            return <span key={index}>{i.text}:<a href={`#`} onClick={() => onLink(i.kind, i.name)}>{i.name}</a></span>
        })}
    </Stack>
}

export const validateReplicaSets = (files:IFileObject[], onLink:(kind:string, name:string) => void) => {
    let issues:IIssue[] = []

    for (let rs of files.filter(f => f.path.startsWith('/workload/ReplicaSet/')).map(f => f.data.origin)) {
        if (rs.status?.replicas === 0 || rs.status?.availableReplicas === 0 || rs.status?.readyReplicas ===0 ) {
            issues.push ({kind:'ReplicaSet', name:rs.metadata.name, level: ENotifyLevel.WARNING, text: 'Unneeded ReplicaSet' })
        }
        else if (rs.status?.replicas === 0 || rs.spec.availableReplicas === 0 ) {
            issues.push ({kind:'ReplicaSet', name:rs.metadata.name, level: ENotifyLevel.WARNING, text: '0 replicas desired' })
        }
    }
    return formatIssues(issues, onLink)
}

export const validateConfigMaps = (files:IFileObject[], onLink:(kind:string, name:string) => void) => {
    let configMapNames = files.filter(f => f.path.startsWith('/config/ConfigMap/') && f.data?.origin?.metadata?.namespace!=='kube-system' && f.data?.origin?.metadata?.namespace!=='kube-public').map(f => f.name)
    let unused = [...configMapNames]

    for (let cmName of configMapNames) {
        for (let file of files.filter(f => f.path.startsWith('/workload/Pod/'))) {
            let pod = file.data.origin
            let conts = pod.spec?.containers as any[] || []
            for (let cont of conts) {
                let envFroms = cont.envFrom as any[] || []
                for (let envFrom of envFroms) {
                    if (envFrom.configMapRef?.name === cmName) unused = unused.filter(cm => cm !==cmName)
                }
                let envs = cont.env as any[] || []
                for (let env of envs) {
                    if (env?.valueFrom?.configMapRef?.name === cmName) unused = unused.filter(cm => cm !== cmName)
                }
            }
            let vols = pod['spec']?.['volumes'] as any[] || []
            for (let vol of vols) {
                if(vol.configMap?.name === cmName) unused = unused.filter(cm => cm !==cmName)
                if (vol.projected?.sources?.some( (s:any) => s.configMap?.name === cmName)) unused = unused.filter(cm => cm !== cmName)
            }
        }
    }
    return formatIssues(unused.map(u => { return {name:u, kind:'ConfigMap', text:'Unreferenced ConfigMap', level: ENotifyLevel.WARNING}}), onLink)
}

export const validateSecrets = (files:IFileObject[], onLink:(kind:string, name:string) => void) => {
    let secretNames = files.filter(f => f.path.startsWith('/config/Secret/') && f.data?.origin?.metadata?.namespace!=='kube-system').map(f => f.name)
    let unused = [...secretNames]

// ingress
//   tls:
//     - hosts:
//         - eulensecure.eulensecure.com
//       secretName: eulen-cert-tls    
    for (let secretName of secretNames) {
        for (let file of files.filter(f => f.path.startsWith('/workload/Pod/'))) {
            let pod = file.data.origin;
            if ((_.get(pod, 'spec.imagePullSecrets') as [] || []).map((s:any) => s.name).some((imgSecretName:any) => imgSecretName === secretName)) {
                unused = unused.filter(s => s !== secretName)
                break
            }
            let conts = pod.spec?.containers as any[] || []
            for (let cont of conts) {
                let envFroms = cont.envFrom as any[] || []
                for (let envFrom of envFroms) {
                    if (envFrom.secretRef?.name === secretName) unused = unused.filter(s => s !== secretName)
                }
                let envs = cont.env as any[] || []
                for (let env of envs) {
                    if (env.valueFrom?.secretKeyRef?.name === secretName) unused = unused.filter(s => s !== secretName)
                }
            }
            let vols = pod.spec?.volumes as any[] || []
            for (let vol of vols) {
                if (vol.secret?.secretName === secretName) unused = unused.filter(cm => cm !==secretName)
                if (vol.projected?.sources?.some( (s:any) => s.name === secretName)) unused = unused.filter(cm => cm !==secretName)
            }
        }
        for (let obj of files.filter(f => f.path.startsWith('/workload/Deployment/') || f.path.startsWith('/workload/Job/') || f.path.startsWith('/workload/ReplicaSet/') || f.path.startsWith('/workload/DaemonSet/') || f.path.startsWith('/workload/StatefulSet/')).map(f => f.data.origin)) {
            if ((_.get(obj, 'spec.template.spec.imagePullSecrets') as any[] || []).map((s:any) => s.name).some((imgSecretName:any) => imgSecretName === secretName)) {
                unused = unused.filter(s => s !== secretName)
                break
            }
        }
    }
    return formatIssues(unused.map(u => { return {name:u, kind:'Secret', text:'Unreferenced Secret', level: ENotifyLevel.WARNING}}), onLink)
}
