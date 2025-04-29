import { Stack, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Typography, List, ListItemButton, ListItem } from '@mui/material'
import { IShell } from '../../model/OpsObject'
import { useEffect, useState } from 'react'

interface IProps {
    onSelect:(index:number) => void
    current: number
    shells: IShell[]
}

const SelectTerminal: React.FC<IProps> = (props:IProps) => {
    const [selectedIndex, setSelectedIndex] = useState(props.current)
    
    const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'ArrowDown') {
            setSelectedIndex(prev => (prev + 1) % props.shells.length)
        }
        else if (event.key === 'ArrowUp') {
            setSelectedIndex(prev => (prev - 1 + props.shells.length) % props.shells.length)
        }
        else if (event.key === 'Enter') {
            props.onSelect(selectedIndex)
        }
        else if (event.key === 'Escape') {
            // +++ does not work, pending review
            props.onSelect(-1)
        }
      }

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [selectedIndex])
      
      
   return (
        <Dialog open={true}>
            <DialogTitle>
                Select terminal
            </DialogTitle>
            <DialogContent>
                <DialogContentText>
                    <Stack direction='column' sx={{width:'50vh'}}>
                        <Typography>
                            Select terminal to switch to
                        </Typography>
                        <List>
                            {props.shells?.map( (shell,index) => <ListItemButton onClick={() => props.onSelect(index)} key={shell.namespace+'/'+shell.pod+'/'+shell.container} selected={index === selectedIndex} disabled={!shell.connected}>
                                <ListItem>
                                    <Stack direction={'row'} sx={{width:'100%'}}>
                                        <Typography flex={1}>{shell.namespace+'/'+shell.pod+'/'+shell.container}</Typography>
                                        { (index<10) && <Typography>{'F'+(index+1).toString()}</Typography> }
                                    </Stack>
                                </ListItem>
                            </ListItemButton>)}
                        </List>
                    </Stack>
                </DialogContentText>
            </DialogContent>
            <DialogActions>
                <Button onClick={() => props.onSelect(-1)}>CANCEL</Button>
            </DialogActions>
        </Dialog>
    )
}

export { SelectTerminal }