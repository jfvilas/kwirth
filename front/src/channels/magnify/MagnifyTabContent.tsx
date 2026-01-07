import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { IContentProps } from '../IChannel'
import { MagnifyCommandEnum, IMagnifyMessage, IMagnifyData } from './MagnifyData'
import { Box, Button, Card, CardContent, CardHeader, Dialog, DialogActions, DialogContent, DialogTitle, Divider, IconButton, Stack, Tooltip, Typography } from '@mui/material'
import { InstanceConfigViewEnum, InstanceMessageActionEnum, InstanceMessageFlowEnum, InstanceMessageTypeEnum } from '@jfvilas/kwirth-common'
import { IError, IFileObject, ISpace } from '@jfvilas/react-file-manager'
import { FileManager } from '@jfvilas/react-file-manager'
import { v4 as uuid } from 'uuid'
import { IMagnifyConfig } from './MagnifyConfig'
import { ENotifyLevel } from '../../tools/Global'
import '@jfvilas/react-file-manager/dist/style.css'
import './custom-fm.css'
import { actions, icons, menu, spaces } from './RFMConfig'
import CodeMirror from '@uiw/react-codemirror';
import { yaml } from '@codemirror/lang-yaml'
import React from 'react'
import { IDetailsSection, MagnifyObjectDetails } from './components/DetailsObject'
import { objectSections } from './components/DetailsSections'
import { Close, ContentCopy, Delete, Edit, ExpandMore } from '@mui/icons-material'
import { MsgBoxButtons, MsgBoxYesNo } from '../../tools/MsgBox'
import { ExternalContent, IExternalContentObject } from './components/ExternalContent'
import { flushSync } from 'react-dom'
import { LeftItemMenu } from './LeftItemMenu'
import { MagnifyUserSettings } from './MagnifyUserSettings'
import { UserSettings } from './components/UserSettings'

const _ = require('lodash')
const copy = require('clipboard-copy')

const yamlParser = require('js-yaml');
const settings = new MagnifyUserSettings()

const MagnifyTabContent: React.FC<IContentProps> = (props:IContentProps) => {
    let magnifyData:IMagnifyData = props.channelObject.data
    let permissions={
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

    const [editorVisible, setEditorVisible] = useState(false)
    const [editorContent, setEditorContent] = useState<{code:string, source?:IFileObject}>({code:''})

    const externalContentId = useRef<number>(-1)
    const [externalContentVisible, setExternalContentVisible] = useState<boolean>(false)
    const [externalContentType, setExternalContentType] = useState<string>('')
    const [externalContentView, setExternalContentView] = useState<InstanceConfigViewEnum>(InstanceConfigViewEnum.POD)
    const [externalContentTitle, setExternalContentTitle] = useState<string>('n/a')
    const [externalContentContainer, setExternalContentContainer] = useState<string>('')

    const [selectedFiles, setSelectedFiles] = useState<IFileObject[]>([])

    const [leftMenuContent, setLeftMenuContent] = useState<any>()
    const [leftMenuIncludeAll, setLeftMenuIncludeAll] = useState<boolean>(false)
    const [leftMenuAnchorParent, setLeftMenuAnchorParent] = useState<Element>()
    
    const [detailsVisible, setDetailsVisible] = useState(false)
    const [detailsContent, setDetailsContent] = useState<any>()
    const [detailsSections, setDetailsSections] = useState<IDetailsSection[]>([])
    const [detailsChanges, setDetailsChanges] = useState({})

    const [refresh, setRefresh] = useState<number>(0)

    useLayoutEffect(() => {
        const observer = new ResizeObserver(() => {
            if (!magnifyBoxRef.current) return
            const { top } = magnifyBoxRef.current.getBoundingClientRect()
            let a = window.innerHeight - top - 160
            // if (props.maxHeight>=0 && a > props.maxHeight) a = props.maxHeight
            setMagnifyBoxHeight(a)
        })
        observer.observe(document.body)

        return () => observer.disconnect()
    }, [magnifyBoxRef.current])

    useEffect(() => {
        console.log('FIRST MOUNT')
        if (!magnifyData.files.some(f => f.path ==='/overview')) {
            console.log('FIRST TIME')
            magnifyData.files.push(...menu)
        }

        // Main menu
            setPathFunction('/overview', showOverview)
            setPathFunction('/settings', showSettings)
            setPathFunction('/cluster/overview', showClusterOverview)
            setPathFunction('/workload/overview', showWorkloadOverview)
            setPathFunction('/network/overview', showNetworkOverview)
            setPathFunction('/config/overview', showConfigOverview)
            setPathFunction('/storage/overview', showStorageOverview)

        // Workload
            // Pod
            let spcClassPod = spaces.get('classPod')!
            setLeftItem(spcClassPod, 'create', () => launchCreate('Pod'))
            let spcPod = spaces.get('Pod')!
            setPropertyFunction(spcPod, 'container', showPodContainers)
            setPropertyFunction(spcPod, 'cpu', showPodCpu)
            setPropertyFunction(spcPod, 'memory', showPodMemory)
            setLeftItem(spcPod,'viewlog', launchPodLog)
            setLeftItem(spcPod,'viewmetrics', launchPodMetrics)
            setLeftItem(spcPod,'shell', launchPodShell)
            setLeftItem(spcPod,'details', launchObjectDetails)
            setLeftItem(spcPod,'delete', launchObjectDelete)
            setLeftItem(spcPod,'evict', launchPodEvict)

            let spcClassDeployment = spaces.get('classDeployment')!
            setLeftItem(spcClassDeployment, 'create', () => launchCreate('classDeployment'))
            let spcDeployment = spaces.get('Deployment')!
            setLeftItem(spcDeployment,'details', launchObjectDetails)
            setLeftItem(spcDeployment,'scale', launchDeploymentScale)
            setLeftItem(spcDeployment,'restart', launchDeploymentRestart)
            setLeftItem(spcDeployment,'logs', launchDeploymentLogs)
            setLeftItem(spcDeployment,'edit', launchObjectEdit)
            setLeftItem(spcDeployment,'delete', launchObjectDelete)
            
            let spcClassDaemonSet = spaces.get('classDaemonSet')!
            setLeftItem(spcClassDaemonSet, 'create', () => launchCreate('classDaemonSet'))
            let spcDaemonSet = spaces.get('DaemonSet')!
            setLeftItem(spcDaemonSet,'details', launchObjectDetails)
            setLeftItem(spcDaemonSet,'restart', launchDaemonSetRestart)
            setLeftItem(spcDaemonSet,'logs', launchDaemonSetLogs)
            setLeftItem(spcDaemonSet,'edit', launchObjectEdit)
            setLeftItem(spcDaemonSet,'delete', launchObjectDelete)
            
            let spcClassReplicaSet = spaces.get('classReplicaSet')!
            setLeftItem(spcClassReplicaSet, 'create', () => launchCreate('classReplicaSet'))
            let spcReplicaSet = spaces.get('ReplicaSet')!
            setLeftItem(spcReplicaSet,'details', launchObjectDetails)
            setLeftItem(spcReplicaSet,'scale', launchReplicaSetScale)
            setLeftItem(spcReplicaSet,'logs', launchReplicaSetLogs)
            setLeftItem(spcReplicaSet,'edit', launchObjectEdit)
            setLeftItem(spcReplicaSet,'delete', launchObjectDelete)
            
            let spcClassJob = spaces.get('classJob')!
            setLeftItem(spcClassJob, 'create', () => launchCreate('classJob'))
            let spcJob = spaces.get('Job')!
            setLeftItem(spcJob,'details', launchObjectDetails)
            setLeftItem(spcJob,'logs', launchJobLogs)
            setLeftItem(spcJob,'edit', launchObjectEdit)
            setLeftItem(spcJob,'delete', launchObjectDelete)

            let spcClassCronJob = spaces.get('classCronJob')!
            setLeftItem(spcClassCronJob, 'create', () => launchCreate('classCronJob'))
            let spcCronJob = spaces.get('CronJob')!
            setLeftItem(spcCronJob,'trigger', launchCronJobTrigger)
            setLeftItem(spcCronJob,'suspend', launchCronJobSuspend)
            setLeftItem(spcCronJob,'details', launchObjectDetails)
            setLeftItem(spcCronJob,'edit', launchObjectEdit)
            setLeftItem(spcCronJob,'delete', launchObjectDelete)


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
            setLeftItem(spcClassNamespace, 'create', () => launchCreate('Namespace'))
            let spcNamespace = spaces.get('Namespace')!
            setLeftItem(spcNamespace,'details', launchObjectDetails)
            setLeftItem(spcNamespace,'edit', launchObjectEdit)
            setLeftItem(spcNamespace,'delete', launchObjectDelete)

        // Network

            // Service
            let spcClassService = spaces.get('classService')!
            setLeftItem(spcClassService, 'create', () => launchCreate('Service'))
            let spcService = spaces.get('Service')!
            setLeftItem(spcService,'details', launchObjectDetails)
            setLeftItem(spcService,'edit', launchObjectEdit)
            setLeftItem(spcService,'delete', launchObjectDelete)

            // Endpoints
            let spcClassEndpoints = spaces.get('classEndpoints')!
            setLeftItem(spcClassEndpoints, 'create', () => launchCreate('Endpoints'))
            let spcEndpoints = spaces.get('Endpoints')!
            setLeftItem(spcEndpoints,'details', launchObjectDetails)
            setLeftItem(spcEndpoints,'edit', launchObjectEdit)
            setLeftItem(spcEndpoints,'delete', launchObjectDelete)


            // Ingress
            let spcClassIngress = spaces.get('classIngress')!
            setLeftItem(spcClassIngress, 'create', () => launchCreate('Ingress'))
            let spcIngress = spaces.get('Ingress')!
            setLeftItem(spcIngress,'details', launchObjectDetails)
            setLeftItem(spcIngress,'edit', launchObjectEdit)
            setLeftItem(spcIngress,'delete', launchObjectDelete)

            // IngressClass
            let spcClassIngressClass = spaces.get('classIngressClass')!
            setLeftItem(spcClassIngressClass, 'create', () => launchCreate('IngressClass'))
            let spcIngressClass = spaces.get('IngressClass')!
            setLeftItem(spcIngressClass,'default', launchIngressClassDefault)
            setLeftItem(spcIngressClass,'details', launchObjectDetails)
            setLeftItem(spcIngressClass,'edit', launchObjectEdit)
            setLeftItem(spcIngressClass,'delete', launchObjectDelete)

            // NetworkPolicy
            let spcClassNetworkPolicy = spaces.get('classNetworkPolicy')!
            setLeftItem(spcClassNetworkPolicy, 'create', () => launchCreate('NetworkPolicy'))
            let spcNetworkPolicy = spaces.get('NetworkPolicy')!
            setLeftItem(spcNetworkPolicy,'details', launchObjectDetails)
            setLeftItem(spcNetworkPolicy,'edit', launchObjectEdit)
            setLeftItem(spcNetworkPolicy,'delete', launchObjectDelete)

        // Config

            // ConfigMap
            let spcClassConfigMap = spaces.get('classConfigMap')!
            setLeftItem(spcClassConfigMap, 'create', () => launchCreate('ConfigMap'))
            let spcConfigMap = spaces.get('ConfigMap')!
            setLeftItem(spcConfigMap,'details', launchObjectDetails)
            setLeftItem(spcConfigMap,'edit', launchObjectEdit)
            setLeftItem(spcConfigMap,'delete', launchObjectDelete)

            let spcClassSecret = spaces.get('classSecret')!
            setLeftItem(spcClassSecret, 'create', () => launchCreate('Secret'))
            let spcSecret = spaces.get('Secret')!
            setLeftItem(spcSecret,'details', launchObjectDetails)
            setLeftItem(spcSecret,'edit', launchObjectEdit)
            setLeftItem(spcSecret,'delete', launchObjectDelete)

            let spcClassResourceQuota = spaces.get('classResourceQuota')!
            setLeftItem(spcClassResourceQuota, 'create', () => launchCreate('ResourceQuota'))
            let spcResourceQuota = spaces.get('ResourceQuota')!
            setLeftItem(spcResourceQuota,'details', launchObjectDetails)
            setLeftItem(spcResourceQuota,'edit', launchObjectEdit)
            setLeftItem(spcResourceQuota,'delete', launchObjectDelete)

            let spcClassLimitRange = spaces.get('classLimitRange')!
            setLeftItem(spcClassLimitRange, 'create', () => launchCreate('LimitRange'))
            let spcLimitRange = spaces.get('LimitRange')!
            setLeftItem(spcLimitRange,'details', launchObjectDetails)
            setLeftItem(spcLimitRange,'edit', launchObjectEdit)
            setLeftItem(spcLimitRange,'delete', launchObjectDelete)

            let spcClassHorizontalPodAutoscaler = spaces.get('classHorizontalPodAutoscaler')!
            setLeftItem(spcClassHorizontalPodAutoscaler, 'create', () => launchCreate('HorizontalPodAutoscaler'))
            let spcHorizontalPodAutoscaler = spaces.get('HorizontalPodAutoscaler')!
            setLeftItem(spcHorizontalPodAutoscaler,'details', launchObjectDetails)
            setLeftItem(spcHorizontalPodAutoscaler,'edit', launchObjectEdit)
            setLeftItem(spcHorizontalPodAutoscaler,'delete', launchObjectDelete)

            let spcClassPodDisruptionBudget = spaces.get('classPodDisruptionBudget')!
            setLeftItem(spcClassPodDisruptionBudget, 'create', () => launchCreate('PodDisruptionBudget'))
            let spcPodDisruptionBudget = spaces.get('PodDisruptionBudget')!
            setLeftItem(spcPodDisruptionBudget,'details', launchObjectDetails)
            setLeftItem(spcPodDisruptionBudget,'edit', launchObjectEdit)
            setLeftItem(spcPodDisruptionBudget,'delete', launchObjectDelete)

            let spcClassPriorityClass = spaces.get('classPriorityClass')!
            setLeftItem(spcClassPriorityClass, 'create', () => launchCreate('PriorityClass'))
            let spcPriorityClass = spaces.get('PriorityClass')!
            setLeftItem(spcPriorityClass,'details', launchObjectDetails)
            setLeftItem(spcPriorityClass,'edit', launchObjectEdit)
            setLeftItem(spcPriorityClass,'delete', launchObjectDelete)

            let spcClassRuntimeClass = spaces.get('classRuntimeClass')!
            setLeftItem(spcClassRuntimeClass, 'create', () => launchCreate('RuntimeClass'))
            let spcRuntimeClass = spaces.get('RuntimeClass')!
            setLeftItem(spcRuntimeClass,'details', launchObjectDetails)
            setLeftItem(spcRuntimeClass,'edit', launchObjectEdit)
            setLeftItem(spcRuntimeClass,'delete', launchObjectDelete)

            let spcClassLease = spaces.get('classLease')!
            setLeftItem(spcClassLease, 'create', () => launchCreate('Lease'))
            let spcLease = spaces.get('Lease')!
            setLeftItem(spcLease,'details', launchObjectDetails)
            setLeftItem(spcLease,'edit', launchObjectEdit)
            setLeftItem(spcLease,'delete', launchObjectDelete)

            let spcClassValidatingWebhookConfiguration = spaces.get('classValidatingWebhookConfiguration')!
            setLeftItem(spcClassValidatingWebhookConfiguration, 'create', () => launchCreate('ValidatingWebhookConfiguration'))
            let spcValidatingWebhookConfiguration = spaces.get('ValidatingWebhookConfiguration')!
            setLeftItem(spcValidatingWebhookConfiguration,'details', launchObjectDetails)
            setLeftItem(spcValidatingWebhookConfiguration,'edit', launchObjectEdit)
            setLeftItem(spcValidatingWebhookConfiguration,'delete', launchObjectDelete)
            
            let spcClassMutatingWebhookConfiguration = spaces.get('classMutatingWebhookConfiguration')!
            setLeftItem(spcClassMutatingWebhookConfiguration, 'create', () => launchCreate('MutatingWebhookConfiguration'))
            let spcMutatingWebhookConfiguration = spaces.get('MutatingWebhookConfiguration')!
            setLeftItem(spcMutatingWebhookConfiguration,'details', launchObjectDetails)
            setLeftItem(spcMutatingWebhookConfiguration,'edit', launchObjectEdit)
            setLeftItem(spcMutatingWebhookConfiguration,'delete', launchObjectDelete)
            
        // Storage

            // StorageClass
            let spcClassStorageClass = spaces.get('classStorageClass')!
            setLeftItem(spcClassStorageClass, 'create', () => launchCreate('StorageClass'))
            let spcStorageClass = spaces.get('StorageClass')!
            setLeftItem(spcStorageClass,'details', launchObjectDetails)
            setLeftItem(spcStorageClass,'edit', launchObjectEdit)
            setLeftItem(spcStorageClass,'delete', launchObjectDelete)

            // PersistentVolumeClaim
            let spcClassPersistentVolumeClaim = spaces.get('classPersistentVolumeClaim')!
            setLeftItem(spcClassPersistentVolumeClaim, 'create', () => launchCreate('PersistentVolumeClaim'))
            let spcPersistentVolumeClaim = spaces.get('PersistentVolumeClaim')!
            setLeftItem(spcPersistentVolumeClaim,'details', launchObjectDetails)
            setLeftItem(spcPersistentVolumeClaim,'edit', launchObjectEdit)
            setLeftItem(spcPersistentVolumeClaim,'delete', launchObjectDelete)

            // PersistentVolume
            let spcClassPersistentVolume = spaces.get('classPersistentVolume')!
            setLeftItem(spcClassPersistentVolume, 'create', () => launchCreate('PersistentVolume'))
            let spcPersistentVolume = spaces.get('PersistentVolume')!
            setLeftItem(spcPersistentVolume,'details', launchObjectDetails)
            setLeftItem(spcPersistentVolume,'edit', launchObjectEdit)
            setLeftItem(spcPersistentVolume,'delete', launchObjectDelete)

        // Access

            // ServiceAccount
            let spcClassServiceAccount = spaces.get('classServiceAccount')!
            setLeftItem(spcClassServiceAccount, 'create', () => launchCreate('ServiceAccount'))
            let spcServiceAccount = spaces.get('ServiceAccount')!
            setLeftItem(spcServiceAccount,'details', launchObjectDetails)
            setLeftItem(spcServiceAccount,'edit', launchObjectEdit)
            setLeftItem(spcServiceAccount,'delete', launchObjectDelete)

            // ClusterRole
            let spcClassClusterRole = spaces.get('classClusterRole')!
            setLeftItem(spcClassClusterRole, 'create', () => launchCreate('ClusterRole'))
            let spcClusterRole = spaces.get('ClusterRole')!
            setLeftItem(spcClusterRole,'details', launchObjectDetails)
            setLeftItem(spcClusterRole,'edit', launchObjectEdit)
            setLeftItem(spcClusterRole,'delete', launchObjectDelete)

            // Role
            let spcClassRole = spaces.get('classRole')!
            setLeftItem(spcClassRole, 'create', () => launchCreate('Role'))
            let spcRole = spaces.get('Role')!
            setLeftItem(spcRole,'details', launchObjectDetails)
            setLeftItem(spcRole,'edit', launchObjectEdit)
            setLeftItem(spcRole,'delete', launchObjectDelete)

            // ClusterRoleBinding
            let spcClassClusterRoleBinding = spaces.get('classClusterRoleBinding')!
            setLeftItem(spcClassClusterRoleBinding, 'create', () => launchCreate('ClusterRoleBinding'))
            let spcClusterRoleBinding = spaces.get('ClusterRoleBinding')!
            setLeftItem(spcClusterRoleBinding,'details', launchObjectDetails)
            setLeftItem(spcClusterRoleBinding,'edit', launchObjectEdit)
            setLeftItem(spcClusterRoleBinding,'delete', launchObjectDelete)

            // RoleBinding
            let spcClassRoleBinding = spaces.get('classRoleBinding')!
            setLeftItem(spcClassRoleBinding, 'create', () => launchCreate('RoleBinding'))
            let spcRoleBinding = spaces.get('RoleBinding')!
            setLeftItem(spcRoleBinding,'details', launchObjectDetails)
            setLeftItem(spcRoleBinding,'edit', launchObjectEdit)
            setLeftItem(spcRoleBinding,'delete', launchObjectDelete)


        // Custom

            // CustomResourceDefinition
            let spcClassCustomResourceDefinition = spaces.get('classCustomResourceDefinition')!
            setLeftItem(spcClassCustomResourceDefinition, 'create', () => launchCreate('CustomResourceDefinition'))
            let spcCustomResourceDefinition = spaces.get('CustomResourceDefinition')!
            setLeftItem(spcCustomResourceDefinition,'details', launchObjectDetails)
            setLeftItem(spcCustomResourceDefinition,'edit', launchObjectEdit)
            setLeftItem(spcCustomResourceDefinition,'delete', launchObjectDelete)

            // crd instance
            let spcCrdInstance = spaces.get('crdinstance')!
            setLeftItem(spcCrdInstance, 'delete', launchObjectDelete)


        return () => {
            // unmount actions
            console.log('UNMOUNT')
            setLeftMenuAnchorParent(undefined)
        }
    }, [])

    const applyEditorChanges = () => {
        setEditorVisible(false)
        sendCommand(MagnifyCommandEnum.CREATE, [editorContent.code])
    }

    const updateEditorValue= (newCode:any) => {
        editorContent.code=newCode
    }

    const launchObjectEdit = (f:IFileObject[]) => {
        setEditorContent({
            code: yamlParser.dump(f[0].data.origin, { indent: 2 }),
            source: f[0]
        })
        setEditorVisible(true)
    }

    const launchObjectDelete = (f:IFileObject[]) => {
        setMsgBox(MsgBoxYesNo('Delete '+f[0].data.origin.kind,<Box>Are you sure you want to delete &nbsp;<b>{f[0].name}</b>?</Box>, setMsgBox, (a) => {
            if (a === MsgBoxButtons.Yes) {
                console.log('delete')
            }
        }))
    }

    const launchPodEvict = (f:IFileObject[]) => {
        setMsgBox(MsgBoxYesNo('Delete '+f[0].data.origin.kind,<Box>Are you sure you want to evict &nbsp;<b>{f[0].name}</b>?</Box>, setMsgBox, (a) => {
            if (a === MsgBoxButtons.Yes) {
                console.log('evict')
            }
        }))
    }

    const launchCreate = (obj:string) => {
        console.log('create ', obj)
        setEditorContent({
            code: `Kind: ${obj}\r\nejemplo: true`,
            source: undefined
        })
        setEditorVisible(true)
    }

    const setLeftItem = (space:ISpace, name:string, invoke:any) => {
        let x = space.leftItems?.find(f => f.name===name)
        if (x) x.onClick = invoke
    }

    const launchPodLog = (f:IFileObject[], currentTarget:Element) => {
        setSelectedFiles(f)
        setExternalContentView(InstanceConfigViewEnum.CONTAINER)
        setExternalContentTitle(f[0].name)
        setExternalContentType('log')
        setLeftMenuContent(f[0])
        setLeftMenuIncludeAll(true)
        setLeftMenuAnchorParent(currentTarget)
    }

    const onLeftMenuClose = () => {
        setLeftMenuAnchorParent(undefined)
    }

    const onLeftMenuOptionSelected = (container:string) => {
        setLeftMenuAnchorParent(undefined)

        if (container==='*all') {
            setExternalContentView(InstanceConfigViewEnum.POD)
        }
        else {
            setExternalContentContainer(container)
        }
        setExternalContentVisible(true)
    }

    const launchPodShell = (f:IFileObject[], currentTarget:Element) => {
        setSelectedFiles(f)
        setExternalContentView(InstanceConfigViewEnum.CONTAINER)
        setExternalContentType('ops')
        setExternalContentTitle(f[0].name)
        setLeftMenuContent(f[0])
        setLeftMenuIncludeAll(false)
        setLeftMenuAnchorParent(currentTarget)

    }

    const launchPodMetrics = (f:IFileObject[]) => {
        setSelectedFiles(f)
        setExternalContentType('metrics')
        setExternalContentVisible(true)
    }

    const launchObjectDetails = (f:IFileObject[]) => {
        setDetailsContent(f[0])
        setDetailsSections(objectSections.get(f[0].data.origin.kind)!)
        setDetailsVisible(true)
    }

    const launchDeploymentScale = (f:IFileObject[]) => {
        console.log('set sca')
    }

    const launchDeploymentRestart = (f:IFileObject[]) => {
        console.log('set rest')
    }

    const launchDeploymentLogs = (f:IFileObject[]) => {
        console.log('set logs')
    }

    const launchDaemonSetRestart = (f:IFileObject[]) => {
        console.log('set rest')
    }

    const launchDaemonSetLogs = (f:IFileObject[]) => {
        console.log('set logs')
    }

    const launchReplicaSetScale = (f:IFileObject[]) => {
        console.log('set sca')
    }

    const launchReplicaSetLogs = (f:IFileObject[]) => {
        console.log('set logs')
    }

    const launchJobLogs = (f:IFileObject[]) => {
        console.log(' logs')
    }

    const launchIngressClassDefault = (f:IFileObject[]) => {
        console.log('set def')
    }

    const launchNodeDrain = (f:IFileObject[]) => {
        console.log('drain node ',f[0].name)
        sendCommand(MagnifyCommandEnum.NODEDRAIN, [f[0].name])
    }

    const launchNodeCordon = (f:IFileObject[]) => {
        console.log('cordon node ',f[0].name)
        sendCommand(MagnifyCommandEnum.NODECORDON, [f[0].name])
    }

    const launchNodeUnCordon = (f:IFileObject[]) => {
        console.log('uncordon node ',f[0].name)
        sendCommand(MagnifyCommandEnum.NODEUNCORDON, [f[0].name])
    }

    const launchCronJobTrigger = (f:IFileObject[]) => {
        console.log('trigger cj ',f[0].name)
    }

    const launchCronJobSuspend = (f:IFileObject[]) => {
        console.log('suspend cj ',f[0].name)
    }

    const updateSource = () => {
        console.log(detailsContent)
    }

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

    const showSettings = () => {
        return <UserSettings settings={settings}/>
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

    function convertBytesToSize(bytes: number, decimals: number = 2): string {
        // Si el valor no es un número válido o es 0, simplemente devuelve "0 Bytes"
        if (!Number.isFinite(bytes) || bytes === 0) {
            return '0 Bytes';
        }

        const k = 1024; // Base binaria (IEC)
        const dm = decimals < 0 ? 0 : decimals; // Asegura que los decimales no sean negativos

        // Prefijos de unidades binarias (IEC)
        const units = ['Bytes', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];

        // Calcula el índice de la unidad más grande que cabe en el número de bytes
        // Math.floor(Math.log(bytes) / Math.log(k))
        const i = Math.floor(Math.log(bytes) / Math.log(k));

        // Si el resultado de i es 0, no dividimos, y si es mayor, dividimos por 1024^i
        const calculatedValue = parseFloat((bytes / Math.pow(k, i)).toFixed(dm));

        // Retorna el valor calculado y la unidad correspondiente
        return calculatedValue + ' ' + units[i];
    }        

    function convertSizeToBytes(fileSizeString: string): number {
        // 1. Extraer el número y la unidad
        // La RegEx busca: (Número con decimales) + Espacios opcionales + (Unidad con prefijo opcional 'i' y 'B' opcional)
        const match = fileSizeString.trim().match(/^([\d.]+)\s*([KMGTPE]i?)B?$/i);

        if (!match) {
            console.error(`Formato de tamaño de archivo no reconocido: ${fileSizeString}`);
            return NaN;
        }

        const value: number = parseFloat(match[1]); // El valor numérico (ej: 1, 23, 1.5)
        
        // Obtener la unidad base, quitando 'B' si existe y convirtiendo a mayúsculas.
        // Ej: "Gi" -> "GI", "MiB" -> "MI"
        const unitUpper: string = match[2].toUpperCase().replace(/B$/, ''); 
        
        // 2. Determinar el multiplicador (Base 1024)
        let multiplier: number;
        const base = 1024;

        switch (unitUpper) {
            case 'EI': // Exbibyte
            case 'E':
                multiplier = base ** 6;
                break;
            case 'PI': // Pebibyte
            case 'P':
                multiplier = base ** 5;
                break;
            case 'TI': // Tebibyte
            case 'T':
                multiplier = base ** 4;
                break;
            case 'GI': // Gibibyte
            case 'G':
                multiplier = base ** 3;
                break;
            case 'MI': // Mebibyte
            case 'M':
                multiplier = base ** 2;
                break;
            case 'KI': // Kibibyte
            case 'K':
                multiplier = base ** 1;
                break;
            case '': // Si solo era un número sin unidad (asume Bytes)
            case 'B': // Bytes
                multiplier = 1;
                break;
            default:
                console.warn(`Unidad desconocida '${unitUpper}'. Asumiendo Bytes.`);
                multiplier = 1;
                break;
        }

        // 3. Calcular el resultado final
        return value * multiplier;
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

    const setPathFunction = (path:string, invoke:() => void) => {
        let x = magnifyData.files.find(f => f.path===path)
        if (x) x.children = invoke
    }

    const setPropertyFunction = (space:ISpace, propName:string, invoke:(f:IFileObject) => void) => {
        if (!space.properties) return
        let prop = space.properties.find(p => p.name===propName)
        if (!prop) return
        prop.format = 'function'
        prop.source = invoke
    }

    const showPodContainers = (f:IFileObject) => {
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
    const showPodCpu = (f:IFileObject) => {
        return '#'
    }
    const showPodMemory = (f:IFileObject) => {
        return '#'
    }

    const onDelete = (files: IFileObject[]) => {}

    const onError = (error: IError, file: IFileObject) => {
        let uiConfig = props.channelObject.config as IMagnifyConfig
        uiConfig.notify(ENotifyLevel.ERROR, error.message)
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

    const onFolderChange = (folder:string) => {
        magnifyData.currentPath = folder
    }

    const onChangeData = (src:string, data:any) => {
        setDetailsChanges( _.set(detailsChanges, src, data))
        console.log(detailsChanges)
    }

    const launchEditFromDetails = (f:IFileObject) => {
        setDetailsVisible(false)
        setEditorContent({
            code: yamlParser.dump(f.data.origin, { indent: 2 }),
            source: f
        })
        setEditorVisible(true)
    }

    const externalContentClose = (content:IExternalContentObject) => {
        let i = magnifyData.externalContent.indexOf(content)
        if (i>=0) magnifyData.externalContent.splice(i,1)
        externalContentId.current = -1
        setExternalContentContainer('')
        setExternalContentType('')
        setExternalContentVisible(false)
    }

    const externalContentMinimize = (content:IExternalContentObject) => {
        if (!magnifyData.externalContent.includes(content)) magnifyData.externalContent.push(content)
        externalContentId.current = -1
        setExternalContentContainer('')
        setExternalContentType('')
        setExternalContentVisible(false)
    }

    const externalContentRestore = (index:number) => {
        externalContentId.current = index
        flushSync(() => setExternalContentVisible(true) )
        setRefresh(Math.random())
    }

    const externalContentRefresh = () => {
        setRefresh(Math.random())
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
                    onDelete={onDelete}
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
                    leftMenuAnchorParent && <LeftItemMenu f={leftMenuContent} onClose={onLeftMenuClose} onOptionSelected={onLeftMenuOptionSelected} anchorParent={leftMenuAnchorParent} includeAll={leftMenuIncludeAll} />
                }
                <Stack direction={'row'} sx={{mt:1}}>
                    {
                        magnifyData.externalContent.map((ec, index) => {
                            let text=ec.channelObject.pod
                            if (text.length>10) text=text.substring(0,10)+'...'
                            // +++ add a preview of terminal using: https://www.npmjs.com/package/html-to-image
                            return (
                                <Tooltip key={index} title={<>Pod: {ec.channelObject.pod}{ec.channelObject.container!==''? <><br/>Container: {ec.channelObject.container}</>: <></>}</>}>
                                    <Button onClick={() => externalContentRestore(index)}>{ec.channel.getChannelIcon()}{text}</Button>
                                </Tooltip>
                            )
                        })
                    }
                </Stack>
                { msgBox }
            </Box>
        }
        { editorVisible &&
            <Dialog open={editorVisible} 
                sx={{
                '& .MuiDialog-paper': {
                    width: '70vw',
                    height: '70vh',
                    maxWidth: '70vw',
                    maxHeight: '70vh', 
                },
                }}>
                <DialogTitle>
                    <Typography>{(editorContent.source?.data.origin.metadata.namespace? editorContent.source?.data.origin.metadata.namespace+'/': '')+editorContent.source?.data.origin.metadata.name}</Typography>
                </DialogTitle>
                <DialogContent>
                    <CodeMirror value={editorContent.code} onChange={updateEditorValue} extensions={[yaml()]} />
                </DialogContent>
                <DialogActions>
                    <Button onClick={applyEditorChanges}>Ok</Button>
                    <Button onClick={() => setEditorVisible(false)}>Cancel</Button>
                </DialogActions>
            </Dialog>
        }
        { detailsVisible &&
            <Dialog open={true} 
                sx={{
                '& .MuiDialog-paper': {
                    width: '70vw',
                    height: '70vh',
                    maxWidth: '70vw',
                    maxHeight: '70vh', 
                },
                }}>
                <DialogTitle>
                    <Stack direction='row' alignItems={'center'}>
                        <Typography fontSize={18}>{detailsContent?.data.origin.kind+': '+detailsContent?.data.origin.metadata?.name}</Typography>
                        <IconButton color='primary' onClick={() => copy(detailsContent?.data.origin.metadata?.name)}><ContentCopy fontSize='small'/></IconButton>
                        <Typography sx={{flexGrow:1}}/>
                        <IconButton color='primary' onClick={() => {launchEditFromDetails(detailsContent)}}><Edit fontSize='small'/></IconButton>
                        <IconButton color='primary' onClick={() => {setDetailsVisible(false); launchObjectDelete([detailsContent])}}><Delete fontSize='small'/></IconButton>
                        <IconButton color='primary' onClick={() => {setDetailsVisible(false)}}><Close fontSize='small'/></IconButton>
                    </Stack>
                </DialogTitle>
                <DialogContent >
                    <MagnifyObjectDetails object={detailsContent} sections={detailsSections} onChangeData={onChangeData}/>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => {setDetailsVisible(false); updateSource()}}>Ok</Button>
                    <Button onClick={() => setDetailsVisible(false)}>Cancel</Button>
                </DialogActions>
            </Dialog>
        }

        { externalContentVisible && 
            (externalContentId.current<0 ?
                <ExternalContent channelObject={props.channelObject} channelId={externalContentType} selectedFiles={selectedFiles} close={externalContentClose} frontChannels={props.channelObject.frontChannels!} notify={() => {}} minimize={externalContentMinimize} doRefresh={externalContentRefresh} contentView={externalContentView} title={externalContentTitle} data-refresh={refresh} container={externalContentContainer} settings={settings}/>
            :
                <ExternalContent content={magnifyData.externalContent[externalContentId.current]} channelObject={props.channelObject} selectedFiles={selectedFiles} close={externalContentClose} frontChannels={props.channelObject.frontChannels!} notify={() => {}} minimize={externalContentMinimize} doRefresh={externalContentRefresh} contentView={externalContentView} title={externalContentTitle} data-refresh={refresh} container={externalContentContainer} settings={settings}/>
            )
        }

    </>
}
export { MagnifyTabContent }