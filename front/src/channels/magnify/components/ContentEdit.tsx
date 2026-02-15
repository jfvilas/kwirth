import { Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Stack, Typography } from '@mui/material'
import { IFileObject } from '@jfvilas/react-file-manager'
import { useEffect, useRef, useState } from 'react'
import CodeMirror from '@uiw/react-codemirror';
import { EditorState } from "@codemirror/state";
import { yaml } from '@codemirror/lang-yaml'
import { Close, Edit, EditOff, Fullscreen, FullscreenExit, Minimize } from '@mui/icons-material';
import { objectEqual, reorderJsonYamlObject } from '../Tools';
import { search, openSearchPanel, searchKeymap } from '@codemirror/search'; // Asegúrate de importar 'search'
import { EditorView, keymap } from '@codemirror/view';
import { defaultKeymap } from '@codemirror/commands';

const yamlParser = require('js-yaml');

export interface IContentEditObject {
    type: 'edit'
    allowEdit:boolean,
    content: { code:string, title: string, source?:IFileObject, maximized?:boolean}
}

interface IContentEditProps {
    selectedFile?: IFileObject
    content?: IContentEditObject
    newContent?: string
    allowEdit: boolean
    onMinimize: (content:IContentEditObject) => void
    onClose: (content:IContentEditObject) => void
    onOk: (content:{code:string, source?:IFileObject}) => void
}

const ContentEdit: React.FC<IContentEditProps> = (props:IContentEditProps) => {
    const content = useRef<IContentEditObject>({ type:'edit', allowEdit:true, content:{code:'', title:''}})
    const [code, setCode] = useState<string>('')
    const [percent, setPercent] = useState<number>(70)
    const [editorUnChanged, setEditorUnChanged] = useState<boolean>(true)

    const containerRef = useRef<HTMLDivElement>(null);
    const editorViewRef = useRef<EditorView | null>(null);

    useEffect(() => {
        const handleNativeKey = (e: KeyboardEvent) => {
            if (!containerRef.current?.contains(document.activeElement)) return;

            const isCtrl = e.ctrlKey || e.metaKey;
            
            if (isCtrl && e.key.toLowerCase() === 'f') {
                e.preventDefault(); // Bloquea navegador
                e.stopPropagation(); // Bloquea otros listeners
                
                if (editorViewRef.current) {
                    openSearchPanel(editorViewRef.current);
                }
            }
            
            if (isCtrl && e.key.toLowerCase() === 'd') {
                e.preventDefault();
                e.stopPropagation();
            }
        };

        window.addEventListener('keydown', handleNativeKey, true);
        return () => window.removeEventListener('keydown', handleNativeKey, true);
    }, []);

    useEffect( () => {
        if (props.content) {
            content.current = props.content
            setPercent(content.current.content.maximized? 100 : 70)
            let areEqual = objectEqual(yamlParser.load(content.current.content.code), content.current.content.source)
            setEditorUnChanged(areEqual)
            setCode(content.current.content.code)
        }
        else if (props.selectedFile) {
            if (props.selectedFile.data.origin.metadata)
                content.current.content.title = (props.selectedFile.data.origin.metadata.namespace? props.selectedFile.data.origin.metadata.namespace+'/': '') + props.selectedFile.data.origin.metadata.name
            else {
                // this is valid for API Resources
                content.current.content.title = props.selectedFile.data.origin.name
            }
            let obj = props.selectedFile.data.origin
            let reorderObj = reorderJsonYamlObject(obj)
            content.current.content.code = yamlParser.dump(reorderObj)
            content.current.content.source = props.selectedFile.data.origin
            content.current.allowEdit = props.allowEdit
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
                    <Typography>{props.allowEdit?<Edit />:<EditOff/>}&nbsp;{content.current.content.title}</Typography>
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
                <div ref={containerRef} tabIndex={-1} style={{ height: '100%', width: '100%' }}>
                    <CodeMirror value={code}
                        onChange={updateEditorValue} 
                        onUpdate={(v) => { if (v.view) editorViewRef.current = v.view }}                    
                        extensions={[
                            EditorState.readOnly.of(!props.allowEdit),
                            yaml(),
                            search({ top: true }),
                            keymap.of([
                                ...defaultKeymap,
                                ...searchKeymap,
                            ])
                        ]}
                    />
                </div>
            </DialogContent>

            <DialogActions>
                <Button onClick={ok} disabled={editorUnChanged}>Ok</Button>
                <Button onClick={minimize}>Cancel</Button>
            </DialogActions>
        </Dialog>
    )
}
export { ContentEdit }