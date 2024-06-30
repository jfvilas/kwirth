import React from 'react';
import { Divider, MenuItem, MenuList } from "@mui/material"
import { BrowserUpdated, CreateNewFolderTwoTone, DeleteTwoTone, Edit, ExitToApp, FileOpenTwoTone, ImportExport, Key, Person, SaveAsTwoTone, SaveTwoTone } from '@mui/icons-material';
import { User } from '../model/User';

enum MenuDrawerOption {
    ViewNew,
    ViewOpen,
    ViewSave,
    ViewSaveAs,
    ViewDelete,
    ViewImport,
    ViewExport,
    ManageCluster,
    UserSecurity,
    UpdateKwirth,
    ApiSecurity,
    Exit
}
interface IProps {
    optionSelected: (opt:MenuDrawerOption) => {};
    uploadSelected: (a:any) => {};
    user:User;
  }
  
const MenuDrawer: React.FC<any> = (props:IProps) => {

    const optionSelected = (opt:MenuDrawerOption) => {
        props.optionSelected(opt);
    }

    const menu=(
        <MenuList sx={{height:'85vh'}}>
            <MenuItem key='new' onClick={() => optionSelected(MenuDrawerOption.ViewNew)}><CreateNewFolderTwoTone/>&nbsp;New</MenuItem>
            <MenuItem key='open' onClick={() => optionSelected(MenuDrawerOption.ViewOpen)}><FileOpenTwoTone/>&nbsp;Load</MenuItem>
            <MenuItem key='save' onClick={() => optionSelected(MenuDrawerOption.ViewSave)}><SaveTwoTone/>&nbsp;Save</MenuItem>
            <MenuItem key='saveas' onClick={() => optionSelected(MenuDrawerOption.ViewSaveAs)}><SaveAsTwoTone/>&nbsp;Save as...</MenuItem>
            <MenuItem key='delete' onClick={() => optionSelected(MenuDrawerOption.ViewDelete)}><DeleteTwoTone/>&nbsp;Delete</MenuItem>
            <Divider/>
            <MenuItem key='cfgexp' onClick={() => optionSelected(MenuDrawerOption.ViewExport)}><ImportExport/>&nbsp;Export all configs (to downloadable file)</MenuItem>
            <MenuItem key='cfgimp' component='label'><input type="file" hidden accept=".kwirth.json" onChange={(event) => props.uploadSelected(event)}/><ImportExport/>&nbsp;Import new configs from file (and merge overwriting)</MenuItem>
            { props.user.roles.includes('admin') && 
                <div>
                    <Divider/>
                    <MenuItem key='mc' onClick={() => optionSelected(MenuDrawerOption.ManageCluster)}><Edit/>&nbsp;Manage cluster list</MenuItem>
                    <MenuItem key='asec' onClick={() => optionSelected(MenuDrawerOption.ApiSecurity)}><Key/>&nbsp;API Security</MenuItem>
                    <MenuItem key='usec' onClick={() => optionSelected(MenuDrawerOption.UserSecurity)}><Person />&nbsp;User security</MenuItem>
                    <Divider/>
                    <MenuItem key='ukwirth' onClick={() => optionSelected(MenuDrawerOption.UpdateKwirth)}><BrowserUpdated />&nbsp;Update Kwirth</MenuItem>
                </div>
            }
            <Divider/>
            <MenuItem key='exit' onClick={() => optionSelected(MenuDrawerOption.Exit)}><ExitToApp />&nbsp;Exit Kwirth</MenuItem>
        </MenuList>
    );
    
    return menu;
};

export { MenuDrawer, MenuDrawerOption };
