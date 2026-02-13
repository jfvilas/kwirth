import { Box, Divider, Menu, MenuItem, MenuList, Stack, Typography } from '@mui/material'
import React from 'react'


interface IProps {
    f: any
    onClose?:() => void
    onContainerSelected: (container:string) => void
    includeAllContainers: boolean
    anchorParent: Element
}

const ContainersMenu: React.FC<IProps> = (props:IProps) => {
    if (props.f.data.origin.status.containerStatuses.length===1) {
        props.onContainerSelected(props.f.data.origin.status.containerStatuses[0].name)
        return <></>
    }

    return <Menu id='menu-logs' anchorEl={props.anchorParent} open={Boolean(props.anchorParent)} onClose={props.onClose}>
        <MenuList dense sx={{minWidth: 120}}>
            {
                props.f.data.origin.status.containerStatuses.map ( (cs:any) =>  {

                    let color='orange'
                    if (cs.started) {
                        color='green'
                        if (props.f.data.origin.metadata.deletionTimestamp) color = 'blue'
                    }
                    else {
                        if (cs.state.terminated) color = 'gray'
                    }
                    return <MenuItem key={cs.name} onClick={() => props.onContainerSelected(cs.name)}>
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
                    <MenuItem key={'all'} onClick={() => props.onContainerSelected('*all')}>
                        <Typography>All containers</Typography>
                    </MenuItem>
                </>
            }
        </MenuList>
    </Menu>
}

export { ContainersMenu }