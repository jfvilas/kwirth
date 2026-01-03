import React from 'react'
import { Divider, Menu, MenuItem, MenuList } from '@mui/material'
import { IScopedObject } from './OpsData'

enum MenuObjectOption {
    DESCRIBE,
    RESTARTCONTAINER,
    RESTARTPOD,
    RESTARTNS,
    DELETEPOD,
    VIEWLOG,
    VIEWMETRICS
}

interface IProps {
    onClose:() => void
    onOptionSelected: (opt:MenuObjectOption, scopedObject:IScopedObject) => void
    anchorMenu: Element
    scopedObject: IScopedObject
}

const MenuObject: React.FC<IProps> = (props:IProps) => {

    return <Menu id='menu-logs' anchorEl={props.anchorMenu} open={Boolean(props.anchorMenu)} onClose={props.onClose}>
        <MenuList dense sx={{width:'180px'}}>
            <MenuItem key='describe' onClick={() => props.onOptionSelected(MenuObjectOption.DESCRIBE, props.scopedObject)}>&nbsp;Object info</MenuItem>
            <Divider/>
            <MenuItem key='log' onClick={() => props.onOptionSelected(MenuObjectOption.VIEWLOG, props.scopedObject)}>&nbsp;View container log</MenuItem>
            <MenuItem key='metrics' onClick={() => props.onOptionSelected(MenuObjectOption.VIEWMETRICS, props.scopedObject)}>&nbsp;View container metrics</MenuItem>
            <Divider/>
            <MenuItem key='restartcontainer' onClick={() => props.onOptionSelected(MenuObjectOption.RESTARTCONTAINER, props.scopedObject)}>&nbsp;Restart pod</MenuItem>
            <MenuItem key='restartpod' onClick={() => props.onOptionSelected(MenuObjectOption.RESTARTPOD, props.scopedObject)}>&nbsp;Restart pod</MenuItem>
            <MenuItem key='restartns' onClick={() => props.onOptionSelected(MenuObjectOption.RESTARTNS, props.scopedObject)}>&nbsp;Restart namespace</MenuItem>
        </MenuList>
    </Menu>
}

export { MenuObject, MenuObjectOption }