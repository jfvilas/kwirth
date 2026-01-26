import { useEffect, useRef, useState } from 'react'
import { IChannelObject } from '../IChannel'
import { EFilemanCommand, IFilemanMessage, IFilemanData } from './FilemanData'
import { Box, Typography } from '@mui/material'
import { EInstanceMessageAction, EInstanceMessageFlow, EInstanceMessageType } from '@jfvilas/kwirth-common'
import { IError, IFileObject } from '@jfvilas/react-file-manager'
import { FileManager } from '@jfvilas/react-file-manager'
import { IconContainer, IconNamespace, IconPod } from '../../tools/Constants-React'
import { v4 as uuid } from 'uuid'
import { addGetAuthorization } from '../../tools/AuthorizationManagement'
import { MsgBoxOk } from '../../tools/MsgBox'
import { IFilemanConfig } from './FilemanConfig'
import { ENotifyLevel } from '../../tools/Global'
import '@jfvilas/react-file-manager/dist/style.css'
import './custom-fm.css'

interface IContentProps {
    webSocket?: WebSocket
    channelObject: IChannelObject
}

const FilemanTabContent: React.FC<IContentProps> = (props:IContentProps) => {
    const filemanBoxRef = useRef<HTMLDivElement | null>(null)
    const [logBoxTop, setLogBoxTop] = useState(0)
    //const [refresh, setRefresh] = useState(0)
    const [msgBox, setMsgBox] =useState(<></>)

    let filemanData:IFilemanData = props.channelObject.data
    let permissions={
        create: true,
        delete: true,
        download: true,
        copy: true,
        move: true,
        rename: true,
        upload: true
    }

    let icons = new Map()
    icons.set('namespace', { open:<IconNamespace height={18}/>, closed:<IconNamespace height={18}/>, grid:<IconNamespace height={50}/>, list:<IconNamespace height={18}/>, default:<IconNamespace height={18}/> })
    icons.set('pod', { open:<IconPod height={18}/>, closed:<IconPod height={18}/>, grid:<IconPod height={50}/>, list:<IconPod height={18}/>, default:<IconPod height={18}/> })
    icons.set('container', { open:<IconContainer/>, closed:<IconContainer/>, grid:<IconContainer height={44}/>, list:<IconContainer height={16}/>, default:<IconContainer height={16}/> })

    let actions = new Map()
    actions.set('namespace', [
        {
            title: 'Namespace details',
            icon: <Typography color='green' fontWeight={600}>V</Typography>,
            onClick: async (files : IFileObject[]) => {
                let namespace = files[0].name
                let data = await((await fetch(`${props.channelObject.clusterUrl}/config/${namespace}/groups`, addGetAuthorization(props.channelObject.accessString!))).json())
                let info = `Controllers inside ${namespace} namespace:<br/><br/>` + data.map((ns:any) => '<b>-</b> '+ ns.name + '<br/>').join('')
                setMsgBox(MsgBoxOk('Namespace info', info, setMsgBox))
            }
        },
    ])
    actions.set('file', [
        {
            title: 'File details',
            icon: <Typography color='blue' fontWeight={600}>D</Typography>,
            onClick: async (files : IFileObject[]) => {
                let info = `Details of file '${files[0].name}':<br/><br/><b>Name</b>: ${files[0].name}<br/><b>Path</b>: ${files[0].path}<br/><b>Last update</b>: ${files[0].data.updatedAt}<br/><b>Size (bytes)</b>: ${files[0].data.size}`
                setMsgBox(MsgBoxOk('File info', info, setMsgBox))
            }
        }
    ])


    let level = filemanData.currentPath.split('/').length - 1
    if (level<3) {
        permissions = {
            create: false,
            delete: false,
            download: false,
            copy: false,
            move: false,
            rename: false,
            upload: false
        }
    }

    useEffect(() => {
        if (filemanBoxRef.current) setLogBoxTop(filemanBoxRef.current.getBoundingClientRect().top)
    })

    interface IFileUploadConfig  { 
        url: string
        method?: "POST" | "PUT"
        headers?: { [key: string]: string }
    }

    let fileUploadConfig:IFileUploadConfig = {
        url: `${props.channelObject.clusterUrl}/channel/fileman/upload?key=${props.channelObject.instanceId}`,
        method:'POST',
        headers: {
            'Authorization': 'Bearer '+ props.channelObject.accessString
        }
    }

    const onDelete = (files: IFileObject[]) => {
        for (let file of files) {
            let [namespace,pod,container] = file.path.split('/').slice(1)
            filemanData.files = filemanData.files.filter(f => f.path !== file.path)
            sendCommand(EFilemanCommand.DELETE, namespace, pod, container, [file.path])
        }
    }

    const onCreateFolder = async (name: string, parentFolder: IFileObject) => {
        let [namespace,pod,container] = parentFolder.path.split('/').slice(1)
        sendCommand(EFilemanCommand.CREATE, namespace, pod, container, [parentFolder.path + '/' + name])
    }

    const onDownload = async (files: IFileObject[]) => {
        for (let file of files) {
            const url = `${props.channelObject.clusterUrl}/channel/fileman/download?key=${props.channelObject.instanceId}&filename=${file.path}`
            
            try {
                // +++ CAN BE THIS FETCH BE CONFIGURED WITH addGetAuthorization INSTEAD OF THIS?
                const response = await fetch(url, { headers: { 'Authorization': 'Bearer '+ props.channelObject.accessString, 'X-Kwirth-App': 'true' } })

                if (response.ok) {
                    const blob = await response.blob()

                    const link = document.createElement('a')
                    link.href = URL.createObjectURL(blob)
                    link.download = file.path.split('/').slice(-1)[0]
                    if (file.isDirectory) link.download += '.tar.gz'
                    document.body.appendChild(link)
                    link.click()
                    document.body.removeChild(link)
                    URL.revokeObjectURL(link.href)
                }
                else {
                    console.error(`Error downloading file: ${file.path}`)
                    let uiConfig = props.channelObject.config as IFilemanConfig
                    uiConfig.notify(ENotifyLevel.ERROR, `Error downloading file ${file.path}: (${response.status}) ${await response.text()}`)
                }
            }
            catch (error) {
                console.error(`Error downloading file: ${file.path}`, error)
                let uiConfig = props.channelObject.config as IFilemanConfig
                uiConfig.notify(ENotifyLevel.ERROR, `Error downloading file ${file.path}: ${error}`)
            }
        }
    }

    const onPaste = (files: IFileObject[], destFolder:IFileObject, operation:string) => {
        let command = operation==='move'? EFilemanCommand.MOVE : EFilemanCommand.COPY
        for (let file of files) {
            let [namespace,pod,container] = file.path.split('/').slice(1)
            sendCommand(command, namespace, pod, container, [file.path, destFolder.path])
        }        
    }

    const onError = (error: IError, file: IFileObject) => {
        let uiConfig = props.channelObject.config as IFilemanConfig
        uiConfig.notify(ENotifyLevel.ERROR, error.message)
    }

    const onRename	= (file: IFileObject, newName: string) => {
        let [namespace,pod,container] = file.path.split('/').slice(1)
        filemanData.files = filemanData.files.filter (f => f.path!==file.path)
        sendCommand(EFilemanCommand.RENAME, namespace, pod, container, [file.path, newName])
    }

    const onRefresh = () => {
        if (level >= 3) {
            filemanData.files = filemanData.files.filter ( f => !f.path.startsWith(filemanData.currentPath+'/'))
            getLocalDir(filemanData.currentPath+'/')
        }
        else {
            sendCommand(EFilemanCommand.HOME, '', '', '', [])
        }

    }

    const sendCommand = (command: EFilemanCommand, namespace:string, pod:string, container:string,  params:string[]) => {
        if (!props.channelObject.webSocket) return
        
        let filemanMessage:IFilemanMessage = {
            flow: EInstanceMessageFlow.REQUEST,
            action: EInstanceMessageAction.COMMAND,
            channel: 'fileman',
            type: EInstanceMessageType.DATA,
            accessKey: props.channelObject.accessString!,
            instance: props.channelObject.instanceId,
            id: uuid(),
            command: command,
            namespace: namespace,
            group: '',
            pod: pod,
            container: container,
            params: params,
            msgtype: 'filemanmessage'
        }
        let payload = JSON.stringify( filemanMessage )
        props.channelObject.webSocket.send(payload)
    }

    const getLocalDir = (folder:string) => {
        let [namespace,pod,container] = folder.split('/').slice(1)
        let filemanMessage:IFilemanMessage = {
            flow: EInstanceMessageFlow.REQUEST,
            action: EInstanceMessageAction.COMMAND,
            channel: 'fileman',
            type: EInstanceMessageType.DATA,
            accessKey: props.channelObject.accessString!,
            instance: props.channelObject.instanceId,
            id: uuid(),
            command: EFilemanCommand.DIR,
            namespace: namespace,
            group: '',
            pod: pod,
            container: container,
            params: [folder],
            msgtype: 'filemanmessage'
        }
        let payload = JSON.stringify( filemanMessage )
        if (props.channelObject.webSocket) props.channelObject.webSocket.send(payload)
    }

    const onFolderChange = (folder:string) => {
        filemanData.currentPath = folder
        folder +='/'
        let level = folder.split('/').length - 1
        if (level > 2) getLocalDir(folder)
    }

    const onFileUploading = (file: IFileObject, parentFolder: IFileObject) => { 
        return { filename: filemanData.currentPath + '/' + file.name }
    }

    return <>
        { filemanData.started &&
            <Box ref={filemanBoxRef} sx={{ display:'flex', flexDirection:'column', overflowY:'auto', overflowX:'hidden', flexGrow:1, height: `calc(100vh - ${logBoxTop}px - 16px)`, paddingLeft: '5px', paddingRight:'5px', marginTop:'8px'}}>
                <FileManager
                    files={filemanData.files}
                    actions={actions}
                    icons={icons}
                    initialPath={filemanData.currentPath}
                    enableFilePreview={false}
                    onCreateFolder={onCreateFolder}
                    onError={onError}
                    onRename={onRename}
                    onPaste={onPaste}
                    onDelete={onDelete}
                    onFolderChange={onFolderChange}
                    onRefresh={onRefresh}
                    onFileUploading={onFileUploading}
                    onDownload={onDownload}
                    permissions={permissions}
                    fileUploadConfig={fileUploadConfig}
                    filePreviewPath='http://avoid-console-error'
                    primaryColor='#1976d2'
                    fontFamily='Roboto, Helvetica, Arial, sans-serif'
                    height='100%'
                    className='custom-fm'
                    searchMode='auto'
                />
                { msgBox }
            </Box>
        }
    </>
}
export { FilemanTabContent }