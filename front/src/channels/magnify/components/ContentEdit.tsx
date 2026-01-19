import { Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Stack, Typography } from '@mui/material'
import { IFileObject } from '@jfvilas/react-file-manager'
import { useEffect, useRef, useState } from 'react'
import CodeMirror from '@uiw/react-codemirror';
import { yaml } from '@codemirror/lang-yaml'
import { Close, Edit, Fullscreen, FullscreenExit, Minimize } from '@mui/icons-material';
import { objectEqual, reorderJsonYamlObject } from '../Tools';
const yamlParser = require('js-yaml');
//import { color } from '@uiw/react-codemirror'

interface IContentEditProps {
    selectedFile?:IFileObject
    content?: IContentEditObject
    newContent?: string
    onMinimize: (content:IContentEditObject) => void
    onClose: (content:IContentEditObject) => void
    onOk: (content:{code:string, source?:IFileObject}) => void
}

export interface IContentEditObject {
    type: 'edit'
    content: { code:string, title: string, source?:IFileObject, maximized?:boolean}
}

const ContentEdit: React.FC<IContentEditProps> = (props:IContentEditProps) => {
    const content = useRef<IContentEditObject>({ type:'edit', content:{code:'', title:''}})
    const [code, setCode] = useState<string>('')
    const [percent, setPercent] = useState<number>(70)
    const [editorUnChanged, setEditorUnChanged] = useState<boolean>(true)
   
    useEffect( () => {
        if (props.content) {
            content.current = props.content
            setPercent(content.current.content.maximized? 100 : 70)
            let areEqual = objectEqual(yamlParser.load(content.current.content.code), content.current.content.source)
            setEditorUnChanged(areEqual)
            setCode(content.current.content.code)
        }
        else if (props.selectedFile) {
            content.current.content.title = (props.selectedFile.data.origin.metadata.namespace? props.selectedFile.data.origin.metadata.namespace+'/': '') + props.selectedFile.data.origin.metadata.name
            let obj = props.selectedFile.data.origin
            let reorderObj = reorderJsonYamlObject(obj)
            content.current.content.code = yamlParser.dump(reorderObj)
            content.current.content.source = props.selectedFile.data.origin
            setCode(content.current.content.code)
            setPercent(70)
        }
        else if (props.newContent) {
            content.current.content.title = 'nonamespace/noname'
            content.current.content.code = props.newContent
            setCode(content.current.content.code)
            setPercent(70)
        }
    },[])

    const updateEditorValue= (newCode:any) => {
        content.current.content.code = newCode
        let x = yamlParser.load(content.current.content.code)
        setEditorUnChanged(objectEqual(x, content.current.content.source))
    }

    const minimize = () => {
        props.onMinimize(content.current)
    }

    const ok = () => {
        props.onOk({ code: content.current.content.code})
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
                    <Typography><Edit />&nbsp;{content.current.content.title}</Typography>
                    <Typography sx={{flexGrow:1}}></Typography>
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

            <DialogContent>
                <p></p>
                <CodeMirror value={code} onChange={updateEditorValue} extensions={[yaml()]}/>
            </DialogContent>

            <DialogActions>
                <Button onClick={ok} disabled={editorUnChanged}>Ok</Button>
                <Button onClick={minimize}>Cancel</Button>
            </DialogActions>
        </Dialog>
    )
}
export { ContentEdit }