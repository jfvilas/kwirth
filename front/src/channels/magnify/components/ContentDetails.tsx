import { Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Stack, Typography } from '@mui/material'
import { IFileObject } from '@jfvilas/react-file-manager'
import { useEffect, useRef, useState } from 'react'
import { Close, ContentCopy, Delete, Edit, Fullscreen, FullscreenExit, Minimize } from '@mui/icons-material';
import { DetailsObject, IDetailsSection } from './DetailsObject';
const copy = require('clipboard-copy')

interface IContentDetailsProps {
    selectedFile?:IFileObject
    content?: IContentDetailsObject
    sections: IDetailsSection[]
    onApply: (path:string) => void
    onEdit: (path:string) => void
    onDelete: (path:string) => void
    onMinimize: (content:IContentDetailsObject) => void
    onClose: (content:IContentDetailsObject) => void
}

export interface IContentDetailsObject {
    type: 'details'
    content: { path:string, title: string, source:IFileObject, maximized:boolean}
}

const ContentDetails: React.FC<IContentDetailsProps> = (props:IContentDetailsProps) => {
    console.log('renderstart')
    const content = useRef<IContentDetailsObject>({ type:'details', content:{path:'', title:'', source: {name:'', isDirectory:false, path:''}, maximized:false}})
    const [percent, setPercent] = useState<number>(70)
    const [containsEdit, setContainsEdit] = useState<boolean>(false)
   
    useEffect( () => {
        if (props.content) {
            content.current = props.content
            setPercent(content.current.content.maximized? 100 : 70)
        }
        else if (props.selectedFile) {
            content.current.content.title = (props.selectedFile.data.origin.metadata.namespace? props.selectedFile.data.origin.metadata.namespace+'/': '') + props.selectedFile.data.origin.metadata.name
            content.current.content.path = props.selectedFile.path
            content.current.content.source = props.selectedFile
            setPercent(70)
        }
        else {
            //+++ must not happen
        }
    },[])

    const minimize = () => {
        props.onMinimize(content.current)
    }

    const maximizeOrRestore = () => {
        if (content.current.content.maximized) {
            content.current.content.maximized = false
            setPercent(70)
        }
        else {
            content.current.content.maximized = true
            setPercent(100)
        }
    }

    const apply = () => {
        props.onApply(content.current.content.path)
    }

    const close = () => {
        props.onClose(content.current)
    }

    const editObject = () => {
        props.onEdit(content.current.content.path)
    }

    const deleteObject = () => {
        props.onDelete((content.current.content.path))
    }

    console.log('render')

    return (
        <Dialog open={true} 
            sx={{
            '& .MuiDialog-paper': {
                width: `${percent}vw`,
                height: `${percent}vh`,
                maxWidth: `${percent}vw`,
                maxHeight: `${percent}vh`
            },
            }}>
            <DialogTitle>
                <Stack direction='row' alignItems={'center'}>
                    <Typography fontSize={18}>{content.current.content.source.data?.origin.kind+': '+content.current.content.source.data?.origin.metadata?.name}</Typography>
                    <IconButton color='primary' onClick={() => copy(content.current.content.source.data?.origin.metadata?.name)}><ContentCopy fontSize='small'/></IconButton>
                    <IconButton color='primary' onClick={editObject}><Edit fontSize='small'/></IconButton>
                    <IconButton color='primary' onClick={deleteObject}><Delete fontSize='small'/></IconButton>

                    <Typography sx={{flexGrow:1}}/>

                    <IconButton onClick={minimize}>
                        <Minimize />
                    </IconButton>
                    <IconButton onClick={maximizeOrRestore}>
                        { content.current?.content.maximized? <FullscreenExit/> : <Fullscreen/> }
                    </IconButton>
                    <IconButton onClick={close}>
                        <Close />
                    </IconButton>
                </Stack>
            </DialogTitle>
            <DialogContent sx={{scrollbarGutter: 'stable'}}>
                <DetailsObject object={content.current.content.source} sections={props.sections} onChangeData={() => {}} onLink={() => {}} onContainsEdit={(val:boolean) => setContainsEdit(val)}/>
            </DialogContent>
            <DialogActions>
                { containsEdit && <Button onClick={apply}>Apply</Button>}
                <Button onClick={close}>Close</Button>
            </DialogActions>
        </Dialog>
    )
}
export { ContentDetails }