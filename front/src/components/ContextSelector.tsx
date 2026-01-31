import React, { useContext, useRef, useState } from 'react'
import { Button, Dialog, DialogContent, DialogTitle, IconButton, List, ListItemButton, Stack, Tab, Tabs, Typography} from '@mui/material'
import { SessionContext, SessionContextType } from '../model/SessionContext'
import { useAsync } from 'react-use'
import { InputBox } from '../tools/FrontTools'
import { Delete } from '@mui/icons-material'

interface IProps {
    onClusterSelectLocal: (id:string) => void,
    onClusterSelectRemote: (id:string, url:string) => void
}

const ContextSelector: React.FC<IProps> = (props:IProps) => {
    const {backendUrl} = useContext(SessionContext) as SessionContextType
    const [selectedTab, setSelectedTab] = useState(0)
    const [localClusters, setLocalClusters] = useState<string[]>([])
    const [remoteClusters, setRemoteClusters] = useState<{name:string, url:string}[]>([])
    useAsync( async () => {
        let resp = await fetch(backendUrl+'/config/kubeconfig')
        setLocalClusters(await resp.json())
        let rc = localStorage.getItem('remoteClusters')
        if (rc) setRemoteClusters(JSON.parse(rc))
    })
    const newCluster = useRef<string>('')
    const [inputBoxTitle, setInputBoxTitle] = useState<any>()
    const [inputBoxMessage, setInputBoxMessage] = useState<any>()
    const [inputBoxResult, setIinputBoxResult] = useState<(result:any) => void>()

    const addRemoteCluster = () => {
        setIinputBoxResult ( () => (name:any) => {
            newCluster.current = name
            setIinputBoxResult ( () => (url:any) => {
                let newRemotes = [...remoteClusters, { name:newCluster.current, url}]
                localStorage.setItem('remoteClusters', JSON.stringify(newRemotes))
                setRemoteClusters(newRemotes)
            })
            setInputBoxMessage('Enter Kwirth URL')
            setInputBoxTitle('Add cluster')
        })
        setInputBoxMessage('Enter cluster name')
        setInputBoxTitle('Add cluster')
    }

    const deleteRemoteCluster = (name:string) => {
        let newRemotes = remoteClusters.filter(c => c.name!==name)
        localStorage.setItem('remoteClusters', JSON.stringify(newRemotes))
        setRemoteClusters(newRemotes)
    }

    return (<>
        <Dialog open={true} disableRestoreFocus={true}>
            <DialogTitle>Select cluster</DialogTitle>
            <DialogContent sx={{height:350, width:450}}>
                <Tabs value={selectedTab} onChange={(_event, index) => setSelectedTab(index)} centered>
                    <Tab key='local' value={0} label='Local (Kubeconfig)'/>
                    <Tab key='remote' value={1} label='remote (Kwirth)'/>
                </Tabs>
                
                { selectedTab === 0 &&
                    <Stack direction={'column'} sx={{height:300, overflowY:'auto' }}>
                        <List>
                        {
                            localClusters.map(c => 
                                <ListItemButton key={c} onClick={() => props.onClusterSelectLocal(c)}>
                                    <Typography>{c}</Typography>
                                </ListItemButton>
                            )
                        }
                        </List>
                    </Stack>
                }
                { selectedTab === 1 &&
                    <>
                    <Stack direction={'column'} sx={{height:250, overflowY:'auto'}}>
                        <List>
                        {
                            remoteClusters.map(c => 
                                <Stack key={c.name} direction={'row'} sx={{wodth:'100%'}}>
                                    <ListItemButton onClick={() => props.onClusterSelectRemote(c.name, c.url)}>
                                        <Typography>{c.name}</Typography>
                                    </ListItemButton>
                                    <IconButton onClick={() => deleteRemoteCluster(c.name)}>
                                        <Delete />
                                    </IconButton>                                    
                                </Stack>
                            )
                        }
                        </List>
                    </Stack>
                    <Button onClick={addRemoteCluster} sx={{ml:1, mt:1}}>Add cluster</Button>
                    </>
                }

            </DialogContent>
        </Dialog>
        <InputBox title={inputBoxTitle} message={inputBoxMessage} onClose={() => setInputBoxTitle(undefined)} onResult={inputBoxResult}/>
    </>)
}

export { ContextSelector }
