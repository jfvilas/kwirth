import { Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Stack, Typography } from '@mui/material'
import { IFileObject } from '@jfvilas/react-file-manager'
import { useEffect, useRef, useState } from 'react'
import CodeMirror from '@uiw/react-codemirror';
import { yaml } from '@codemirror/lang-yaml'
import { Close, Fullscreen, FullscreenExit, Minimize } from '@mui/icons-material';
import { objectEqual, reorderJsonYamlObject } from '../Tools';
const yamlParser = require('js-yaml');

interface IContentEditProps {
    selectedFile?:IFileObject
    content?: IContentEditObject
    newContent?: string
    onMinimize: (content:IContentEditObject) => void
    onClose: (content:IContentEditObject) => void
    onRefresh: () => void
    onOk: (content:{code:string, source?:IFileObject}) => void
}

export interface IContentEditObject {
    type: 'edit'
    editorContent: { code:string, title: string, source?:IFileObject, maximized?:boolean}
}

const ContentEdit: React.FC<IContentEditProps> = (props:IContentEditProps) => {
    const content = useRef<IContentEditObject>({ type:'edit', editorContent:{code:'', title:''}})
    const [code, setCode] = useState<string>('')
    const [ percent, setPercent ] = useState<number>(70)
    const [editorContentUnChanged, setEditorContentUnChanged] = useState<boolean>(true)
   
    useEffect( () => {
        if (props.content) {
            content.current = props.content
            setPercent(content.current.editorContent.maximized? 100 : 70)
            setCode(content.current.editorContent.code)
        }
        else if (props.selectedFile) {
            content.current.editorContent.title = (props.selectedFile.data.origin.metadata.namespace? props.selectedFile.data.origin.metadata.namespace+'/': '') + props.selectedFile.data.origin.metadata.name
            let obj = props.selectedFile.data.origin
            let reorderObj = reorderJsonYamlObject(obj)
            setCode(yamlParser.dump(reorderObj))
            setPercent(70)
        }
        else if (props.newContent) {
            content.current.editorContent.title = 'nons/noname'
            setCode(props.newContent)            
            setPercent(70)
        }
    },[])

    const updateEditorValue= (newCode:any) => {
        content.current.editorContent.code = newCode
        setEditorContentUnChanged(objectEqual(yamlParser.load(content.current.editorContent.code), content.current.editorContent.source?.data.origin))
    }

    const minimize = () => {
        props.onMinimize(content.current)
    }

    const ok = () => {
        props.onOk({ code: content.current.editorContent.code})
    }

    const maximizeOrRestore = () => {
        if (content.current.editorContent.maximized) {
            content.current.editorContent.maximized = false
            setPercent(70)
        }
        else {
            content.current.editorContent.maximized = true
            setPercent(100)
        }
    }

    const close = () => {
        props.onClose(content.current!)
    }

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
                <Stack direction={'row'} alignItems={'center'}>                    
                    <Typography sx={{flexGrow:1}}></Typography>
                    <Typography>{content.current.editorContent.title}</Typography>
                    <Typography sx={{flexGrow:1}}></Typography>
                    <IconButton onClick={minimize}>
                        <Minimize />
                    </IconButton>
                    <IconButton onClick={maximizeOrRestore}>
                        { content.current?.editorContent.maximized? <FullscreenExit/> : <Fullscreen/> }
                    </IconButton>
                    <IconButton onClick={close}>
                        <Close />
                    </IconButton>
                </Stack>

            </DialogTitle>
            <DialogContent>
                <p></p>
                <CodeMirror value={code} onChange={updateEditorValue} extensions={[yaml()]}/>
            </DialogContent>
            <DialogActions>
                <Button onClick={ok} disabled={editorContentUnChanged}>Ok</Button>
                <Button onClick={minimize}>Cancel</Button>
            </DialogActions>
        </Dialog>
    )
}
export { ContentEdit }