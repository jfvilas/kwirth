import { Stack, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Typography, TextField, ListItemButton } from '@mui/material';
import { ChangeEvent, useEffect, useState } from 'react';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';

interface IProps {
    onClose:({}) => {},
    names:string[]
}
const LoadConfig: React.FC<any> = (props:IProps) => {
    const [names, setNames] = useState<string[]|null>(null);

    useEffect( () =>{
        if (names===null) {
            var n=[];
            for (var key in localStorage){
                if (key.startsWith('kwirth.config.')) n.push(key.substring(13));
            }
            setNames(n);
        }
    });

    return (
        <Dialog open={true}>
            <DialogTitle>
                Load config
            </DialogTitle>
            <DialogContent>
                <DialogContentText>
                    <Stack direction='column' alignItems={'center'}>
                        <Typography>Select the config you want to load:</Typography>
                        <List>
                            {names?.map(n => <ListItemButton onClick={() => props.onClose({name:n})}><ListItem key={n}>{n}</ListItem></ListItemButton>)}
                        </List>
                    </Stack>
                </DialogContentText>
            </DialogContent>
            <DialogActions>
                <Button onClick={() => props.onClose({})}>CANCEL</Button>
            </DialogActions>
        </Dialog>
    )
}

export default LoadConfig;