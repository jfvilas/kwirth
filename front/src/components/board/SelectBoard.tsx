import { Stack, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Typography, List, ListItemButton, ListItem } from '@mui/material'

interface IProps {
    onSelect:(action:string, a?:string) => {},
    values:IValue[]
    action:string
}

interface IValue {
    name:string,
    description:string
}

const SelectBoard: React.FC<IProps> = (props:IProps) => {
   return (
        <Dialog open={true}>
            <DialogTitle>
                Select board
            </DialogTitle>
            <DialogContent>
                <DialogContentText>
                    <Stack direction='column' sx={{width:'50vh'}}>
                        <Typography>{
                            props.action === 'delete'? 'Select board to delete' : 'Select board to load'
                        }</Typography>
                        <List>
                            {props.values?.map(v => <ListItemButton onClick={() => props.onSelect(props.action, v.name)} key={v.name}>
                                <ListItem>
                                    <Stack direction={'column'}>
                                        <Typography>{v.name}</Typography>
                                        <Typography color={'darkgray'} fontSize={12}>{v.description}</Typography>
                                    </Stack>
                                </ListItem>
                            </ListItemButton>)}
                        </List>
                    </Stack>
                </DialogContentText>
            </DialogContent>
            <DialogActions>
                <Button onClick={() => props.onSelect(props.action)}>CANCEL</Button>
            </DialogActions>
        </Dialog>
    )
}

export { SelectBoard }