import { Box, Divider, Menu, MenuItem, MenuList, Stack, Typography } from '@mui/material'
import React from 'react'


interface IProps {
    f: any
    onClose?:() => void
    onOptionSelected: (container:string) => void
    includeAllContainers: boolean
    anchorParent: Element
}

const LeftItemContainersMenu: React.FC<IProps> = (props:IProps) => {
    let result:JSX.Element[]=[]
    if (props.f.data.origin.status.containerStatuses && props.f.data.origin.status.containerStatuses.length>0) {
        for (let c of props.f.data.origin.status.containerStatuses) {
            let color='orange'
            if (c.started) {
                color='green'
                if (props.f.data.origin.metadata.deletionTimestamp) color = 'blue'
            }
            else {
                if (c.state.terminated) color = 'gray'
            }
            result.push(<Box sx={{ width: '8px', height: '8px', backgroundColor: color, margin: '1px', display: 'inline-block' }}/>)
        }
    }
    return <Menu id='menu-logs' anchorEl={props.anchorParent} open={Boolean(props.anchorParent)} onClose={props.onClose}>
        <MenuList dense sx={{minWidth: 120}}>
            {
                props.f.data.origin.status.containerStatuses.map ( (cs:any) =>  {
                    let color='green'
                    if (!cs.started || props.f.data.origin.metadata.deletionTimestamp) color='orange'
                    return <MenuItem key={cs.name} onClick={() => props.onOptionSelected(cs.name)}>
                        <Stack direction={'row'} alignItems={'center'}>
                            <Box sx={{ width: '10px', height: '10px', backgroundColor: color, margin: '1px', display: 'inline-block' }}/>
                            <Typography>&nbsp;{cs.name}</Typography>
                        </Stack>
                    </MenuItem>
                })
            }
            { props.includeAllContainers && 
                <>
                    <Divider/>
                    <MenuItem key={'all'} onClick={() => props.onOptionSelected('*all')}>
                        <Typography>All containers</Typography>
                    </MenuItem>
                </>
            }
        </MenuList>
    </Menu>
}

export { LeftItemContainersMenu as LeftItemMenu }