import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { IContentProps } from '../IChannel'
import { MagnifyCommandEnum, IMagnifyMessage, IMagnifyData } from './MagnifyData'
import { Box, Button, Card, CardContent, CardHeader, Divider, Stack, Tooltip, Typography } from '@mui/material'
import { InstanceConfigViewEnum, InstanceMessageActionEnum, InstanceMessageFlowEnum, InstanceMessageTypeEnum } from '@jfvilas/kwirth-common'
import { IError, IFileObject, ISpace } from '@jfvilas/react-file-manager'
import { FileManager } from '@jfvilas/react-file-manager'
import { v4 as uuid } from 'uuid'
import { IMagnifyConfig } from './MagnifyConfig'
import { ENotifyLevel } from '../../tools/Global'
import '@jfvilas/react-file-manager/dist/style.css'
import './custom-fm.css'
import { actions, icons, menu, spaces } from './RFMConfig'
import React from 'react'
import { IDetailsSection } from './components/DetailsObject'
import { objectSections } from './components/DetailsSections'
import { Edit, List } from '@mui/icons-material'
import { MsgBoxButtons, MsgBoxOkError, MsgBoxYesNo } from '../../tools/MsgBox'
import { ContentExternal, IContentExternalObject } from './components/ContentExternal'
import { flushSync } from 'react-dom'
import { LeftItemMenu } from './LeftItemMenu'
import { MagnifyUserSettings } from './MagnifyUserSettings'
import { UserSettings } from './components/UserSettings'
import { buildPath, requestList } from './MagnifyChannel'
import { InputBox } from '../../tools/FrontTools'
import { ContentEdit, IContentEditObject } from './components/ContentEdit'
import { templates } from './components/Templates'
import { convertBytesToSize, convertSizeToBytes, getNextCronExecution } from './Tools'
import { ContentDetails, IContentDetailsObject } from './components/ContentDetails'

const _ = require('lodash')

const yamlParser = require('js-yaml');
const settings = new MagnifyUserSettings()

const MagnifyTabContent: React.FC<IContentProps> = (props:IContentProps) => {
    let magnifyData:IMagnifyData = props.channelObject.data
    let permissions = {
        create: false,
        delete: false,
        download: false,
        copy: false,
        move: false,
        rename: false,
        upload: false
    }

    const magnifyBoxRef = useRef<HTMLDivElement | null>(null)
    const [magnifyBoxHeight, setMagnifyBoxHeight] = useState(0)
    const [msgBox, setMsgBox] =useState(<></>)

    const [contentEditVisible, setContentEditVisible] = useState(false)
    const [contentEditNew, setContentEditNew] = useState<string>('')
    const contentWindowId = useRef<number>(-1)

    const [contentExternalVisible, setContentExternalVisible] = useState<boolean>(false)
    const [contentExternalType, setContentExternalType] = useState<string>('')
    const [contentExternalView, setContentExternalView] = useState<InstanceConfigViewEnum>(InstanceConfigViewEnum.POD)
    const [contentExternalTitle, setContentExternalTitle] = useState<string>('n/a')
    const [contentExternalContainer, setContentExternalContainer] = useState<string>('')

    const [inputBoxTitle, setInputBoxTitle] = useState<any>()
    const [inputBoxMessage, setInputBoxMessage] = useState<any>()
    const [inputBoxResult, setIinputBoxResult] = useState<(b:any) => void>()

    const [selectedFiles, setSelectedFiles] = useState<IFileObject[]>([])

    const [leftMenuAnchorParent, setLeftMenuAnchorParent] = useState<Element>()
    const [leftMenuContent, setLeftMenuContent] = useState<any>()
    const [leftMenuIncludeAllContainers, setLeftMenuIncludeAllContainers] = useState<boolean>(false)
    
    const [contentDetailsVisible, setContentDetailsVisible] = useState(false)
    const [detailsSections, setDetailsSections] = useState<IDetailsSection[]>([])

    const [refresh, setRefresh] = useState<number>(Math.random())

    useLayoutEffect(() => {
        const observer = new ResizeObserver(() => {
            if (!magnifyBoxRef.current) return
            const { top } = magnifyBoxRef.current.getBoundingClientRect()
            let a = window.innerHeight - top - 160
            setMagnifyBoxHeight(a)
        })
        observer.observe(document.body)

        return () => observer.disconnect()
    }, [magnifyBoxRef.current])

    useEffect(() => {
        if (!magnifyData.files.some(f => f.path ==='/overview')) {
            magnifyData.files.push(...menu)
        }

        // Main menu
            setPathFunction('/overview', showOverview)
            setPathFunction('/cluster/overview', showClusterOverview)
            setPathFunction('/workload/overview', showWorkloadOverview)
            setPathFunction('/network/overview', showNetworkOverview)
            setPathFunction('/config/overview', showConfigOverview)
            setPathFunction('/storage/overview', showStorageOverview)
            setPathFunction('/settings', showSettings)

        // Workload
            // Pod
            let spcClassPod = spaces.get('classPod')!
            setLeftItem(spcClassPod, 'create', () => launchObjectCreate('Pod'))
            let spcPod = spaces.get('Pod')!
            setPropertyFunction(spcPod, 'container', showPodContainers)
            setPropertyFunction(spcPod, 'cpu', showPodCpu)
            setPropertyFunction(spcPod, 'memory', showPodMemory)
            setLeftItem(spcPod,'logs', launchPodLogs)
            setLeftItem(spcPod,'metrics', launchPodMetrics)
            setLeftItem(spcPod,'shell', launchPodShell)
            setLeftItem(spcPod,'details', launchObjectDetails)
            setLeftItem(spcPod,'delete', launchObjectDelete)
            setLeftItem(spcPod,'evict', launchPodEvict)

            // Deployment
            let spcClassDeployment = spaces.get('classDeployment')!
            setLeftItem(spcClassDeployment, 'create', () => launchObjectCreate('Deployment'))
            let spcDeployment = spaces.get('Deployment')!
            setLeftItem(spcDeployment,'details', launchObjectDetails)
            setLeftItem(spcDeployment,'scale', launchGroupScale)
            setLeftItem(spcDeployment,'restart', launchGroupRestart)
            setLeftItem(spcDeployment,'logs', launchGroupLogs)
            setLeftItem(spcDeployment,'metrics', launchGroupMetrics)
            setLeftItem(spcDeployment,'edit', launchObjectEdit)
            setLeftItem(spcDeployment,'delete', launchObjectDelete)
            let objDeployment = objectSections.get('Deployment')
            if (objDeployment) {
                let item = objDeployment.find(o => o.name==='properties')!.items.find(item => item.name === 'status')
                if (item) {
                    item.invoke = (obj) => { 
                        return ['running']
                    }
                }
                item = objDeployment[1].items.find(item => item.name === 'pods')
                if (item) {
                    item.invoke = (obj) => { 
                        const selectors = obj.spec?.selector?.matchLabels
                        if (!selectors) return []

                        let allPods = magnifyData.files.filter(f => f.path.startsWith('/workload/Pod/'))
                        allPods = allPods.filter(f => {
                            const podLabels = f.data.origin.metadata?.labels || {}
                            return Object.entries(selectors).every(([key, value]) => {
                                return podLabels[key] === value
                            })
                        })
                        allPods = allPods.map(f => f.data.origin)
                        return allPods
                    }
                }
            }
            
            // DaemonSet
            let spcClassDaemonSet = spaces.get('classDaemonSet')!
            setLeftItem(spcClassDaemonSet, 'create', () => launchObjectCreate('DaemonSet'))
            let spcDaemonSet = spaces.get('DaemonSet')!
            setLeftItem(spcDaemonSet,'details', launchObjectDetails)
            setLeftItem(spcDaemonSet,'restart', launchDaemonSetRestart)
            setLeftItem(spcDaemonSet,'logs', launchGroupLogs)
            setLeftItem(spcDaemonSet,'metrics', launchGroupMetrics)
            setLeftItem(spcDaemonSet,'edit', launchObjectEdit)
            setLeftItem(spcDaemonSet,'delete', launchObjectDelete)
            let objDaemonSet = objectSections.get('DaemonSet')
            if (objDaemonSet) {
                //+++ esto mismo se hace en la custom function de los Deployment
                let item = objDaemonSet[0].items.find(item => item.name === 'status')
                if (item) {
                    item.invoke = (obj) => { 
                        return ['running']
                    }
                }
                item = objDaemonSet[1].items.find(item => item.name === 'pods')
                if (item) {
                    item.invoke = (obj) => { 
                        const selectors = obj.spec?.selector?.matchLabels
                        if (!selectors) return []

                        let allPods = magnifyData.files.filter(f => f.path.startsWith('/workload/Pod/'))
                        allPods = allPods.filter(f => {
                            const podLabels = f.data.origin.metadata?.labels || {}
                            return Object.entries(selectors).every(([key, value]) => {
                                return podLabels[key] === value
                            })
                        })
                        allPods = allPods.map(f => f.data.origin)
                        return allPods
                    }
                }
            }

            // ReplicaSet
            let spcClassReplicaSet = spaces.get('classReplicaSet')!
            setLeftItem(spcClassReplicaSet, 'create', () => launchObjectCreate('ReplicaSet'))
            let spcReplicaSet = spaces.get('ReplicaSet')!
            setLeftItem(spcReplicaSet,'details', launchObjectDetails)
            setLeftItem(spcReplicaSet,'scale', launchReplicaSetScale)
            setLeftItem(spcReplicaSet,'logs', launchGroupLogs)
            setLeftItem(spcReplicaSet,'metrics', launchGroupMetrics)
            setLeftItem(spcReplicaSet,'edit', launchObjectEdit)
            setLeftItem(spcReplicaSet,'delete', launchObjectDelete)
            let objReplicaSet = objectSections.get('ReplicaSet')
            if (objReplicaSet) {
                //+++ esto mismo se hace en la custom function de los Deployment
                let item = objReplicaSet[0].items.find(item => item.name === 'status')
                if (item) {
                    item.invoke = (obj) => { 
                        return ['running']
                    }
                }
                item = objReplicaSet[1].items.find(item => item.name === 'pods')
                if (item) {
                    item.invoke = (obj) => { 
                        const selectors = obj.spec?.selector?.matchLabels
                        if (!selectors) return []

                        let allPods = magnifyData.files.filter(f => f.path.startsWith('/workload/Pod/'))
                        allPods = allPods.filter(f => {
                            const podLabels = f.data.origin.metadata?.labels || {}
                            return Object.entries(selectors).every(([key, value]) => {
                                return podLabels[key] === value
                            })
                        })
                        allPods = allPods.map(f => f.data.origin)
                        return allPods
                    }
                }
            }

            // ReplicationController
            let spcClassReplicationController = spaces.get('classReplicationController')!
            setLeftItem(spcClassReplicationController, 'create', () => launchObjectCreate('ReplicationController'))
            let spcReplicationController = spaces.get('ReplicationController')!
            setLeftItem(spcReplicationController,'details', launchObjectDetails)
            setLeftItem(spcReplicationController,'logs', launchGroupLogs)
            setLeftItem(spcReplicationController,'metrics', launchGroupMetrics)
            setLeftItem(spcReplicationController,'edit', launchObjectEdit)
            setLeftItem(spcReplicationController,'delete', launchObjectDelete)

            // StatefulSet
            let spcClassStatefulSet = spaces.get('classStatefulSet')!
            setLeftItem(spcClassStatefulSet, 'create', () => launchObjectCreate('StatefulSet'))
            let spcStatefulSet = spaces.get('StatefulSet')!
            setLeftItem(spcStatefulSet,'details', launchObjectDetails)
            setLeftItem(spcStatefulSet,'scale', launchGroupScale)
            setLeftItem(spcStatefulSet,'restart', launchGroupRestart)
            setLeftItem(spcStatefulSet,'logs', launchGroupLogs)
            setLeftItem(spcStatefulSet,'metrics', launchGroupMetrics)
            setLeftItem(spcStatefulSet,'edit', launchObjectEdit)
            setLeftItem(spcStatefulSet,'delete', launchObjectDelete)
            let objStatefulSet = objectSections.get('StatefulSet')
            if (objStatefulSet) {
                //+++ esto mismo se hace en la custom function de los Deployment
                let item = objStatefulSet[0].items.find(item => item.name === 'status')
                if (item) {
                    item.invoke = (obj) => { 
                        return ['running']
                    }
                }
                item = objStatefulSet[1].items.find(item => item.name === 'pods')
                if (item) {
                    //+++ este codigo es igual al de otros
                    item.invoke = (obj) => { 
                        const selectors = obj.spec?.selector?.matchLabels
                        if (!selectors) return []

                        let allPods = magnifyData.files.filter(f => f.path.startsWith('/workload/Pod/'))
                        allPods = allPods.filter(f => {
                            const podLabels = f.data.origin.metadata?.labels || {}
                            return Object.entries(selectors).every(([key, value]) => {
                                return podLabels[key] === value
                            })
                        })
                        allPods = allPods.map(f => f.data.origin)
                        return allPods
                    }
                }
            }

            let spcClassJob = spaces.get('classJob')!
            setLeftItem(spcClassJob, 'create', () => launchObjectCreate('Job'))
            let spcJob = spaces.get('Job')!
            setLeftItem(spcJob,'details', launchObjectDetails)
            setLeftItem(spcJob,'logs', launchJobLogs)
            setLeftItem(spcJob,'edit', launchObjectEdit)
            setLeftItem(spcJob,'delete', launchObjectDelete)
            let objJob = objectSections.get('Job')
            if (objJob) {
                //+++ esto mismo se hace en la custom function de los Deployment
                let item = objJob[0].items.find(item => item.name === 'status')
                if (item) {
                    item.invoke = (obj) => { 
                        return ['running']
                    }
                }
            }

            let spcClassCronJob = spaces.get('classCronJob')!
            setLeftItem(spcClassCronJob, 'create', () => launchObjectCreate('CronJob'))
            let spcCronJob = spaces.get('CronJob')!
            setPropertyFunction(spcCronJob, 'nextExecution', showCronJobNextExecution)
            setLeftItem(spcCronJob,'trigger', launchCronJobTrigger)
            setLeftItem(spcCronJob,'suspend', launchCronJobSuspend)
            setLeftItem(spcCronJob,'resume', launchCronJobResume)
            setLeftItem(spcCronJob,'details', launchObjectDetails)
            setLeftItem(spcCronJob,'edit', launchObjectEdit)
            setLeftItem(spcCronJob,'delete', launchObjectDelete)
            let objCronJob = objectSections.get('CronJob')
            if (objCronJob) {
                let item = objCronJob[0].items.find(item => item.name === 'nextExecution')
                if (item) {
                    item.invoke = (obj) => {
                        let x = getNextCronExecution(obj.spec.schedule)
                        return [x?.isoString]
                    }
                }
                item = objCronJob[0].items.find(item => item.name === 'timeLeft')
                if (item) {
                    item.invoke = (obj) => {
                        let x = getNextCronExecution(obj.spec.schedule)
                        return [`${x?.timeLeft.days}d${x?.timeLeft.hours}h${x?.timeLeft.minutes}m${x?.timeLeft.seconds}s`]
                    }
                }
                item = objCronJob[1].items.find(item => item.name === 'jobs')
                if (item) {
                    item.invoke = (obj) => { 
                        let allJobs = magnifyData.files.filter(f => f.path.startsWith('/workload/Job/'))
                        allJobs = allJobs.filter(f => {
                            const owners = f.data.origin.metadata.ownerReferences || []
                            return owners.some((owner:any) => owner.name === obj.metadata.name && owner.kind === 'CronJob')
                        })
                        allJobs = allJobs.map(f => f.data.origin)
                        return allJobs
                    }
                }
            }


        // Cluster

            // Node
            let spcNode = spaces.get('Node')!
            setLeftItem(spcNode,'details', launchObjectDetails)
            setLeftItem(spcNode,'cordon', launchNodeCordon)
            setLeftItem(spcNode,'uncordon', launchNodeUnCordon)
            setLeftItem(spcNode,'drain', launchNodeDrain)
            setLeftItem(spcNode,'edit', launchObjectEdit)
            setLeftItem(spcNode,'delete', launchObjectDelete)

            // Namespace
            let spcClassNamespace = spaces.get('classNamespace')!
            setLeftItem(spcClassNamespace, 'create', launchNamespaceCreate)
            let spcNamespace = spaces.get('Namespace')!
            setLeftItem(spcNamespace,'details', launchObjectDetails)
            setLeftItem(spcNamespace,'edit', launchObjectEdit)
            setLeftItem(spcNamespace,'delete', launchObjectDelete)
            let objNamespace = objectSections.get('Namespace')
            if (objNamespace) {
                let item = objNamespace?.find(s => s.name==='content')?.items.find(item => item.name === 'content')
                let getElements = (namespace:string, kind:string, text:string): JSX.Element => {
                    let elements = magnifyData.files.filter(f => f.data?.origin?.kind === kind && f.data?.origin?.metadata.namespace===namespace)?.map(f => f.data?.origin?.metadata.name)
                    if (elements.length===0) return <></>
                    // return (
                    //     <Stack flexDirection={'row'} display={'flex'} width={'100%'}>
                    //         <Typogra phy width={'15%'}>{text}:&nbsp;</Typography>  llevar a DIV
                    //         {
                    //             elements.map( (e) => <Stack direction={'row'}>
                    //                 <a href={`#`} onClick={() => onMagnifyObjectDetailsLink(kind,e)}> {e} </a>&nbsp;&nbsp;
                    //             </Stack>)
                    //         }
                    //     </Stack>
                    // )
                    return (
                        <Stack flexDirection={'row'} display={'flex'} width={'100%'}>
                            <Typography width={'15%'}>{text}:&nbsp;</Typography>
                            {
                                elements.map( (e) => <><a href={`#`} onClick={() => onMagnifyObjectDetailsLink(kind,e)}>{e}</a>&nbsp;</>)
                            }
                        </Stack>
                    )
                }
                if (item) {
                    item.invoke = (obj) => {
                        return [
                            'Pod+Pod','Deployment+Deployment','DaemonSet+DaemonSet','ReplicaSet+ReplicaSet','ReplicationController+ReplicationController','StatefulSet+StatefulSet','Job+Job','CronJob+CronJob',
                            'PersistentVolumeClaim+PVC','PersistentVolume+PV',
                            'ConfigMap+ConfigMap','Secret+Secret',
                            'Service+Service','Endpoints+Endpoints','Ingress+Ingress',
                            'Role+Role','RoleBinding+RoleBinding'
                        ].map (kind => getElements(obj.metadata.name, kind.split('+')[0], kind.split('+')[1]))
                    }
                }
            }

        // Network

            // Service
            let spcClassService = spaces.get('classService')!
            setLeftItem(spcClassService, 'create', () => launchObjectCreate('Service'))
            let spcService = spaces.get('Service')!
            setLeftItem(spcService,'details', launchObjectDetails)
            setLeftItem(spcService,'edit', launchObjectEdit)
            setLeftItem(spcService,'delete', launchObjectDelete)

            // Endpoints
            let spcClassEndpoints = spaces.get('classEndpoints')!
            setLeftItem(spcClassEndpoints, 'create', () => launchObjectCreate('Endpoints'))
            let spcEndpoints = spaces.get('Endpoints')!
            setLeftItem(spcEndpoints,'details', launchObjectDetails)
            setLeftItem(spcEndpoints,'edit', launchObjectEdit)
            setLeftItem(spcEndpoints,'delete', launchObjectDelete)


            // Ingress
            let spcClassIngress = spaces.get('classIngress')!
            setLeftItem(spcClassIngress, 'create', () => launchObjectCreate('Ingress'))
            let spcIngress = spaces.get('Ingress')!
            setLeftItem(spcIngress,'details', launchObjectDetails)
            setLeftItem(spcIngress,'edit', launchObjectEdit)
            setLeftItem(spcIngress,'delete', launchObjectDelete)

            // IngressClass
            let spcClassIngressClass = spaces.get('classIngressClass')!
            setLeftItem(spcClassIngressClass, 'create', () => launchObjectCreate('IngressClass'))
            let spcIngressClass = spaces.get('IngressClass')!
            setLeftItem(spcIngressClass,'default', launchIngressClassDefault)
            setLeftItem(spcIngressClass,'details', launchObjectDetails)
            setLeftItem(spcIngressClass,'edit', launchObjectEdit)
            setLeftItem(spcIngressClass,'delete', launchObjectDelete)

            // NetworkPolicy
            let spcClassNetworkPolicy = spaces.get('classNetworkPolicy')!
            setLeftItem(spcClassNetworkPolicy, 'create', () => launchObjectCreate('NetworkPolicy'))
            let spcNetworkPolicy = spaces.get('NetworkPolicy')!
            setLeftItem(spcNetworkPolicy,'details', launchObjectDetails)
            setLeftItem(spcNetworkPolicy,'edit', launchObjectEdit)
            setLeftItem(spcNetworkPolicy,'delete', launchObjectDelete)

        // Config

            // ConfigMap
            let spcClassConfigMap = spaces.get('classConfigMap')!
            setLeftItem(spcClassConfigMap, 'create', () => launchObjectCreate('ConfigMap'))
            let spcConfigMap = spaces.get('ConfigMap')!
            setLeftItem(spcConfigMap,'details', launchObjectDetails)
            setLeftItem(spcConfigMap,'edit', launchObjectEdit)
            setLeftItem(spcConfigMap,'delete', launchObjectDelete)

            // Secret
            let spcClassSecret = spaces.get('classSecret')!
            setLeftItem(spcClassSecret, 'create', () => launchObjectCreate('Secret'))
            let spcSecret = spaces.get('Secret')!
            setLeftItem(spcSecret,'details', launchObjectDetails)
            setLeftItem(spcSecret,'edit', launchObjectEdit)
            setLeftItem(spcSecret,'delete', launchObjectDelete)

            // ResourceQuota
            let spcClassResourceQuota = spaces.get('classResourceQuota')!
            setLeftItem(spcClassResourceQuota, 'create', () => launchObjectCreate('ResourceQuota'))
            let spcResourceQuota = spaces.get('ResourceQuota')!
            setLeftItem(spcResourceQuota,'details', launchObjectDetails)
            setLeftItem(spcResourceQuota,'edit', launchObjectEdit)
            setLeftItem(spcResourceQuota,'delete', launchObjectDelete)

            // Limir Range
            let spcClassLimitRange = spaces.get('classLimitRange')!
            setLeftItem(spcClassLimitRange, 'create', () => launchObjectCreate('LimitRange'))
            let spcLimitRange = spaces.get('LimitRange')!
            setLeftItem(spcLimitRange,'details', launchObjectDetails)
            setLeftItem(spcLimitRange,'edit', launchObjectEdit)
            setLeftItem(spcLimitRange,'delete', launchObjectDelete)

            // HorizontalPodAutoscaler
            let spcClassHorizontalPodAutoscaler = spaces.get('classHorizontalPodAutoscaler')!
            setLeftItem(spcClassHorizontalPodAutoscaler, 'create', () => launchObjectCreate('HorizontalPodAutoscaler'))
            let spcHorizontalPodAutoscaler = spaces.get('HorizontalPodAutoscaler')!
            setLeftItem(spcHorizontalPodAutoscaler,'details', launchObjectDetails)
            setLeftItem(spcHorizontalPodAutoscaler,'edit', launchObjectEdit)
            setLeftItem(spcHorizontalPodAutoscaler,'delete', launchObjectDelete)

            // PodDisruptionBudget
            let spcClassPodDisruptionBudget = spaces.get('classPodDisruptionBudget')!
            setLeftItem(spcClassPodDisruptionBudget, 'create', () => launchObjectCreate('PodDisruptionBudget'))
            let spcPodDisruptionBudget = spaces.get('PodDisruptionBudget')!
            setLeftItem(spcPodDisruptionBudget,'details', launchObjectDetails)
            setLeftItem(spcPodDisruptionBudget,'edit', launchObjectEdit)
            setLeftItem(spcPodDisruptionBudget,'delete', launchObjectDelete)

            // PriorityClass
            let spcClassPriorityClass = spaces.get('classPriorityClass')!
            setLeftItem(spcClassPriorityClass, 'create', () => launchObjectCreate('PriorityClass'))
            let spcPriorityClass = spaces.get('PriorityClass')!
            setLeftItem(spcPriorityClass,'details', launchObjectDetails)
            setLeftItem(spcPriorityClass,'edit', launchObjectEdit)
            setLeftItem(spcPriorityClass,'delete', launchObjectDelete)

            // RuntimeClass
            let spcClassRuntimeClass = spaces.get('classRuntimeClass')!
            setLeftItem(spcClassRuntimeClass, 'create', () => launchObjectCreate('RuntimeClass'))
            let spcRuntimeClass = spaces.get('RuntimeClass')!
            setLeftItem(spcRuntimeClass,'details', launchObjectDetails)
            setLeftItem(spcRuntimeClass,'edit', launchObjectEdit)
            setLeftItem(spcRuntimeClass,'delete', launchObjectDelete)

            // Lease
            let spcClassLease = spaces.get('classLease')!
            setLeftItem(spcClassLease, 'create', () => launchObjectCreate('Lease'))
            let spcLease = spaces.get('Lease')!
            setLeftItem(spcLease,'details', launchObjectDetails)
            setLeftItem(spcLease,'edit', launchObjectEdit)
            setLeftItem(spcLease,'delete', launchObjectDelete)

            // ValidatingWebhookConfiguration
            let spcClassValidatingWebhookConfiguration = spaces.get('classValidatingWebhookConfiguration')!
            setLeftItem(spcClassValidatingWebhookConfiguration, 'create', () => launchObjectCreate('ValidatingWebhookConfiguration'))
            let spcValidatingWebhookConfiguration = spaces.get('ValidatingWebhookConfiguration')!
            setLeftItem(spcValidatingWebhookConfiguration,'details', launchObjectDetails)
            setLeftItem(spcValidatingWebhookConfiguration,'edit', launchObjectEdit)
            setLeftItem(spcValidatingWebhookConfiguration,'delete', launchObjectDelete)
            
            // MutatingWebhookConfiguration
            let spcClassMutatingWebhookConfiguration = spaces.get('classMutatingWebhookConfiguration')!
            setLeftItem(spcClassMutatingWebhookConfiguration, 'create', () => launchObjectCreate('MutatingWebhookConfiguration'))
            let spcMutatingWebhookConfiguration = spaces.get('MutatingWebhookConfiguration')!
            setLeftItem(spcMutatingWebhookConfiguration,'details', launchObjectDetails)
            setLeftItem(spcMutatingWebhookConfiguration,'edit', launchObjectEdit)
            setLeftItem(spcMutatingWebhookConfiguration,'delete', launchObjectDelete)
            
        // Storage

            // StorageClass
            let spcClassStorageClass = spaces.get('classStorageClass')!
            setLeftItem(spcClassStorageClass, 'create', () => launchObjectCreate('StorageClass'))
            let spcStorageClass = spaces.get('StorageClass')!
            setLeftItem(spcStorageClass,'details', launchObjectDetails)
            setLeftItem(spcStorageClass,'edit', launchObjectEdit)
            setLeftItem(spcStorageClass,'delete', launchObjectDelete)

            // PersistentVolumeClaim
            let spcClassPersistentVolumeClaim = spaces.get('classPersistentVolumeClaim')!
            setLeftItem(spcClassPersistentVolumeClaim, 'create', () => launchObjectCreate('PersistentVolumeClaim'))
            let spcPersistentVolumeClaim = spaces.get('PersistentVolumeClaim')!
            setLeftItem(spcPersistentVolumeClaim,'details', launchObjectDetails)
            setLeftItem(spcPersistentVolumeClaim,'edit', launchObjectEdit)
            setLeftItem(spcPersistentVolumeClaim,'delete', launchObjectDelete)

            // PersistentVolume
            let spcClassPersistentVolume = spaces.get('classPersistentVolume')!
            setLeftItem(spcClassPersistentVolume, 'create', () => launchObjectCreate('PersistentVolume'))
            let spcPersistentVolume = spaces.get('PersistentVolume')!
            setLeftItem(spcPersistentVolume,'details', launchObjectDetails)
            setLeftItem(spcPersistentVolume,'edit', launchObjectEdit)
            setLeftItem(spcPersistentVolume,'delete', launchObjectDelete)

        // Access

            // ServiceAccount
            let spcClassServiceAccount = spaces.get('classServiceAccount')!
            setLeftItem(spcClassServiceAccount, 'create', () => launchObjectCreate('ServiceAccount'))
            let spcServiceAccount = spaces.get('ServiceAccount')!
            setLeftItem(spcServiceAccount,'details', launchObjectDetails)
            setLeftItem(spcServiceAccount,'edit', launchObjectEdit)
            setLeftItem(spcServiceAccount,'delete', launchObjectDelete)

            // ClusterRole
            let spcClassClusterRole = spaces.get('classClusterRole')!
            setLeftItem(spcClassClusterRole, 'create', () => launchObjectCreate('ClusterRole'))
            let spcClusterRole = spaces.get('ClusterRole')!
            setLeftItem(spcClusterRole,'details', launchObjectDetails)
            setLeftItem(spcClusterRole,'edit', launchObjectEdit)
            setLeftItem(spcClusterRole,'delete', launchObjectDelete)

            // Role
            let spcClassRole = spaces.get('classRole')!
            setLeftItem(spcClassRole, 'create', () => launchObjectCreate('Role'))
            let spcRole = spaces.get('Role')!
            setLeftItem(spcRole,'details', launchObjectDetails)
            setLeftItem(spcRole,'edit', launchObjectEdit)
            setLeftItem(spcRole,'delete', launchObjectDelete)

            // ClusterRoleBinding
            let spcClassClusterRoleBinding = spaces.get('classClusterRoleBinding')!
            setLeftItem(spcClassClusterRoleBinding, 'create', () => launchObjectCreate('ClusterRoleBinding'))
            let spcClusterRoleBinding = spaces.get('ClusterRoleBinding')!
            setLeftItem(spcClusterRoleBinding,'details', launchObjectDetails)
            setLeftItem(spcClusterRoleBinding,'edit', launchObjectEdit)
            setLeftItem(spcClusterRoleBinding,'delete', launchObjectDelete)

            // RoleBinding
            let spcClassRoleBinding = spaces.get('classRoleBinding')!
            setLeftItem(spcClassRoleBinding, 'create', () => launchObjectCreate('RoleBinding'))
            let spcRoleBinding = spaces.get('RoleBinding')!
            setLeftItem(spcRoleBinding,'details', launchObjectDetails)
            setLeftItem(spcRoleBinding,'edit', launchObjectEdit)
            setLeftItem(spcRoleBinding,'delete', launchObjectDelete)


        // Custom

            // CustomResourceDefinition
            let spcClassCustomResourceDefinition = spaces.get('classCustomResourceDefinition')!
            setLeftItem(spcClassCustomResourceDefinition, 'create', () => launchObjectCreate('CustomResourceDefinition'))
            let spcCustomResourceDefinition = spaces.get('CustomResourceDefinition')!
            setLeftItem(spcCustomResourceDefinition,'details', launchObjectDetails)
            setLeftItem(spcCustomResourceDefinition,'edit', launchObjectEdit)
            setLeftItem(spcCustomResourceDefinition,'delete', launchObjectDelete)

            // crd instance
            let spcCrdInstance = spaces.get('crdinstance')!
            setLeftItem(spcCrdInstance, 'delete', launchObjectDelete)
            setLeftItem(spcCrdInstance, 'details', launchObjectDetails)

        let objSectionServiceAccount = objectSections.get('ServiceAccount')
        if (objSectionServiceAccount) {
            let item = objSectionServiceAccount[0].items.find(item => item.name === 'tokens')
            if (item) {
                item.invoke = (obj) => { 
                    let x = magnifyData.files.filter(f => f.data?.origin?.metadata?.annotations && f.data?.origin?.metadata?.namespace && f.data?.origin?.metadata?.annotations['kubernetes.io/service-account.name'] === "kwirth-sa" && f.data?.origin?.metadata?.namespace === obj.metadata.namespace)
                    return x.map(o => o.data.origin.metadata.name)
                }
            }
        }
        
        return () => {
            // unmount actions
            setLeftMenuAnchorParent(undefined)
        }
    }, [])

    // *********************************************************
    // Convenience functions for configuring item actions
    // *********************************************************
    const setPathFunction = (path:string, invoke:() => void) => {
        let x = magnifyData.files.find(f => f.path===path)
        if (x) x.children = invoke
    }

    const setPropertyFunction = (space:ISpace, propName:string, invoke:(p:string) => void) => {
        if (!space.properties) return
        let prop = space.properties.find(p => p.name===propName)
        if (!prop) return
        prop.format = 'function'
        prop.source = invoke
    }

    const setLeftItem = (space:ISpace, name:string, invoke:(paths:string[], target?:any) => void) => {
        let x = space.leftItems?.find(f => f.name===name)
        if (x) x.onClick = invoke
    }

    const onLeftItemMenuOptionSelected = (container:string) => {
        setLeftMenuAnchorParent(undefined)

        if (container==='*all') {
            setContentExternalView(InstanceConfigViewEnum.POD)
        }
        else {
            setContentExternalTitle(contentExternalTitle+'+'+container)
            setContentExternalContainer(container)
        }
        setContentExternalVisible(true)
    }

    const onLeftItemMenuClose = () => {
        setLeftMenuAnchorParent(undefined)
    }

    // *********************************************************
    // Actions
    // *********************************************************

    const launchObjectDetails = (p:string[]) => {
        let f = magnifyData.files.filter(x => p.includes(x.path))
        if (f[0].path.startsWith('/custom/') && !f[0].path.startsWith('/custom/CustomResourceDefinition/'))
            setDetailsSections(objectSections.get('#crdinstance#')!)
        else
            setDetailsSections(objectSections.get(f[0].data.origin.kind)!)

        // we request a fresh events list
        if (f[0].data.events) delete f[0].data.events
        sendCommand(MagnifyCommandEnum.EVENTS, [f[0].data.origin.metadata.namespace, f[0].data.origin.kind, f[0].data.origin.metadata.name])

        setSelectedFiles([f[0]])
        setContentDetailsVisible(true)
    }

    const launchObjectCreate = (kind:string) => {
        let template = templates.get(kind) || `apiVersion: v1\nKind: ${kind}\nejemplo: true`
        setSelectedFiles([])
        setContentEditNew(template.trim())
        setContentEditVisible(true)
    }

    const launchObjectEdit = (p:string[]) => {
        let f = magnifyData.files.filter(x => p.includes(x.path))
        setSelectedFiles([f[0]])
        setContentEditVisible(true)
    }

    const launchEditFromDetails = (p:string) => {
        let f = magnifyData.files.find(x => p===x.path)
        if (!f) return

        setSelectedFiles([f])
        setContentEditVisible(true)
    }

    const launchObjectDelete = (p:string[]) => {
        let f = magnifyData.files.filter(x => p.includes(x.path))
        setMsgBox(MsgBoxYesNo('Delete '+f[0].data.origin.kind,<Box>Are you sure you want to delete {f[0].data.origin.kind}<b> {f[0].name}</b>?</Box>, setMsgBox, (a) => {
            if (a === MsgBoxButtons.Yes) {
                sendCommand(MagnifyCommandEnum.DELETE, f.map(o => yamlParser.dump(o.data.origin, { indent: 2 })))
            }
        }))
    }

    const launchNamespaceCreate = (p:string[]) => {
        setIinputBoxResult ( () => (name:any) => {
            if (name) {
                let obj = `
                    apiVersion: 'v1'
                    kind: 'Namespace'
                    metadata:
                        name: ${name}
                `
                sendCommand(MagnifyCommandEnum.CREATE, [obj])
            }
        })
        setInputBoxMessage('Enter namespace name')
        setInputBoxTitle('Create namespace')
    }

    // Pod actions & info
    const launchPodEvict = (p:string[]) => {
        let f = magnifyData.files.filter(x => p.includes(x.path))
        setMsgBox(MsgBoxYesNo('Delete '+f[0].data.origin.kind,<Box>Are you sure you want to evict {f[0].data.origin.kind} <b>{f[0].name}</b>?</Box>, setMsgBox, (a) => {
            if (a === MsgBoxButtons.Yes) console.log('evict')
        }))
    }

    const launchPodLogs = (p:string[], currentTarget:Element) => {
        let f = magnifyData.files.filter(x => p.includes(x.path))
        setSelectedFiles(f)
        setContentExternalView(InstanceConfigViewEnum.CONTAINER)
        setContentExternalTitle(f[0].name)
        setContentExternalType('log')
        setLeftMenuContent(f[0])
        setLeftMenuIncludeAllContainers(true)
        setLeftMenuAnchorParent(currentTarget)
    }

    const launchPodShell = (p:string[], currentTarget:Element) => {
        let f = magnifyData.files.filter(x => p.includes(x.path))
        setSelectedFiles(f)
        setContentExternalView(InstanceConfigViewEnum.CONTAINER)
        setContentExternalTitle(f[0].name)
        setContentExternalType('ops')
        setLeftMenuContent(f[0])
        setLeftMenuIncludeAllContainers(false)
        setLeftMenuAnchorParent(currentTarget)

    }

    const launchPodMetrics = (p:string[], currentTarget:Element) => {
        let f = magnifyData.files.filter(x => p.includes(x.path))
        setSelectedFiles(f)
        setContentExternalView(InstanceConfigViewEnum.CONTAINER)
        setContentExternalTitle(f[0].name)
        setContentExternalType('metrics')
        setLeftMenuContent(f[0])
        setLeftMenuIncludeAllContainers(true)
        setLeftMenuAnchorParent(currentTarget)
    }

    const showPodContainers = (p:any) => {
        let f = magnifyData.files.find(x => p===x.path)
        if (!f) return
        if (!f.data?.origin?.status) return <></>
        let result:JSX.Element[]=[]
        if (f.data.origin.status.containerStatuses && f.data.origin.status.containerStatuses.length>0) {
            for (let c of f.data.origin.status.containerStatuses) {
                let color='orange'
                if (c.started) {
                    color='green'
                    if (f.data.origin.metadata.deletionTimestamp) color = 'blue'
                }
                else {
                    if (c.state.terminated) color = 'gray'
                }
                result.push(<Box sx={{ width: '8px', height: '8px', backgroundColor: color, margin: '1px', display: 'inline-block' }}/>)
            }
        }
        return result
    }

    const showPodCpu = (p:string) => {
        return '#'
    }

    const showPodMemory = (p:string) => {
        return '#'
    }

    // group actions
    const launchGroupScale = (p:string[]) => {
        let f = magnifyData.files.filter(x => p.includes(x.path))
        console.log('set sca')
    }

    const launchGroupRestart = (p:string[]) => {
        let f = magnifyData.files.filter(x => p.includes(x.path))
        console.log('set rest')
    }

    const launchGroupLogs = (p:string[]) => {
        let f = magnifyData.files.filter(x => p.includes(x.path))
        setContentExternalView(InstanceConfigViewEnum.GROUP)
        setContentExternalTitle(f[0].name)
        setSelectedFiles(f)
        setContentExternalType('log')
        setContentExternalVisible(true)
    }

    const launchGroupMetrics = (p:string[]) => {
        let f = magnifyData.files.filter(x => p.includes(x.path))
        //+++ falta decidir si nada, group o merge: neceistamos un pequeño menu en externlaContent
        setContentExternalView(InstanceConfigViewEnum.GROUP)
        setContentExternalTitle(f[0].name)
        setSelectedFiles(f)
        setContentExternalType('metrics')
        setContentExternalVisible(true)
    }

    const launchDaemonSetRestart = (p:string[]) => {
        let f = magnifyData.files.filter(x => p.includes(x.path))
        console.log('set rest')
    }

    const launchReplicaSetScale = (p:string[]) => {
        let f = magnifyData.files.filter(x => p.includes(x.path))
        console.log('set sca')
    }

    // Job actions
    const launchJobLogs = (p:string[]) => {
        let f = magnifyData.files.filter(x => p.includes(x.path))
        setContentExternalView(InstanceConfigViewEnum.GROUP)
        setContentExternalTitle(f[0].name)
        setSelectedFiles(f)
        setContentExternalType('log')
        setContentExternalVisible(true)
    }

    // IngressClass actions
    const launchIngressClassDefault = (p:string[]) => {
        let f = magnifyData.files.filter(x => p.includes(x.path))
        console.log('set def')
    }

    // Node actions
    const launchNodeDrain = (p:string[]) => {
        let f = magnifyData.files.filter(x => p.includes(x.path))
        sendCommand(MagnifyCommandEnum.NODE, ['drain',f[0].name])
    }

    const launchNodeCordon = (p:string[]) => {
        let f = magnifyData.files.filter(x => p.includes(x.path))
        sendCommand(MagnifyCommandEnum.NODE, ['cordon', f[0].name])
    }

    const launchNodeUnCordon = (p:string[]) => {
        let f = magnifyData.files.filter(x => p.includes(x.path))
        sendCommand(MagnifyCommandEnum.NODE, ['uncordon', f[0].name])
    }

    // CronJob actions
    const launchCronJobTrigger = (p:string[]) => {
        let f = magnifyData.files.filter(x => p.includes(x.path))
        sendCommand(MagnifyCommandEnum.CRONJOB, ['trigger', f[0].data.origin.metadata.namespace, f[0].data.origin.metadata.name])
    }

    const launchCronJobSuspend = (p:string[]) => {
        let f = magnifyData.files.filter(x => p.includes(x.path))
        sendCommand(MagnifyCommandEnum.CRONJOB, ['suspend', f[0].data.origin.metadata.namespace, f[0].data.origin.metadata.name])
    }

    const launchCronJobResume = (p:string[]) => {
        let f = magnifyData.files.filter(x => p.includes(x.path))
        sendCommand(MagnifyCommandEnum.CRONJOB, ['resume', f[0].data.origin.metadata.namespace, f[0].data.origin.metadata.name])
    }

    const showCronJobNextExecution = (p:string) => {
        let f = magnifyData.files.find(x => p===x.path)
        if (!f) return
        let x = getNextCronExecution(f.data.origin.spec.schedule)
        return [`${x?.timeLeft.days}d${x?.timeLeft.hours}h${x?.timeLeft.minutes}m${x?.timeLeft.seconds}s`]
    }

    // handlers for showing general data inside filemanager
    const showOverview = () => {
        if (!magnifyData.clusterInfo) return <></>
        return <Box sx={{m:1}}>
            <Card>
                <CardHeader title={'Cluser Info'} />
                <CardContent>
                    <Typography>Version: {magnifyData.clusterInfo.major}.{magnifyData.clusterInfo.minor}&nbsp;&nbsp;({magnifyData.clusterInfo.gitVersion})</Typography>
                    <Typography>Platform: {magnifyData.clusterInfo.platform}</Typography>
                    <Divider sx={{mt:2, mb:2}}/>
                    <Typography>Nodes: {magnifyData.files.filter(f => f.class==='Node').length}</Typography>
                </CardContent>

            </Card>
        </Box>

    }

    const showClusterOverview = () => {
        return <Box sx={{m:1}}>
            <Card>
                <CardHeader title={'Cluster overview'}/>
                <CardContent>
                    <Typography>Total CPU: {magnifyData.files.filter(f => f.class==='Node').reduce ((ac,v) => ac + +v.data.origin.status.capacity.cpu,0)}</Typography>
                    <Typography>Total Memory: {convertBytesToSize (magnifyData.files.filter(f => f.class==='Node').reduce ((ac,v) => ac + convertSizeToBytes(v.data.origin.status.capacity.memory),0))}</Typography>
                    <Divider sx={{mt:2, mb:2}}/>
                    <Typography>Actual pods: {magnifyData.files.filter(f => f.class==='Pod').length}</Typography>
                    <Typography>Max pods: {magnifyData.files.filter(f => f.class==='Node').reduce ((ac,v) => ac + +v.data.origin.status.capacity.pods,0)}</Typography>
                </CardContent>
            </Card>
        </Box>
    }

    const showWorkloadOverview = () => {
        return <Box sx={{m:1}}>
            <Card>
                <CardHeader title={'Workload overview'}>

                </CardHeader>
                <CardContent>
                    <Typography>Pods: {magnifyData.files.filter(f => f.class==='Pod').length}</Typography>
                    <Divider sx={{mt:2, mb:2}}/>
                    <Typography>Deployments: {magnifyData.files.filter(f => f.class==='Deployment').length}</Typography>
                    <Typography>Daemon sets: {magnifyData.files.filter(f => f.class==='DaemonSet').length}</Typography>
                    <Typography>Replica sets: {magnifyData.files.filter(f => f.class==='ReplicaSet').length}</Typography>
                    <Typography>Replication Controllers: {magnifyData.files.filter(f => f.class==='ReplicationController').length}</Typography>
                    <Typography>Stateful sets: {magnifyData.files.filter(f => f.class==='StatefulSet').length}</Typography>
                    <Divider sx={{mt:2, mb:2}}/>
                    <Typography>Jobs: {magnifyData.files.filter(f => f.class==='Job').length}</Typography>
                    <Typography>Cron jobs: {magnifyData.files.filter(f => f.class==='CronJob').length}</Typography>
                </CardContent>

            </Card>
        </Box>
    }

    const showConfigOverview = () => {
        return <Box sx={{m:1}}>
            <Card>
                <CardHeader title={'Config overview'}>

                </CardHeader>
                <CardContent>
                    <Typography>ConfigMap: {magnifyData.files.filter(f => f.class==='ConfigMap').length}</Typography>
                    <Typography>Secret: {magnifyData.files.filter(f => f.class==='Secret').length}</Typography>
                </CardContent>

            </Card>
        </Box>
    }

    const showNetworkOverview = () => {
        return <Box sx={{m:1}}>
            <Card>
                <CardHeader title={'Config overview'}>

                </CardHeader>
                <CardContent>
                    <Typography>Services: {magnifyData.files.filter(f => f.class==='Service').length}</Typography>
                    <Divider sx={{mt:2, mb:2}}/>
                    <Typography>Ingresses: {magnifyData.files.filter(f => f.class==='Ingress').length}</Typography>
                    <Typography>Ingress classes: {magnifyData.files.filter(f => f.class==='IngressClass').length}</Typography>
                </CardContent>

            </Card>
        </Box>
    }

    const showStorageOverview = () => {
        return <Box sx={{m:1}}>
            <Card>
                <CardHeader title={'Storage overview'}>

                </CardHeader>
                <CardContent>
                    <Typography>Total PVC's: {magnifyData.files.filter(f => f.class==='PersistentVolumeClaim').length}</Typography>
                    <Typography>Total storage: {convertBytesToSize(magnifyData.files.filter(f => f.class==='PersistentVolumeClaim').reduce((ac, v) => convertSizeToBytes(v.data.size), 0))}</Typography>
                </CardContent>

            </Card>
        </Box>
    }

    const showSettings = () => {
        return <UserSettings settings={settings} files={magnifyData.files} onReload={onUserSettingsReload}/>
    }

    const onUserSettingsReload = () => {
        magnifyData.files = magnifyData.files.filter(f => f.isDirectory && f.path.split('/').length-1 <= 2)
        magnifyData.files = magnifyData.files.filter(f => f.class!=='crdgroup')
        console.log(magnifyData.files)
        magnifyData.currentPath='/overview'
        requestList(props.channelObject)
    }

    const sendCommand = (command: MagnifyCommandEnum, params:string[]) => {
        if (!props.channelObject.webSocket) return
        
        let magnifyMessage:IMagnifyMessage = {
            flow: InstanceMessageFlowEnum.REQUEST,
            action: InstanceMessageActionEnum.COMMAND,
            channel: 'magnify',
            type: InstanceMessageTypeEnum.DATA,
            accessKey: props.channelObject.accessString!,
            instance: props.channelObject.instanceId,
            id: uuid(),
            command: command,
            namespace: '',
            group: '',
            pod: '',
            container: '',
            params: params,
            msgtype: 'magnifymessage'
        }
        let payload = JSON.stringify( magnifyMessage )
        props.channelObject.webSocket.send(payload)
    }

    // FileManager handlers
    const onError = (error: IError, file: IFileObject) => {
        let uiConfig = props.channelObject.config as IMagnifyConfig
        uiConfig.notify(ENotifyLevel.ERROR, error.message)
    }

    const onFolderChange = (folder:string) => {
        magnifyData.currentPath = folder
    }

    // callback handlers for object details
    const onMagnifyObjectDetailsChangeData = (src:string, data:any) => {
        //setDetailsChanges( _.set(detailsChanges, src, data))
    }

    const onMagnifyObjectDetailsLink = (kind:string, name:string) => {
        setContentDetailsVisible(false)
        let path = buildPath(kind, name)
        let f = magnifyData.files.find(f => f.path === path)
        if (f)
            launchObjectDetails([f.path])
        else
            setMsgBox(MsgBoxOkError('Object details',<Box>Object with name '<b>{name}</b>' of kind '{kind}' has not been found on artifacts database.</Box>, setMsgBox))
    }

    // ContentExternal
    const onContentExternalClose = (content:IContentExternalObject) => {
        let i = magnifyData.contentWindows.indexOf(content)
        if (i>=0) magnifyData.contentWindows.splice(i,1)
        contentWindowId.current = -1
        setContentExternalContainer('')
        setContentExternalType('')
        setContentExternalVisible(false)
    }

    const onContentExternalMinimize = (content:IContentExternalObject) => {
        if (!magnifyData.contentWindows.includes(content)) magnifyData.contentWindows.push(content)
        contentWindowId.current = -1
        setContentExternalContainer('')
        setContentExternalType('')
        setContentExternalVisible(false)
    }

    const onContentExternalRestore = (index:number) => {
        contentWindowId.current = index
        flushSync(() => setContentExternalVisible(true) )
        setRefresh(Math.random())
    }

    const onContentExternalRefresh = () => {
        setRefresh(Math.random())
    }

    // ContentEdit
    const onContentEditClose = (content:IContentEditObject) => {
        let i = magnifyData.contentWindows.indexOf(content)
        if (i>=0) magnifyData.contentWindows.splice(i,1)
        contentWindowId.current = -1
        setContentEditVisible(false)
    }

    const onContentEditMinimize = (content:IContentEditObject) => {
        if (!magnifyData.contentWindows.includes(content)) magnifyData.contentWindows.push(content)
        contentWindowId.current = -1
        setContentEditVisible(false)
    }

    const onContentEditRestore = (index:number) => {
        contentWindowId.current = index
        setContentEditVisible(true)
        setRefresh(Math.random())
    }

    const onContentEditOk = (content:{code:string, source?:IFileObject}) => {
        setContentEditVisible(false)
        sendCommand(MagnifyCommandEnum.APPLY, [content.code])
    }

    // ContentDetails
    const onContentDetailsClose = (content:IContentDetailsObject) => {
        let i = magnifyData.contentWindows.indexOf(content)
        if (i>=0) magnifyData.contentWindows.splice(i,1)
        contentWindowId.current = -1
        setContentDetailsVisible(false)
    }

    const onContentDetailsMinimize = (content:IContentDetailsObject) => {
        if (!magnifyData.contentWindows.includes(content)) magnifyData.contentWindows.push(content)
        contentWindowId.current = -1
        setContentDetailsVisible(false)
    }

    const onContentDetailsRestore = (index:number) => {
        contentWindowId.current = index
        setContentDetailsVisible(true)
        setRefresh(Math.random())
    }

    const onContentDetailsOk = (content:{code:string, source?:IFileObject}) => {
        setContentDetailsVisible(false)
        sendCommand(MagnifyCommandEnum.APPLY, [content.code])
    }

    const onContentDetailsApply = () => {
        // +++ lanzar oncontentEditOk
    }

    const onContentExternalNotify = (level: ENotifyLevel, msg: string)  => {
        msg = 'Channel message: '+ msg;
        (props.channelObject.config as IMagnifyConfig).notify(level, msg)
    }

    return <>
        { magnifyData.started &&
            <Box ref={magnifyBoxRef} sx={{ display:'flex', flexDirection:'column', overflowY:'auto', overflowX:'hidden', flexGrow:1, height: `${magnifyBoxHeight}px`, ml:1, mr:1}}>
                <FileManager
                    files={magnifyData.files}
                    spaces={spaces}
                    actions={actions}
                    icons={icons}
                    initialPath={magnifyData.currentPath}
                    layout='list'
                    enableFilePreview={false}
                    onCreateFolder={undefined}
                    onError={onError}
                    onRename={undefined}
                    onPaste={undefined}
                    onDelete={() => {}}
                    onFolderChange={onFolderChange}
                    onRefresh={undefined}
                    permissions={permissions}
                    filePreviewPath='http://avoid-console-error'
                    primaryColor='#1976d2'
                    fontFamily='Roboto, Helvetica, Arial, sans-serif'
                    height='100%'
                    className='custom-fm'
                    search='auto'
                    searchRegex={true}
                    searchCasing={true}
                />
                {
                    leftMenuAnchorParent && <LeftItemMenu f={leftMenuContent} onClose={onLeftItemMenuClose} onOptionSelected={onLeftItemMenuOptionSelected} anchorParent={leftMenuAnchorParent} includeAllContainers={leftMenuIncludeAllContainers} />
                }
                <Stack direction={'row'} sx={{mt:1}}>
                    {
                        magnifyData.contentWindows.map((ec, index) => {
                            switch (ec.type) {
                                case 'external':
                                    let extcon = ec as IContentExternalObject
                                    let text = extcon.channelObject.container
                                    if (text.length>20) text = text.substring(0,10) + '...' + text.substring(text.length-10)
                                    // +++ add a preview of terminal using: https://www.npmjs.com/package/html-to-image
                                    return (
                                        <Tooltip key={index} title={<>Pod: {extcon.channelObject.pod}{extcon.channelObject.container!==''? <><br/>Container: {extcon.channelObject.container}</>: <></>}</>}>
                                            <Button onClick={() => onContentExternalRestore(index)}>
                                                {extcon.channel.getChannelIcon()}
                                                {text}
                                            </Button>
                                        </Tooltip>
                                    )
                                case 'edit':
                                    let extconed = ec as IContentEditObject
                                    let texted = extconed.content.title ||''
                                    let short = texted
                                    if (short.length>20) short = short.substring(0,10) + '...' + short.substring(short.length-10)
                                    return (
                                        <Tooltip key={index} title={texted}>
                                            <Button onClick={() => onContentEditRestore(index)}>
                                                <Edit/>
                                                {short}
                                            </Button>
                                        </Tooltip>
                                    )
                                case 'details':
                                    let extcondet = ec as IContentDetailsObject
                                    let textdet = extcondet.content.title || ''
                                    let shortdet = textdet
                                    if (shortdet.length>20) shortdet = shortdet.substring(0,10) + '...' + shortdet.substring(shortdet.length-10)
                                    return (
                                        <Tooltip key={index} title={textdet}>
                                            <Button onClick={() => onContentDetailsRestore(index)}>
                                                <List/>
                                                {shortdet}
                                            </Button>
                                        </Tooltip>
                                    )
                                default:
                                    return <></>
                            }
                        })
                    }
                </Stack>
                { msgBox }
                <InputBox title={inputBoxTitle} message={inputBoxMessage} onClose={() => setInputBoxTitle(undefined)} onResult={inputBoxResult}/>
            </Box>
        }

        { contentDetailsVisible &&
            <ContentDetails
                content={contentWindowId.current>=0 ? magnifyData.contentWindows[contentWindowId.current] as IContentDetailsObject : undefined}
                selectedFile={contentWindowId.current<0 && selectedFiles.length>0? selectedFiles[0] : undefined}
                sections={detailsSections}
                onMinimize={onContentDetailsMinimize}
                onClose={onContentDetailsClose}
                onApply={onContentDetailsApply}
                onEdit={(path:string) => launchEditFromDetails(path)}
                onDelete={(path:string) => launchObjectDelete([path])}
                data-refresh={refresh}
            />
        }
        
        { contentExternalVisible && 
            <ContentExternal 
                content={contentWindowId.current<0 ? undefined : magnifyData.contentWindows[contentWindowId.current] as IContentExternalObject}
                channelObject={props.channelObject}
                channelId={contentExternalType}
                title={contentExternalTitle}
                selectedFiles={selectedFiles}
                frontChannels={props.channelObject.frontChannels!}
                onClose={onContentExternalClose}
                onMinimize={onContentExternalMinimize}
                onRefresh={onContentExternalRefresh}
                onNotify={onContentExternalNotify}
                contentView={contentExternalView}
                data-refresh={refresh}
                container={contentExternalContainer}
                settings={settings}/>
        }

        { contentEditVisible &&
            <ContentEdit 
                content={contentWindowId.current<0? undefined : magnifyData.contentWindows[contentWindowId.current] as IContentEditObject}
                selectedFile={selectedFiles.length>0? selectedFiles[0]: undefined}
                newContent={contentWindowId.current>=0 || selectedFiles.length>0? undefined : contentEditNew}
                onMinimize={onContentEditMinimize}
                onClose={onContentEditClose}
                onOk={onContentEditOk}
            />
        }

    </>
}
export { MagnifyTabContent }