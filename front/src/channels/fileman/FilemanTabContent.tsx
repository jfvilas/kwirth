import { useEffect, useRef, useState } from 'react'
import { IChannelObject } from '../IChannel'
import { FilemanCommandEnum, IFileData, IFilemanMessage, IFilemanObject } from './FilemanObject'
import '@cubone/react-file-manager/dist/style.css'
import { FileManager } from "@cubone/react-file-manager";
import { Box } from '@mui/material';
import { InstanceMessageActionEnum, InstanceMessageFlowEnum, InstanceMessageTypeEnum } from '@jfvilas/kwirth-common';
import { v4 as uuidv4 } from 'uuid'

interface IContentProps {
    webSocket?: WebSocket
    channelObject: IChannelObject
}

const FilemanTabContent: React.FC<IContentProps> = (props:IContentProps) => {
    const filemanBoxRef = useRef<HTMLDivElement | null>(null)
    const [currentPath, setCurrentPath] = useState("/")
    const [logBoxTop, setLogBoxTop] = useState(0)
    const [refresh, setRefresh] = useState(0)
    let filemanObject:IFilemanObject = props.channelObject.uiData
    let permissions={
        create: false,
        delete: true,
        download: false,
        copy: true,
        move: true,
        rename: true,
        upload: false
    }    

    useEffect(() => {
        if (filemanBoxRef.current) setLogBoxTop(filemanBoxRef.current.getBoundingClientRect().top)
    })

    interface fileUploadConfig  { 
        url: string
        method?: "POST" | "PUT"
        headers?: { [key: string]: string } 
    }

    let fuc:fileUploadConfig = {
        url:''
    }

    const onDelete = async (files: Array<IFileData>) => {
        console.log('remove', files, filemanObject.files)    
        for (let file of files) {
            let [namespace,pod,container] = file.path.split('/').slice(1)
            filemanObject.files = filemanObject.files.filter(f => f.path !== file.path)
            await sendCommand(FilemanCommandEnum.DELETE, namespace, pod, container, [file.path])
            setRefresh(Math.random())
        }
    }

    const onCreateFolder = (name: string, parentFolder: File) => {
        
    }

    const onDownload = (files: Array<IFileData>) => {
        
    }

    const onPaste = (files: Array<IFileData>, destFolder:IFileData, operation:string) => {
        console.log('paste', files)    
        let command = operation==='move'? FilemanCommandEnum.MOVE : FilemanCommandEnum.COPY
        for (let file of files) {
            let [namespace,pod,container] = file.path.split('/').slice(1)
            console.log(command, namespace, pod, container, [file.path, destFolder.path+'/'])
            sendCommand(command, namespace, pod, container, [file.path, destFolder.path+'/'])
        }        
    }

    const onError = (error: { type: string, message: string }, file: IFileData) => {
        props.channelObject.uiConfig.notify(error.message, 'error')
    }

    const onRename	= (file: IFileData, newName: string) => {
        let [namespace,pod,container] = file.path.split('/').slice(1)
        filemanObject.files = filemanObject.files.filter (f => f.path!==file.path)
        sendCommand(FilemanCommandEnum.RENAME, namespace, pod, container, [file.path, newName])
    }

    const onRefresh = () => {
        let level = currentPath.split('/').length - 1
        if (level > 2) {
            filemanObject.files = filemanObject.files.filter ( f => !f.path.startsWith(currentPath+'/'))
            getLocalDir(currentPath+'/')
        }
        else {
            sendCommand(FilemanCommandEnum.HOME, '', '', '', [])
        }

    }

    const sendCommand = (command: FilemanCommandEnum, namespace:string, pod:string, container:string,  params:string[]) => {
        if (!props.channelObject.webSocket)  return

        let filemanMessage:IFilemanMessage = {
            flow: InstanceMessageFlowEnum.REQUEST,
            action: InstanceMessageActionEnum.COMMAND,
            channel: 'fileman',
            type: InstanceMessageTypeEnum.DATA,
            accessKey: props.channelObject.accessString!,
            instance: props.channelObject.instanceId,
            id: uuidv4(),
            command: command,
            namespace: namespace,
            group: '',
            pod: pod,
            container: container,
            params: params,
            msgtype: 'filemanmessage'
        }
        let payload = JSON.stringify( filemanMessage )
        if (props.channelObject.webSocket) props.channelObject.webSocket.send(payload)
    }

    const getLocalDir = (folder:string) => {
        let [namespace,pod,container] = folder.split('/').slice(1)
        let filemanMessage:IFilemanMessage = {
            flow: InstanceMessageFlowEnum.REQUEST,
            action: InstanceMessageActionEnum.COMMAND,
            channel: 'fileman',
            type: InstanceMessageTypeEnum.DATA,
            accessKey: props.channelObject.accessString!,
            instance: props.channelObject.instanceId,
            id: uuidv4(),
            command: FilemanCommandEnum.DIR,
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
        setCurrentPath(folder)
        folder +='/'
        let level = folder.split('/').length - 1
        if (level > 2) getLocalDir(folder)
    }

    return <>
        { filemanObject.started &&
            <Box ref={filemanBoxRef} sx={{ display:'flex', flexDirection:'column', overflowY:'auto', overflowX:'hidden', width:'100%', flexGrow:1, height: `calc(100vh - ${logBoxTop}px - 25px)`}}>
                <FileManager files={filemanObject.files}
                    initialPath='/'
                    onError={onError}
                    onRename={onRename}
                    onPaste={onPaste}
                    onDelete={onDelete}
                    onFolderChange={onFolderChange}
                    onRefresh={onRefresh}
                    permissions={permissions}
                    fileUploadConfig={fuc}
                    primaryColor='#1976d2'
                />
            </Box>
        }
    </>
}
export { FilemanTabContent }