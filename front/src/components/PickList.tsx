import { Stack, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Typography, List , ListItemButton , ListItem } from '@mui/material'
import { PickListConfig } from '../model/PickListConfig'

interface IProps {
    config:PickListConfig
}

const PickList: React.FC<any> = (props:IProps) => {
    return (
        <Dialog open={true}>
            <DialogTitle>
                {props.config.title}
            </DialogTitle>
            <DialogContent>
                <DialogContentText>
                    <Stack direction='column' sx={{width:'50vh'}}>
                        <Typography>{props.config.message}</Typography>
                        <List>
                            {props.config.values?.map(v => <ListItemButton onClick={() => props.config.onClose(v)}><ListItem key={v}>{v}</ListItem></ListItemButton>)}
                        </List>
                    </Stack>
                </DialogContentText>
            </DialogContent>
            <DialogActions>
                <Button onClick={() => props.config.onClose(null)}>CANCEL</Button>
            </DialogActions>
        </Dialog>
    )
}

export default PickList