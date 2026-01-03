import { useEffect, useRef, useState } from 'react'
import { IChannelObject } from '../IChannel'
import { MagnifyCommandEnum, IMagnifyMessage, IMagnifyData } from './MagnifyData'
import { Box, Button, Card, CardContent, CardHeader, Dialog, DialogActions, DialogContent, DialogTitle, Divider, IconButton, Stack, Tooltip, Typography } from '@mui/material'
import { InstanceMessageActionEnum, InstanceMessageFlowEnum, InstanceMessageTypeEnum } from '@jfvilas/kwirth-common'
import { IError, IFileObject, ISpace } from '@jfvilas/react-file-manager'
import { FileManager } from '@jfvilas/react-file-manager'
import { v4 as uuid } from 'uuid'
import { IMagnifyConfig } from './MagnifyConfig'
import { ENotifyLevel } from '../../tools/Global'
import '@jfvilas/react-file-manager/dist/style.css'
import './custom-fm.css'
import { icons, menu, spaces } from './RFMConfig'
import CodeMirror from '@uiw/react-codemirror';
import { yaml } from '@codemirror/lang-yaml'
import React from 'react'
import { IDetailsSection, MagnifyObjectDetails } from './components/DetailsObject'
import { objectSections } from './components/DetailsSections'
import { Close, ContentCopy, Delete, Edit } from '@mui/icons-material'
import { MsgBoxButtons, MsgBoxYesNo } from '../../tools/MsgBox'
import { ExternalContent, IExternalContentObject } from './components/ExternalContent'
import { flushSync } from 'react-dom'

const _ = require('lodash')
const copy = require('clipboard-copy')

const yamlParser = require('js-yaml');

interface IContentProps {
    webSocket?: WebSocket
    channelObject: IChannelObject
}

const MagnifyTabContent: React.FC<IContentProps> = (props:IContentProps) => {
    const magnifyBoxRef = useRef<HTMLDivElement | null>(null)
    const [magnifyBoxTop, setMagnifyBoxTop] = useState(0)
    const [msgBox, setMsgBox] =useState(<></>)
    const [editorVisible, setEditorVisible] = useState(false)
    const [editorContent, setEditorContent] = useState<{code:string, source?:IFileObject}>({code:''})
    const [detailsVisible, setDetailsVisible] = useState(false)
    const [externalContentVisible, setExternalContentVisible] = useState<boolean>(false)
    const [externalContentType, setExternalContentType] = useState<string>('')
    const externalContentId = useRef<number>(-1)
    const [selectedFiles, setSelectedFiles] = useState<IFileObject[]>([])
    const [detailsContent, setDetailsContent] = useState<any>()
    const [detailsSections, setDetailsSections] = useState<IDetailsSection[]>([])
    const [detailsChanges, setDetailsChanges] = useState({})
    const [refresh, setRefresh] = useState<number>(0)

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
    let actions = new Map()

    useEffect(() => {
        if (magnifyBoxRef.current) setMagnifyBoxTop(magnifyBoxRef.current.getBoundingClientRect().top)
    })

    useEffect(() => {
        if (!magnifyData.files.some(f => f.path ==='/overview')) {
            magnifyData.files.push(...menu)

            setPathFunction('/overview', showOverview)
            setPathFunction('/cluster/overview', showClusterOverview)
            setPathFunction('/workload/overview', showWorkloadOverview)
            setPathFunction('/network/overview', showNetworkOverview)
            setPathFunction('/config/overview', showConfigOverview)
            setPathFunction('/storage/overview', showStorageOverview)

            // magnifyData.files.push({
            //     name: 'un grupo',
            //     isDirectory: true,
            //     path: '/crd/ungrupo',
            //     class: 'crdgroup'
            // })
            // magnifyData.files.push({
            //     name: 'unainst',
            //     isDirectory: false,
            //     path: '/crd/ungrupo/unainst',
            //     class: 'crdinstance'
            // })
            // magnifyData.files.push({
            //     name: 'otrainst',
            //     isDirectory: false,
            //     path: '/crd/ungrupo/otrainst',
            //     class: 'crdinstance'
            // })
            // let sampleFiles = [
            //         {
            //             name: "users-svc",
            //             isDirectory: false,
            //             path: "/network/service/users-svc",
            //             class: 'service'
            //         },
            //         {
            //             name: "login-svc",
            //             isDirectory: false,
            //             path: "/network/service/login-svc",
            //             class: 'service'
            //         },
            //         {
            //             name: "customer-svc",
            //             isDirectory: false,
            //             path: "/network/service/customer-svc",
            //             class: 'service'
            //         },
            //         {
            //             name: "ingress",
            //             isDirectory: false,
            //             path: "/network/ingress/ingress",
            //             class: 'ingress'
            //         },
            //         {
            //             name: "superset-ingress",
            //             isDirectory: false,
            //             path: "/network/ingress/superset-ingress",
            //             class: 'ingress'
            //         }
            // ]
            //magnifyData.files.push(...sampleFiles)

        // Workload
            // Pod
            let spcClassPod = spaces.get('classPod')!
            setLeftItem(spcClassPod, 'create', () => launchCreate('Pod'))
            let spcPod = spaces.get('Pod')!
            setPropertyFunction(spcPod, 'container', showPodContainers)
            setPropertyFunction(spcPod, 'cpu', showPodCpu)
            setPropertyFunction(spcPod, 'memory', showPodMemory)
            setLeftItem(spcPod,'viewlog', launchPodLog)
            setLeftItem(spcPod,'details', launchDetails)
            setLeftItem(spcPod,'delete', launchDelete)

            let spcClassDeployment = spaces.get('classDeployment')!
            setLeftItem(spcClassDeployment, 'create', () => launchCreate('classDeployment'))
            let spcDeployment = spaces.get('Deployment')!
            setLeftItem(spcDeployment,'details', launchDetails)
            setLeftItem(spcDeployment,'scale', launchDeploymentScale)
            setLeftItem(spcDeployment,'restart', launchDeploymentRestart)
            setLeftItem(spcDeployment,'logs', launchDeploymentLogs)
            setLeftItem(spcDeployment,'edit', launchEdit)
            setLeftItem(spcDeployment,'delete', launchDelete)
            
            let spcClassDaemonSet = spaces.get('classDaemonSet')!
            setLeftItem(spcClassDaemonSet, 'create', () => launchCreate('classDaemonSet'))
            let spcDaemonSet = spaces.get('DaemonSet')!
            setLeftItem(spcDaemonSet,'details', launchDetails)
            setLeftItem(spcDaemonSet,'restart', launchDaemonSetRestart)
            setLeftItem(spcDaemonSet,'logs', launchDaemonSetLogs)
            setLeftItem(spcDaemonSet,'edit', launchEdit)
            setLeftItem(spcDaemonSet,'delete', launchDelete)
            
            let spcClassReplicaSet = spaces.get('classReplicaSet')!
            setLeftItem(spcClassReplicaSet, 'create', () => launchCreate('classReplicaSet'))
            let spcReplicaSet = spaces.get('ReplicaSet')!
            setLeftItem(spcReplicaSet,'details', launchDetails)
            setLeftItem(spcReplicaSet,'scale', launchReplicaSetScale)
            setLeftItem(spcReplicaSet,'logs', launchReplicaSetLogs)
            setLeftItem(spcReplicaSet,'edit', launchEdit)
            setLeftItem(spcReplicaSet,'delete', launchDelete)
            
            let spcClassJob = spaces.get('classJob')!
            setLeftItem(spcClassJob, 'create', () => launchCreate('classJob'))
            let spcJob = spaces.get('Job')!
            setLeftItem(spcJob,'details', launchDetails)
            setLeftItem(spcJob,'logs', launchJobLogs)
            setLeftItem(spcJob,'edit', launchEdit)
            setLeftItem(spcJob,'delete', launchDelete)

            let spcClassCronJob = spaces.get('classCronJob')!
            setLeftItem(spcClassCronJob, 'create', () => launchCreate('classCronJob'))
            let spcCronJob = spaces.get('CronJob')!
            setLeftItem(spcCronJob,'trigger', launchCronJobTrigger)
            setLeftItem(spcCronJob,'suspend', launchCronJobSuspend)
            setLeftItem(spcCronJob,'details', launchDetails)
            setLeftItem(spcCronJob,'edit', launchEdit)
            setLeftItem(spcCronJob,'delete', launchDelete)


        // Cluster

            // Node
            let spcNode = spaces.get('Node')!
            setLeftItem(spcNode,'details', launchDetails)
            setLeftItem(spcNode,'cordon', launchNodeCordon)
            setLeftItem(spcNode,'uncordon', launchNodeUnCordon)
            setLeftItem(spcNode,'drain', launchNodeDrain)
            setLeftItem(spcNode,'edit', launchEdit)
            setLeftItem(spcNode,'delete', launchDelete)

            // Namespace
            let spcClassNamespace = spaces.get('classNamespace')!
            setLeftItem(spcClassNamespace, 'create', () => launchCreate('Namespace'))
            let spcNamespace = spaces.get('Namespace')!
            setLeftItem(spcNamespace,'details', launchDetails)
            setLeftItem(spcNamespace,'edit', launchEdit)
            setLeftItem(spcNamespace,'delete', launchDelete)

        // Network

            // Service
            let spcClassService = spaces.get('classService')!
            setLeftItem(spcClassService, 'create', () => launchCreate('Service'))
            let spcService = spaces.get('Service')!
            setLeftItem(spcService,'details', launchDetails)
            setLeftItem(spcService,'edit', launchEdit)
            setLeftItem(spcService,'delete', launchDelete)

            // Endpoints
            let spcClassEndpoints = spaces.get('classEndpoints')!
            setLeftItem(spcClassEndpoints, 'create', () => launchCreate('Endpoints'))
            let spcEndpoints = spaces.get('Endpoints')!
            setLeftItem(spcEndpoints,'details', launchDetails)
            setLeftItem(spcEndpoints,'edit', launchEdit)
            setLeftItem(spcEndpoints,'delete', launchDelete)


            // Ingress
            let spcClassIngress = spaces.get('classIngress')!
            setLeftItem(spcClassIngress, 'create', () => launchCreate('Ingress'))
            let spcIngress = spaces.get('Ingress')!
            setLeftItem(spcIngress,'details', launchDetails)
            setLeftItem(spcIngress,'edit', launchEdit)
            setLeftItem(spcIngress,'delete', launchDelete)

            // IngressClass
            let spcClassIngressClass = spaces.get('classIngressClass')!
            setLeftItem(spcClassIngressClass, 'create', () => launchCreate('IngressClass'))
            let spcIngressClass = spaces.get('IngressClass')!
            setLeftItem(spcIngressClass,'default', launchIngressClassDefault)
            setLeftItem(spcIngressClass,'details', launchDetails)
            setLeftItem(spcIngressClass,'edit', launchEdit)
            setLeftItem(spcIngressClass,'delete', launchDelete)

            // NetworkPolicy
            let spcClassNetworkPolicy = spaces.get('classNetworkPolicy')!
            setLeftItem(spcClassNetworkPolicy, 'create', () => launchCreate('NetworkPolicy'))
            let spcNetworkPolicy = spaces.get('NetworkPolicy')!
            setLeftItem(spcNetworkPolicy,'details', launchDetails)
            setLeftItem(spcNetworkPolicy,'edit', launchEdit)
            setLeftItem(spcNetworkPolicy,'delete', launchDelete)

        // Config

            // ConfigMap
            let spcClassConfigMap = spaces.get('classConfigMap')!
            setLeftItem(spcClassConfigMap, 'create', () => launchCreate('ConfigMap'))
            let spcConfigMap = spaces.get('ConfigMap')!
            setLeftItem(spcConfigMap,'details', launchDetails)
            setLeftItem(spcConfigMap,'edit', launchEdit)
            setLeftItem(spcConfigMap,'delete', launchDelete)

            let spcClassSecret = spaces.get('classSecret')!
            setLeftItem(spcClassSecret, 'create', () => launchCreate('Secret'))
            let spcSecret = spaces.get('Secret')!
            setLeftItem(spcSecret,'details', launchDetails)
            setLeftItem(spcSecret,'edit', launchEdit)
            setLeftItem(spcSecret,'delete', launchDelete)

            let spcClassResourceQuota = spaces.get('classResourceQuota')!
            setLeftItem(spcClassResourceQuota, 'create', () => launchCreate('ResourceQuota'))
            let spcResourceQuota = spaces.get('ResourceQuota')!
            setLeftItem(spcResourceQuota,'details', launchDetails)
            setLeftItem(spcResourceQuota,'edit', launchEdit)
            setLeftItem(spcResourceQuota,'delete', launchDelete)

            let spcClassLimitRange = spaces.get('classLimitRange')!
            setLeftItem(spcClassLimitRange, 'create', () => launchCreate('LimitRange'))
            let spcLimitRange = spaces.get('LimitRange')!
            setLeftItem(spcLimitRange,'details', launchDetails)
            setLeftItem(spcLimitRange,'edit', launchEdit)
            setLeftItem(spcLimitRange,'delete', launchDelete)

            let spcClassHorizontalPodAutoscaler = spaces.get('classHorizontalPodAutoscaler')!
            setLeftItem(spcClassHorizontalPodAutoscaler, 'create', () => launchCreate('HorizontalPodAutoscaler'))
            let spcHorizontalPodAutoscaler = spaces.get('HorizontalPodAutoscaler')!
            setLeftItem(spcHorizontalPodAutoscaler,'details', launchDetails)
            setLeftItem(spcHorizontalPodAutoscaler,'edit', launchEdit)
            setLeftItem(spcHorizontalPodAutoscaler,'delete', launchDelete)

            let spcClassPodDisruptionBudget = spaces.get('classPodDisruptionBudget')!
            setLeftItem(spcClassPodDisruptionBudget, 'create', () => launchCreate('PodDisruptionBudget'))
            let spcPodDisruptionBudget = spaces.get('PodDisruptionBudget')!
            setLeftItem(spcPodDisruptionBudget,'details', launchDetails)
            setLeftItem(spcPodDisruptionBudget,'edit', launchEdit)
            setLeftItem(spcPodDisruptionBudget,'delete', launchDelete)

            let spcClassPriorityClass = spaces.get('classPriorityClass')!
            setLeftItem(spcClassPriorityClass, 'create', () => launchCreate('PriorityClass'))
            let spcPriorityClass = spaces.get('PriorityClass')!
            setLeftItem(spcPriorityClass,'details', launchDetails)
            setLeftItem(spcPriorityClass,'edit', launchEdit)
            setLeftItem(spcPriorityClass,'delete', launchDelete)

            let spcClassRuntimeClass = spaces.get('classRuntimeClass')!
            setLeftItem(spcClassRuntimeClass, 'create', () => launchCreate('RuntimeClass'))
            let spcRuntimeClass = spaces.get('RuntimeClass')!
            setLeftItem(spcRuntimeClass,'details', launchDetails)
            setLeftItem(spcRuntimeClass,'edit', launchEdit)
            setLeftItem(spcRuntimeClass,'delete', launchDelete)

            let spcClassLease = spaces.get('classLease')!
            setLeftItem(spcClassLease, 'create', () => launchCreate('Lease'))
            let spcLease = spaces.get('Lease')!
            setLeftItem(spcLease,'details', launchDetails)
            setLeftItem(spcLease,'edit', launchEdit)
            setLeftItem(spcLease,'delete', launchDelete)

            let spcClassValidatingWebhookConfiguration = spaces.get('classValidatingWebhookConfiguration')!
            setLeftItem(spcClassValidatingWebhookConfiguration, 'create', () => launchCreate('ValidatingWebhookConfiguration'))
            let spcValidatingWebhookConfiguration = spaces.get('ValidatingWebhookConfiguration')!
            setLeftItem(spcValidatingWebhookConfiguration,'details', launchDetails)
            setLeftItem(spcValidatingWebhookConfiguration,'edit', launchEdit)
            setLeftItem(spcValidatingWebhookConfiguration,'delete', launchDelete)
            
            let spcClassMutatingWebhookConfiguration = spaces.get('classMutatingWebhookConfiguration')!
            setLeftItem(spcClassMutatingWebhookConfiguration, 'create', () => launchCreate('MutatingWebhookConfiguration'))
            let spcMutatingWebhookConfiguration = spaces.get('MutatingWebhookConfiguration')!
            setLeftItem(spcMutatingWebhookConfiguration,'details', launchDetails)
            setLeftItem(spcMutatingWebhookConfiguration,'edit', launchEdit)
            setLeftItem(spcMutatingWebhookConfiguration,'delete', launchDelete)
            
        // Storage

            // StorageClass
            let spcClassStorageClass = spaces.get('classStorageClass')!
            setLeftItem(spcClassStorageClass, 'create', () => launchCreate('StorageClass'))
            let spcStorageClass = spaces.get('StorageClass')!
            setLeftItem(spcStorageClass,'details', launchDetails)
            setLeftItem(spcStorageClass,'edit', launchEdit)
            setLeftItem(spcStorageClass,'delete', launchDelete)

            // PersistentVolumeClaim
            let spcClassPersistentVolumeClaim = spaces.get('classPersistentVolumeClaim')!
            setLeftItem(spcClassPersistentVolumeClaim, 'create', () => launchCreate('PersistentVolumeClaim'))
            let spcPersistentVolumeClaim = spaces.get('PersistentVolumeClaim')!
            setLeftItem(spcPersistentVolumeClaim,'details', launchDetails)
            setLeftItem(spcPersistentVolumeClaim,'edit', launchEdit)
            setLeftItem(spcPersistentVolumeClaim,'delete', launchDelete)

            // PersistentVolume
            let spcClassPersistentVolume = spaces.get('classPersistentVolume')!
            setLeftItem(spcClassPersistentVolume, 'create', () => launchCreate('PersistentVolume'))
            let spcPersistentVolume = spaces.get('PersistentVolume')!
            setLeftItem(spcPersistentVolume,'details', launchDetails)
            setLeftItem(spcPersistentVolume,'edit', launchEdit)
            setLeftItem(spcPersistentVolume,'delete', launchDelete)

        // Access

            // ServiceAccount
            let spcClassServiceAccount = spaces.get('classServiceAccount')!
            setLeftItem(spcClassServiceAccount, 'create', () => launchCreate('ServiceAccount'))
            let spcServiceAccount = spaces.get('ServiceAccount')!
            setLeftItem(spcServiceAccount,'details', launchDetails)
            setLeftItem(spcServiceAccount,'edit', launchEdit)
            setLeftItem(spcServiceAccount,'delete', launchDelete)

            // ClusterRole
            let spcClassClusterRole = spaces.get('classClusterRole')!
            setLeftItem(spcClassClusterRole, 'create', () => launchCreate('ClusterRole'))
            let spcClusterRole = spaces.get('ClusterRole')!
            setLeftItem(spcClusterRole,'details', launchDetails)
            setLeftItem(spcClusterRole,'edit', launchEdit)
            setLeftItem(spcClusterRole,'delete', launchDelete)


        // Custom

            // CustomResourceDefinition
            let spcClassCustomResourceDefinition = spaces.get('classCustomResourceDefinition')!
            setLeftItem(spcClassCustomResourceDefinition, 'create', () => launchCreate('CustomResourceDefinition'))
            let spcCustomResourceDefinition = spaces.get('CustomResourceDefinition')!
            setLeftItem(spcCustomResourceDefinition,'details', launchDetails)
            setLeftItem(spcCustomResourceDefinition,'edit', launchEdit)
            setLeftItem(spcCustomResourceDefinition,'delete', launchDelete)

            // crd instance
            let spcCrdInstance = spaces.get('crdinstance')!
            setLeftItem(spcCrdInstance, 'delete', launchDelete)

        }
    }, [])

    // const yamlLinter = linter(view => {
    //     console.log('lint')
    //     let diagnostics: Diagnostic[] = []
    //     try {
    //         console.log(editorValue.code)
    //         let x = yamlParser.dump(editorValue.code)
    //         console.log(x)
    //     }
    //     catch (e:any) {
    //         console.log('error')
    //         if (e.mark) {
    //             const line = e.mark.line;
    //             const column = e.mark.column;

    //             let pos = view.state.doc.line(line + 1).from + column;
    //             if (pos > view.state.doc.length) {
    //                 pos = view.state.doc.length - 1;
    //             }

    //             diagnostics.push({
    //                 from: pos,
    //                 to: pos + 1, // Resaltar un solo carácter o un pequeño rango
    //                 severity: "error", // Indica que es un error crítico
    //                 message: e.reason || "YAML syntax error",
    //             });
    //         }
    //         else {
    //             // Manejar errores que no tienen una marca específica
    //             diagnostics.push({
    //                 from: 0,
    //                 to: 1,
    //                 severity: "error",
    //                 message: e.reason || "GEneral YAML  syntaxerror",
    //             });
    //         }
    //     }

    //     return diagnostics
    // })

    const applyEditorChanges = () => {
        setEditorVisible(false)
        sendCommand(MagnifyCommandEnum.CREATE, [editorContent.code])
    }

    const updateEditorValue= (newCode:any) => {
        editorContent.code=newCode
    }

    const launchEdit = (f:IFileObject[]) => {
        setEditorContent({
            code: yamlParser.dump(f[0].data.origin, { indent: 2 }),
            source: f[0]
        })
        setEditorVisible(true)
    }

    const launchDelete = (f:IFileObject[]) => {
        setMsgBox(MsgBoxYesNo('Delete '+f[0].data.origin.kind,<Box>Are you sure you want to delete &nbsp;<b>{f[0].name}</b>?</Box>, setMsgBox, (a) => {
            if (a === MsgBoxButtons.Yes) {
                console.log('delete')
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

    const launchPodLog = (f:IFileObject[]) => {
        console.log(externalContentId.current)
        console.log(externalContentVisible)
        setSelectedFiles(f)
        setExternalContentType('log')
        setExternalContentVisible(true)
    }

    const launchDetails = (f:IFileObject[]) => {
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

    const onDelete = (files: IFileObject[]) => {
    }

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
        setExternalContentVisible(false)
    }

    const externalContentMinimize = (content:IExternalContentObject) => {
        if (!magnifyData.externalContent.includes(content)) magnifyData.externalContent.push(content)
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
            <Box ref={magnifyBoxRef} sx={{ display:'flex', flexDirection:'column', overflowY:'auto', overflowX:'hidden', flexGrow:1, height: `calc(100vh - ${magnifyBoxTop}px - 16px)`, paddingLeft: '5px', paddingRight:'5px', marginTop:'8px'}}>
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
                <Stack direction={'row'} sx={{mt:1}}>
                    {
                        magnifyData.externalContent.map((ec, index) => {
                            let text=ec.channelObject.pod
                            if (text.length>10) text=text.substring(0,10)+'...'
                            return <Tooltip key={index} title={<>Pod<br/>{ec.channelObject.pod}</>}>
                                    <Button onClick={() => externalContentRestore(index)}>{ec.channel.getChannelIcon()}{text}</Button>
                                </Tooltip>
                        })
                    }
                </Stack>
                { msgBox }
            </Box>
        }
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
        {detailsVisible && <Dialog open={true} 
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
                    <IconButton color='primary' onClick={() => {setDetailsVisible(false); launchDelete([detailsContent])}}><Delete fontSize='small'/></IconButton>
                    <IconButton color='primary' onClick={() => {setDetailsVisible(false)}}><Close fontSize='small'/></IconButton>
                </Stack>
            </DialogTitle>
            <DialogContent>
                <MagnifyObjectDetails object={detailsContent} sections={detailsSections} onChangeData={onChangeData}/>
            </DialogContent>
            <DialogActions>
                <Button onClick={() => {setDetailsVisible(false); updateSource()}}>Ok</Button>
                <Button onClick={() => setDetailsVisible(false)}>Cancel</Button>
            </DialogActions>
        </Dialog>}

        { externalContentVisible && 
            (externalContentId.current<0 ?
                <ExternalContent channelObject={props.channelObject} channelId={externalContentType} selectedFiles={selectedFiles} close={externalContentClose} frontChannels={props.channelObject.frontChannels!} notify={() => {}} minimize={externalContentMinimize} doRefresh={externalContentRefresh} data-refresh={refresh}/>
            :
                <ExternalContent content={magnifyData.externalContent[externalContentId.current]} channelObject={props.channelObject} selectedFiles={selectedFiles} close={externalContentClose} frontChannels={props.channelObject.frontChannels!} notify={() => {}} minimize={externalContentMinimize} doRefresh={externalContentRefresh} data-refresh={refresh}/>
            )
        }

    </>
}
export { MagnifyTabContent }