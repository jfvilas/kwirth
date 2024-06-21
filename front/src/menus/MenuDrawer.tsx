import React, { useState } from 'react';
import { Divider, Drawer, Menu, MenuItem, MenuList } from "@mui/material"
import { CreateNewFolderTwoTone, DeleteTwoTone, Edit, ExitToApp, FileOpenTwoTone, ImportExport, Key, Person, SaveAsTwoTone, SaveTwoTone, VerifiedUser } from '@mui/icons-material';

interface IProps {
    optionSelected: (a:string) => {};
    uploadSelected: (a:any) => {};
  }
  
const MenuDrawer: React.FC<any> = (props:IProps) => {
    const [drawerOpen,setDrawerOpen]=useState(true);

    const optionSelected = (a:string) => {
        props.optionSelected(a);
    }

    const menu=(
        <MenuList>
            <MenuItem key='new' onClick={() => optionSelected('new')}><CreateNewFolderTwoTone/>&nbsp;New</MenuItem>
            <MenuItem key='open' onClick={() => optionSelected('open')}><FileOpenTwoTone/>&nbsp;Load</MenuItem>
            <MenuItem key='save' onClick={() => optionSelected('save')}><SaveTwoTone/>&nbsp;Save</MenuItem>
            <MenuItem key='saveas' onClick={() => optionSelected('saveas')}><SaveAsTwoTone/>&nbsp;Save as...</MenuItem>
            <MenuItem key='delete' onClick={() => optionSelected('delete')}><DeleteTwoTone/>&nbsp;Delete</MenuItem>
            <Divider/>
            <MenuItem key='cfgexp' onClick={() => optionSelected('cfgexp')}><ImportExport/>&nbsp;Export all configs (to downloadable file)</MenuItem>
            <MenuItem key='cfgimp' component='label'><input type="file" hidden accept=".kwirth.json" onChange={(event) => props.uploadSelected(event)}/><ImportExport/>&nbsp;Import new configs from file (and merge overwriting)</MenuItem>
            <Divider/>
            <MenuItem key='mc' onClick={() => optionSelected('mc')}><Edit/>&nbsp;Manage cluster list</MenuItem>
            <MenuItem key='asec' onClick={() => optionSelected('asec')}><Key/>&nbsp;API Security</MenuItem>
            <MenuItem key='usec' onClick={() => optionSelected('usec')}><Person />&nbsp;User security</MenuItem>
            <Divider/>
            <MenuItem key='exit' onClick={() => optionSelected('exit')}><ExitToApp />&nbsp;Exit Kwirth</MenuItem>
        </MenuList>
    );
    
    return menu;
};

export default MenuDrawer;
