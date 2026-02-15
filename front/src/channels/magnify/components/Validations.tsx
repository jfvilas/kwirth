import { Button, Stack, Typography } from "@mui/material"
import { ENotifyLevel } from "../../../tools/Global"
import { IFileObject } from "@jfvilas/react-file-manager"
import { useMemo, useState } from "react"
import { IconConfigMap, IconDaemonSet, IconDeployment, IconJob, IconNode, IconPersistentVolumeClaim, IconReplicaSet, IconSecret, IconStatefulSet } from "../../../tools/Constants-React"
const _ = require('lodash')

interface IIssue {
    kind:string
    name:string
    namespace:string
    level:ENotifyLevel
    text:string
}
const formatIssues = (issues:IIssue[], onLink:(kind:string, name:string, namespace:string) => void) => {
    return <Stack direction={'column'}>{
        issues.map ( (i, index) => {
            return <span key={index}>{i.text}:&nbsp;<a href={`#`} onClick={() => onLink(i.kind, i.name, i.namespace)}>{i.name}</a></span>
        })}
    </Stack>
}

const validateReplicaSet = (files:IFileObject[]) => {
    let issues:IIssue[] = []

    for (let rs of files.filter(f => f.path.startsWith('/workload/ReplicaSet/')).map(f => f.data.origin)) {
        if (rs.status?.replicas === 0 || rs.status?.availableReplicas === 0 || rs.status?.readyReplicas ===0 ) {
            issues.push ({kind:'ReplicaSet', name:rs.metadata.name, namespace:rs.metadata.namespace, level: ENotifyLevel.WARNING, text: 'Unneeded ReplicaSet' })
        }
        else if (rs.status?.replicas === 0 || rs.spec.availableReplicas === 0 ) {
            issues.push ({kind:'ReplicaSet', name:rs.metadata.name, namespace:rs.metadata.namespace, level: ENotifyLevel.WARNING, text: '0 replicas desired' })
        }
    }
    return issues
}

const validateDeployment = (files:IFileObject[]) => {
    let issues:IIssue[] = []

    for (let dp of files.filter(f => f.path.startsWith('/workload/Deployment/')).map(f => f.data.origin)) {
        if (dp.status?.replicas !== dp.status?.availableReplicas) {
            console.log(dp)
            issues.push ({kind:'ReplicaSet', name:dp.metadata.name, namespace:dp.metadata.namespace, level: ENotifyLevel.WARNING, text: 'Unready replicas' })
        }
    }
    return issues
}

const validateJob = (files:IFileObject[]) => {
    let issues:IIssue[] = []

    for (let j of files.filter(f => f.path.startsWith('/workload/Job/')).map(f => f.data.origin)) {
        if (j.status?.failed!==undefined && +j.status?.failed>0) issues.push ({kind:'Job', name:j.metadata.name, namespace:j.metadata.namespace, level: ENotifyLevel.ERROR, text: 'Failed Job' })
    }
    return issues
}

const validateStatefulSet = (files:IFileObject[]) => {
    let issues:IIssue[] = []

    for (let ss of files.filter(f => f.path.startsWith('/workload/Stateful/')).map(f => f.data.origin)) {
        if (ss.status?.replicas !== ss.status?.availableReplicas) {
            issues.push ({kind:'StatefulSet', name:ss.metadata.name, namespace:ss.metadata.namespace, level: ENotifyLevel.ERROR, text: 'SS Replicas unready' })
        }
    }
    return issues
}

const validateDaemonSet = (files:IFileObject[]) => {
    let issues:IIssue[] = []

    for (let ds of files.filter(f => f.path.startsWith('/workload/Stateful/')).map(f => f.data.origin)) {
        if (ds.status?.replicas !== ds.status?.availableReplicas) {
            issues.push ({kind:'StatefulSet', name:ds.metadata.name, namespace:ds.metadata.namespace, level: ENotifyLevel.ERROR, text: 'DS replicas unready' })
        }
    }
    return issues
}

const validateConfigMap = (files:IFileObject[]) => {
    let configMaps = files.filter(f => f.path.startsWith('/config/ConfigMap/') && f.data?.origin?.metadata?.namespace!=='kube-system' && f.data?.origin?.metadata?.namespace!=='kube-public')
    let unused = [...configMaps]

    const isUsedInEnvs = (cont:any, name:string) : boolean => {
        let envFroms = cont.envFrom as any[] || []
        for (let envFrom of envFroms) {
            if (envFrom.configMapRef?.name === name) return true
        }
        let envs = cont.env as any[] || []
        for (let env of envs) {
            if (env.valueFrom?.configMapRef?.name === name) return true
        }
        return false
    }

    const isUsedInPod = (pod:any, name:string) : boolean => {
        for (let cont of pod.spec?.containers as any[] || [])
            if (isUsedInEnvs(cont, name)) return true
        
        let vols = pod['spec']?.['volumes'] as any[] || []
        for (let vol of vols) {
            if(vol.configMap?.name === name) return true
            if (vol.projected?.sources?.some( (s:any) => s.configMap?.name === name)) return true
        }
        return false
    }

    for (let configMap of configMaps) {
        let configMapName = configMap.data.origin.metadata.name
        if (' kwirth.keys kwirth-keys '.includes(configMapName)) unused = unused.filter(s => s !== configMap)
        for (let pod of files.filter(f => f.path.startsWith('/workload/Pod/')).map(f => f.data.origin))
            if (isUsedInPod(pod, configMapName)) unused = unused.filter(s => s !== configMap)
        for (let ss of files.filter(f => f.path.startsWith('/workload/StatefulSet/')).map(f => f.data.origin))
            if (isUsedInPod(ss.spec.template, configMapName)) unused = unused.filter(s => s !== configMap)
        for (let rs of files.filter(f => f.path.startsWith('/workload/ReplicaSet/')).map(f => f.data.origin))
            if (isUsedInPod(rs.spec.template, configMapName)) unused = unused.filter(s => s !== configMap)
        for (let dp of files.filter(f => f.path.startsWith('/workload/Deployment/')).map(f => f.data.origin))
            if (isUsedInPod(dp.spec.template, configMapName)) unused = unused.filter(s => s !== configMap)
        for (let ds of files.filter(f => f.path.startsWith('/workload/DaemonSet/')).map(f => f.data.origin))
            if (isUsedInPod(ds.spec.template, configMapName)) unused = unused.filter(s => s !== configMap)
        for (let rc of files.filter(f => f.path.startsWith('/workload/ReplicationController/')).map(f => f.data.origin))
            if (isUsedInPod(rc.spec.template, configMapName)) unused = unused.filter(s => s !== configMap)
    }
    return unused.map(u => { return {name:u.data.origin.metadata.name, namespace:u.data.origin.metadata.namespace, kind:'ConfigMap', text:'Unreferenced ConfigMap', level: ENotifyLevel.WARNING}})
}

const validateSecret = (files:IFileObject[]) => {
    let secrets = files.filter(f => f.path.startsWith('/config/Secret/') && f.data?.origin?.metadata?.namespace!=='kube-system' && f.data?.origin?.metadata?.namespace!=='kube-public')
    let unused = [...secrets]

    for (let secretx of secrets) {
        let secretNamex = secretx.data.origin.metadata.name
        if (' kwirth-sa-kwirthtoken kwirth-users kwirth.keys kwirth-keys '.includes(secretNamex)) unused = unused.filter(s => s !== secretx)
        if (secretx.data?.origin?.type?.startsWith('helm.sh/release.')) unused = unused.filter(s => s !== secretx)

        for (let file of files.filter(f => f.path.startsWith('/workload/Pod/'))) {
            let pod = file.data.origin;
            if ((_.get(pod, 'spec.imagePullSecrets') as [] || []).map((s:any) => s.name).some((imgSecretName:any) => imgSecretName === secretNamex)) {
                unused = unused.filter(s => s !== secretx)
                break
            }
            let conts = pod.spec?.containers as any[] || []
            for (let cont of conts) {
                let envFroms = cont.envFrom as any[] || []
                for (let envFrom of envFroms) {
                    if (envFrom.secretRef?.name === secretNamex) unused = unused.filter(s => s !== secretx)
                }
                let envs = cont.env as any[] || []
                for (let env of envs) {
                    if (env.valueFrom?.secretKeyRef?.name === secretNamex) unused = unused.filter(s => s !== secretx)
                }
            }
            let vols = pod.spec?.volumes as any[] || []
            for (let vol of vols) {
                if (vol.secret?.secretName === secretNamex) unused = unused.filter(s => s !== secretx)
                if (vol.projected?.sources?.some( (s:any) => s.secret?.name === secretNamex)) unused = unused.filter(s => s !== secretx)
            }
        }
        for (let obj of files.filter(f => f.path.startsWith('/workload/Deployment/') || f.path.startsWith('/workload/Job/') || f.path.startsWith('/workload/ReplicaSet/') || f.path.startsWith('/workload/DaemonSet/') || f.path.startsWith('/workload/StatefulSet/')).map(f => f.data.origin)) {
            if ((_.get(obj, 'spec.template.spec.imagePullSecrets') as any[] || []).map((s:any) => s.name).some((imgSecretName:any) => imgSecretName === secretNamex)) {
                unused = unused.filter(s => s !== secretx)
                break
            }
        }
        for (let file of files.filter(f => f.path.startsWith('/network/Ingress/'))) {
            let pod = file.data.origin
            if ((_.get(pod, 'spec.tls') as [] || []).some((host:any) => host.secretName === secretNamex)) unused = unused.filter(s => s !== secretx)
        }
        for (let file of files.filter(f => f.path.startsWith('/storage/PersistentVolume/'))) {
            let pv = file.data.origin
            if (_.get(pv, 'spec.csi.nodeStageSecretRef.name')===secretNamex) unused = unused.filter(s => s !== secretx)
            if (_.get(pv, 'spec.csi.volumeAttributes.secretName')===secretNamex) unused = unused.filter(s => s !== secretx)
        }
        for (let file of files.filter(f => f.path.startsWith('/storage/StorageClass/'))) {
            let sc = file.data.origin
            if (_.get(sc, 'parameters.secretName')===secretNamex) unused = unused.filter(s => s !== secretx)
        }

    }
    return unused.map(u => { return {name:u.data.origin.metadata.name, namespace:u.data.origin.metadata.namespace, kind:'Secret', text:'Unreferenced Secret', level: ENotifyLevel.WARNING}})
}

const validateVolumeAttachment = (files:IFileObject[]) => {
    let vas = files.filter(f => f.path.startsWith('/storage/VolumeAttachment/'))
    let issues:IIssue[] = []
    for (let va of vas) {
        if (va.data.origin.status.attachError || va.data.origin.status.detachError) issues.push({
            kind: 'VolumeAttach',
            name: va.data.origin.metadata.name,
            namespace: '',
            level: ENotifyLevel.ERROR,
            text: 'Attach/detach error'
        })
    }
    return issues
}

const validateNode = (files:IFileObject[]) => {
    let issues:IIssue[] = []
    let ns = files.filter(f => f.path.startsWith('/cluster/Node/')).map(f => f.data.origin)
    for (let n of ns) {
        let ready = n.status.conditions.some((c:any) => c.type==='Ready' && c.status==='True')
        if (!ready) issues.push({
            name: n.metadata.name, 
            namespace:'', 
            kind:'Node', 
            text:'Node not ready', 
            level: ENotifyLevel.ERROR}
        )
        else {
            let warnings = n.status.conditions.filter((c:any) => c.type!=='Ready' && c.status==='True')
            if (warnings.length>0) issues.push({
                name: n.metadata.name, 
                namespace:'', 
                kind:'Node', 
                text: warnings.join(', '), 
                level: ENotifyLevel.ERROR}
            )
        }
    }
    return issues
}

const showBadge = (issues:IIssue[], icon:JSX.Element, onNavigate:(dest:string)=> void, dest:string) => {
    let errors = issues.filter(i => i.level === ENotifyLevel.ERROR).length
    let warnings = issues.filter(i => i.level === ENotifyLevel.WARNING).length
    return (
        <Button onClick={() => onNavigate(dest)} sx={{backgroundColor:errors>0?'#ffaaaa':''}}>
            <Stack direction={'column'} alignItems={'center'}>
                {icon}
                <Stack direction={'row'}>
                    <Typography fontSize={10} color={errors>0?'red':'gray'}>{errors}&nbsp;&nbsp;</Typography>
                    <Typography fontSize={10} color={warnings>0?'orange':errors>0?'gray':'orange'}>{issues.filter(i => i.level === ENotifyLevel.WARNING).length}</Typography>
                </Stack>
            </Stack>
        </Button>
    )
}

const validateSummary = (files:IFileObject[], onNavigate: (dest:string) => void) => {
    return (
        <Stack direction={'row'} flex={1} justifyContent={"space-between"}>
            {showBadge(validateNode(files), <IconNode size={50}/>, onNavigate, '/cluster/Node')}
            {showBadge(validateConfigMap(files), <IconConfigMap height={50}/>, onNavigate, '/config/ConfigMap')}
            {showBadge(validateSecret(files), <IconSecret height={50}/>, onNavigate, '/config/Secret')}
            {showBadge(validateDeployment(files), <IconDeployment size={50}/>, onNavigate, '/workload/Deployment')}
            {showBadge(validateReplicaSet(files), <IconReplicaSet size={50}/>, onNavigate, '/workload/ReplicaSet')}
            {showBadge(validateStatefulSet(files), <IconStatefulSet size={50}/>, onNavigate, '/workload/StatefulSet')}
            {showBadge(validateDaemonSet(files), <IconDaemonSet size={50}/>, onNavigate, '/workload/DaemonSet')}
            {showBadge(validateJob(files), <IconJob size={50}/>, onNavigate, '/workload/Job')}
            {showBadge(validateVolumeAttachment(files), <IconPersistentVolumeClaim height={50}/>, onNavigate, '/storage/VolumeAttachment')}
        </Stack>
    )
}

interface IValidationsProps {
    files: IFileObject[]
    onLink: (kind:string, name:string, namespace:string) => void
    onNavigate: (dest:string) => void
    options: {
        node? :boolean
        configMap? :boolean
        secret? :boolean
        deployment? :boolean
        replicaSet? :boolean
        statefulSet? :boolean
        daemonSet? :boolean
        job? :boolean
        volumeAttachment? :boolean
        summary? :boolean
    }
}

const Validations: React.FC<IValidationsProps> = (props:IValidationsProps) => {
    const nodeVals = useMemo( () => validateNode(props.files), [])
    const cmVals = useMemo( () => validateConfigMap(props.files), [])
    const secretVals = useMemo( () => validateSecret(props.files), [])
    const deploymentVals = useMemo( () => validateDeployment(props.files), [])
    const replicaSetVals = useMemo( () => validateReplicaSet(props.files), [])
    const statefulSetVals = useMemo( () => validateStatefulSet(props.files), [])
    const daemonSetVals = useMemo( () => validateDaemonSet(props.files), [])
    const jobVals = useMemo( () => validateJob(props.files), [])
    const volumeAttachmentVals = useMemo( () => validateVolumeAttachment(props.files), [])
    const summary = useMemo( () => validateSummary(props.files, props.onNavigate), [])
    return (<>
        {props.options.node && formatIssues(nodeVals, props.onLink)}
        {props.options.configMap && formatIssues(cmVals, props.onLink)}
        {props.options.secret && formatIssues(secretVals, props.onLink)}
        {props.options.deployment && formatIssues(deploymentVals, props.onLink)}
        {props.options.replicaSet && formatIssues(replicaSetVals, props.onLink)}
        {props.options.statefulSet && formatIssues(statefulSetVals, props.onLink)}
        {props.options.daemonSet && formatIssues(daemonSetVals, props.onLink)}
        {props.options.job && formatIssues(jobVals, props.onLink)}
        {props.options.volumeAttachment && formatIssues(volumeAttachmentVals, props.onLink)}
        {props.options.summary && summary}
    </>)
}

export { Validations }