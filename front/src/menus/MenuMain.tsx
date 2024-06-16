import React from 'react';
import { Divider, Menu, MenuItem, MenuList } from "@mui/material"
import { CreateNewFolderTwoTone, DeleteTwoTone, Edit, ExitToApp, FileOpenTwoTone, ImportExport, Key, Person, SaveAsTwoTone, SaveTwoTone, VerifiedUser } from '@mui/icons-material';

interface IProps {
    onClose:() => {};
    optionSelected: (a:string) => {};
    uploadSelected: (a:any) => {};
    anchorMenuConfig:any;
  }
  
const MenuMain: React.FC<any> = (props:IProps) => {

    const menu=(
        <>
            <Menu id='menu-kwirth' anchorEl={props.anchorMenuConfig} open={Boolean(props.anchorMenuConfig)} onClose={() => props.onClose()}>
            <MenuList dense>
                <MenuItem key='new' onClick={() => props.optionSelected('new')}><CreateNewFolderTwoTone/>&nbsp;New</MenuItem>
                <MenuItem key='open' onClick={() => props.optionSelected('open')}><FileOpenTwoTone/>&nbsp;Load</MenuItem>
                <MenuItem key='save' onClick={() => props.optionSelected('save')}><SaveTwoTone/>&nbsp;Save</MenuItem>
                <MenuItem key='saveas' onClick={() => props.optionSelected('saveas')}><SaveAsTwoTone/>&nbsp;Save as...</MenuItem>
                <MenuItem key='delete' onClick={() => props.optionSelected('delete')}><DeleteTwoTone/>&nbsp;Delete</MenuItem>
                <Divider/>
                <MenuItem key='cfgexp' onClick={() => props.optionSelected('cfgexp')}><ImportExport/>&nbsp;Export all configs (to downloadable file)</MenuItem>
                <MenuItem key='cfgimp' component='label'><input type="file" hidden accept=".kwirth.json" onChange={(event) => props.uploadSelected(event)}/><ImportExport/>&nbsp;Import new configs from file (and merge overwriting)</MenuItem>
                <Divider/>
                <MenuItem key='mc' onClick={() => props.optionSelected('mc')}><Edit/>&nbsp;Manage cluster list</MenuItem>
                <MenuItem key='asec' onClick={() => props.optionSelected('asec')}><Key/>&nbsp;API Security</MenuItem>
                <MenuItem key='usec' onClick={() => props.optionSelected('usec')}><Person />&nbsp;User security</MenuItem>
                <Divider/>
                <MenuItem key='exit' onClick={() => props.optionSelected('exit')}><ExitToApp />&nbsp;Exit Kwirth</MenuItem>
            </MenuList>
            </Menu>
        </>);
    
    return menu;
};

export default MenuMain;