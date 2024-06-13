import React, { useState, useRef, ChangeEvent, useEffect } from 'react';
import { Box, Button, Divider, FormControl, IconButton, InputLabel, Menu, MenuItem, MenuList, Select, SelectChangeEvent, Stack, Tab, Tabs, TextField, Typography } from '@mui/material';
import { Check, KeyboardArrowDown, CreateNewFolderTwoTone, DeleteTwoTone, FileOpenTwoTone, Pause, PlayArrow, RemoveCircleRounded, SaveAsTwoTone, SaveTwoTone, Settings, Start, Stop, Info, Key, Edit, ExitToApp, VerifiedUser, ArrowUpward, ArrowDownward, ImportExport } from '@mui/icons-material';

// model
import { Alert } from './model/Alerts';
import { ATab } from './model/ATab';
import { Cluster } from './model/Cluster';

// tools
import { SnackbarKey, closeSnackbar, enqueueSnackbar } from 'notistack';
import { Beep } from './tools/Beep';
import { PickListConfig } from './model/PickListConfig';
import { PopupConfig } from './model/PopupConfig';

// components
import BlockingAlert from './components/BlockingAlert';
import AlertConfig from './components/AlertConfig';
import RenameTab from './components/RenameTab';
import SaveConfig from './components/SaveConfig';
import ManageApiSecurity from './components/ManageApiSecurity';
import PickList from './components/PickList';
import Popup from './components/Popup';
import Login from './components/Login';
import ManageClusters from './components/ManageClusters';
import ManageUserSecurity from './components/ManageUserSecurity';
//import { config } from 'process';

const App: React.FC = () => {
  const [logged,setLogged]=useState(false);
  const [apiKey,setApiKey]=useState('');

  var backend='http://localhost:3883';
  if ( process.env.NODE_ENV==='production') backend=window.location.protocol+'//'+window.location.host;

  const [scope, setScope] = useState('cluster');
  
  const [pickListConfig, setPickListConfig] = useState<PickListConfig|null>(null);
  var pickListConfigRef=useRef(pickListConfig);
  pickListConfigRef.current=pickListConfig;

  const [popupConfig, setPopupConfig] = useState<PopupConfig|null>(null);
  var popupConfigRef=useRef(popupConfig);
  popupConfigRef.current=popupConfig;

  const [currentCluster, setCurrentCluster] = useState<Cluster>();
  const [selectedCluster, setSelectedCluster] = useState<Cluster>();
  const [selectedClusterName, setSelectedClusterName] = useState('');
  const [clusters, setClusters] = useState<Cluster[]>();
  const clustersRef = useRef(clusters);
  clustersRef.current=clusters;

  const [namespace, setNamespace] = useState('');
  const [namespaces, setNamespaces] = useState<string[]>([]);
  const [namespaceSelectDisabled, setNamespaceSelectDisabled] = useState(true);

  const [obj, setObj] = useState('');
  const [objs, setObjs] = useState<string[]>([]);
  const [objSelectDisabled, setObjSelectDisabled] = useState(true);

  const [tabs, setTabs] = useState<ATab[]>([]);
  const [highlightedTabs, setHighlightedTabs] = useState<ATab[]>([]);

  const [selectedTabname, setSelectedTabname] = useState<string>();
  const selectedTabRef = useRef(selectedTabname);
  selectedTabRef.current=selectedTabname;
  var selectedTabObject = tabs.find(t => t.tabname===selectedTabname);
  var selectedTabIndex = tabs.findIndex(t => t.tabname===selectedTabname);

  const [paused, setPaused] = useState<boolean>(false);
  const [messages, setMessages] = useState<string[]>([]);

  const [startDisabled, setStartDisabled] = useState<boolean>(false);
  const [controlsVisible, setControlsVisible] = useState<boolean>(false);

  const [user, setUser] = useState<string>('');
  const [filter, setFilter] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [searchPos, setSearchPos] = useState<number>(0);
  const [searchFirstPos, setSearchFirstPos] = useState<number>(-1);
  const [searchLastPos, setSearchLastPos] = useState<number>(-1);

  const [showAlertConfig, setShowAlertConfig]=useState<boolean>(false);
  const [showBlockingAlert, setShowBlockingAlert]=useState<boolean>(false);
  const [showRenameTab, setShowRenameTab]=useState<boolean>(false);
  const [showManageClusters, setShowManageClusters]=useState<boolean>(false);
  const [showSaveConfig, setShowSaveConfig]=useState<boolean>(false);
  const [showApiSecurity, setShowApiSecurity]=useState<boolean>(false);
  const [showUserSecurity, setShowUserSecurity]=useState<boolean>(false);
  const [showPickList, setShowPickList]=useState<boolean>(false);
  const [showPopup, setShowPopup]=useState<boolean>(false);
  const [blockingAlert, setBlockingAlert] = useState<Alert>();
  const [configLoaded, setConfigLoaded] = useState<boolean>(false);
  const [configName, setConfigName] = useState('');

  useEffect ( () => {
    if (logged && !clustersRef.current) getClusters();
  });

  useEffect ( () => {
    if (logged) {
      setConfigLoaded(false);
      if (tabs.length>0) {
        for (var t of tabs) {
          start(t);
        }
        onChangeTabs(null, tabs[0].tabname);
      }
    }
  }, [configLoaded]);

  const getClusters = async () => {
    // get current cluster
    var response = await fetch(`${backend}/config/cluster`, { headers:{Auhtorization:apiKey}});
    var srcCluster = await response.json() as Cluster;
    srcCluster.url=backend;
    srcCluster.source=true;
    srcCluster.apiKey=apiKey;
    setCurrentCluster(srcCluster);

    // get previously configured clusters
    var lsClusters:Cluster[]=[];
    var data=localStorage.getItem('kwirth.clusters');
    if (data) lsClusters=JSON.parse(data);
    lsClusters=lsClusters.filter (c => c.name!==srcCluster.name);
    for (var c of lsClusters) {
      if (c.source) delete c.source;
    }
    lsClusters.push(srcCluster);
    localStorage.setItem('kwirth.clusters', JSON.stringify(lsClusters));
    setClusters(lsClusters);
  }

  const getNamespaces = async () => {
    var response = await fetch(`${selectedCluster!.url}/config/namespace?cluster=${selectedClusterName}`,{headers:{'Authorization':selectedCluster!.apiKey}});
    var data = await response.json();
    setNamespaces(data);
  }

  const getObjs = async (namespace:string) => {
    var response = await fetch(`${selectedCluster!.url}/config/${namespace}/${scope}?cluster=${selectedClusterName}`,{headers:{'Authorization':selectedCluster!.apiKey}});
    var data = await response.json();
    setObjs(data);
  }
  
  const onChangeCluster = (event: SelectChangeEvent) => {
    var value=event.target.value;
    setSelectedClusterName(value);
    setSelectedCluster(clusters?.filter(c => c.name===value)[0]!);
    setScope('cluster');
    setNamespaceSelectDisabled(true);
    setObjSelectDisabled(true);
  };

  const onChangeScope = (event: SelectChangeEvent) => {
    var value=event.target.value;
    setScope(value);
    if (value!=='cluster') getNamespaces();
    setNamespaceSelectDisabled(value==='cluster')
    setObjSelectDisabled(value==='cluster')
  };
  const onChangeNamespace = (event: SelectChangeEvent) => {
    setNamespace(event.target.value);
    getObjs(event.target.value);
  };
  const onChangeObj = (event: SelectChangeEvent) => {
    setObj(event.target.value);
  };

  const onClickAdd = () => {
    var tabname=namespace+"-"+obj;
    if (scope==='cluster') tabname='cluster';
    var index=-1;
    while (tabs.find (tab => tab.tabname===tabname+index)) index-=1;

    var newtab:ATab= new ATab();
    newtab.cluster=selectedClusterName;
    newtab.scope=scope;
    newtab.namespace=namespace;
    newtab.obj=obj;
    newtab.tabname=tabname+index;
    tabs.push(newtab);
    setMessages(['Start log reciever...']);
    setTabs(tabs);
    setSelectedTabname(newtab.tabname);
    setPaused(false);
    setStartDisabled(false);
    setControlsVisible(true);
    setFilter('');
  };

  const onChangeTabs = (ev:any,val:string)=> {
    var newtab = tabs.find(t => t.tabname === val);
    if (newtab) {
      newtab.pending=false;
      setHighlightedTabs (highlightedTabs.filter(t => t.pending));
      setPaused(newtab.paused);
      setFilter(newtab.filter);
      setMessages(newtab.messages);
      setStartDisabled(newtab.started);
      setTabs(tabs);
    }
    setSelectedTabname(val);
  }

  const processEvent = (event:any) => {
    // find the tab who this web socket belongs to, and add the new message
    var tab=tabs.find(t => t.ws!==null && t.ws===event.target);
    if (!tab) {
      return;
    } 
    
    var ev=JSON.parse(event.data);
    var text=ev.text;
    if (tab) {
      if (tab.addTimestamp) text=(new Date()).toISOString().replace('T',' ').replace('Z','') + ' ' + text;
      tab.messages.push(text);
    }
    else {
      console.log('tab not found');
      return;
    }

    // if this tab is displayed (focused), add message to the screen
    if (selectedTabRef.current === tab?.tabname) {
      if (!tab?.paused) {
        setMessages( (prev) => [...prev, text ]);
      }
      else {
        // tab is paused, so we show nothing;
      }
    }
    else {
      // the received message is for a tab that is no selected, so we highlight the tab if background notification is enabled
      if (tab && tab.showBackgroundNotification) {
        tab.pending=true;
        setHighlightedTabs((prev)=> [...prev, tab!]);
        setTabs(tabs);
      }
    }

    // review alerts
    if (tab) {
      for (var alert of tab.alerts) {
        if (text.includes(alert.expression)) {
          if (alert.beep) {
            Beep.beepError();
          }
          
          if (alert.type==='blocking') {
            setBlockingAlert(alert);
            setShowBlockingAlert(true);
          }
          else {
            const action = (snackbarId: SnackbarKey | undefined) => (
              <>
                <Button onClick={() => { closeSnackbar(snackbarId); onChangeTabs(null,tab?.tabname); }}>
                  View
                </Button>
                <Button onClick={() => { closeSnackbar(snackbarId) }}>
                  Dismiss
                </Button>
              </>
            );
            var opts:any={
              anchorOrigin:{ horizontal: 'center', vertical: 'bottom' },
              variant:alert.severity,
              autoHideDuration:(alert.type==='timed'? 3000:null),
              action: action
            };
            enqueueSnackbar(alert.message, opts);
          }
        }
      }
    }
  }

  const start = (tabObject:ATab) => {
    tabObject.messages=[];
    var cluster=clusters!.find(c => c.name===tabObject.cluster);
    if (!cluster) {
      console.log('nocluster');
      return;
    }
    var ws = new WebSocket(cluster.url+'?key='+cluster.apiKey);
    tabObject.ws=ws;
    ws.onopen = () => {
      console.log(`Connected to the WebSocket: ${ws.url}`);
      var payload={ scope:tabObject?.scope, namespace:tabObject?.namespace, deploymentName:tabObject?.obj};
      if (tabObject) {
        ws.send(JSON.stringify(payload));
        tabObject.started=true;
      }
      else {
        console.log('no tabobject');
      }
    };
    
    ws.onmessage = (event) => processEvent(event);

    ws.onclose = (event) => {
      console.log(`Disconnected from the WebSocket: ${ws.url}`);
    };

    setMessages([]);
    setStartDisabled(true);
  }

  const onClickStart = () => {
    var tab=tabs.find(t => t.tabname===selectedTabRef.current);
    if (tab) start(tab);
    setAnchorMenuTabs(null);
  }

  const stop = (tabObject:ATab) => {
    var endline='====================================================================================================';
    tabObject.messages.push(endline);
    setMessages((prev) => [...prev,endline]);
    if (!tabObject) {
      console.log('nto');
    }
    tabObject.ws?.close();
    setStartDisabled(false);
  }

  const onClickStop = () => {    
    if (selectedTabObject) stop(selectedTabObject);
    setAnchorMenuTabs(null);
  }

  const onClickRemove = () => {
    if (selectedTabObject) {
      onClickStop();
      if (tabs.length===1) {
        setControlsVisible(false);
        setMessages([]);
      }
      else {
        onChangeTabs(null,tabs[0].tabname);
      }
      setTabs(tabs.filter(t => t!==selectedTabObject));
    }
    setAnchorMenuTabs(null);
  }

  const onClickPauseResume = () => {
    if (selectedTabObject) {
      if (selectedTabObject.paused) setMessages(selectedTabObject.messages);
      selectedTabObject.paused=!selectedTabObject.paused;
      setPaused(!paused);
      setTabs(tabs);
    }
    setAnchorMenuTabs(null);
  }

  const onChangeFilter = (event:ChangeEvent<HTMLInputElement>) => {
    setFilter(event.target.value);
    if (selectedTabObject) selectedTabObject.filter=event.target.value;
  }

  const onChangeSearch = (event:ChangeEvent<HTMLInputElement>) => {
    var newsearch=event.target.value;
    if (newsearch!=='') {
      var first=selectedTabObject!.messages.findIndex(m => m.includes(newsearch));
      setSearchFirstPos(first);
      setSearchLastPos(selectedTabObject!.messages.findLastIndex(m => m.includes(newsearch)));
      setSearchPos(first);
    }
    setSearch(newsearch);
  }

  const onClickSearchDown = () => {
    var i=messages!.findIndex( (m,i) => m.includes(search) && i>searchPos);
    if (i>=0) setSearchPos(i);
  }

  const onClickSearchUp = () => {
    var i=messages!.findLastIndex( (m,i) => m.includes(search) && i<searchPos);
    if (i>=0) setSearchPos(i);
  }

  const [anchorMenuTabs, setAnchorMenuTabs] = React.useState<null | HTMLElement>(null);
  const menuTabsOpen = Boolean(anchorMenuTabs);
  const onClickMenuTabs = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorMenuTabs(event.currentTarget);
  };
  const onCloseMenuTabs = () => {
    setAnchorMenuTabs(null);
  };
  
  const onClickMenuTabsOption = (option: string) => {
    switch(option) {
      case 'ml':
        if (selectedTabObject) {
          tabs[selectedTabIndex]=tabs[selectedTabIndex-1];
          tabs[selectedTabIndex-1]=selectedTabObject;
          setTabs(tabs);
        }
        break;
      case 'mr':
        if (selectedTabObject) {
          tabs[selectedTabIndex]=tabs[selectedTabIndex+1];
          tabs[selectedTabIndex+1]=selectedTabObject;
          setTabs(tabs);
        }
        break;
      case 'ms':
        if (selectedTabObject) {
          tabs.splice(selectedTabIndex, 1);
          tabs.splice(0, 0, selectedTabObject);
          setTabs(tabs);
        }
        break;  
      case 'me':
        if (selectedTabObject) {
          tabs.splice(selectedTabIndex, 1);
          tabs.push(selectedTabObject);
          setTabs(tabs);
        }
        break;
      case 'dbn':
        if (selectedTabObject) {
          selectedTabObject.showBackgroundNotification=!selectedTabObject.showBackgroundNotification;
          setTabs(tabs);
        }
        break;
      case 'ats':
        if (selectedTabObject) {
          selectedTabObject.addTimestamp=!selectedTabObject.addTimestamp;
          setTabs(tabs);
        }
        break;
      case 'cfa':
        setShowAlertConfig(true);
        break;
      case 'rt':
        setShowRenameTab(true);
        break;
      case 'dt':
        //+++ set default tab
        break;
    }
    onCloseMenuTabs();
  };

  const [anchorMenuConfig, setAnchorMenuConfig] = React.useState<null | HTMLElement>(null);
  const menuConfigOpen = Boolean(anchorMenuConfig);
  const onClickMenuConfig = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorMenuConfig(event.currentTarget);
  };
  const onCloseMenuConfig = () => {
    setAnchorMenuConfig(null);
  };

  const saveConfig = (name:string) => {
    var newtabs:ATab[]=[];
    for (var t of tabs) {
      var newt = new ATab();
      newt.addTimestamp=t.addTimestamp;
      newt.alerts=t.alerts;
      newt.cluster=t.cluster;
      newt.filter=t.filter;
      newt.namespace=t.namespace;
      newt.obj=t.obj;
      newt.default=t.default;
      newt.paused=t.paused;
      newt.scope=t.scope;
      newt.showBackgroundNotification=t.showBackgroundNotification;
      newt.started=t.started;
      newt.tabname=t.tabname;
      newtabs.push(newt);
    }
    var payload=JSON.stringify(newtabs);
    fetch (`${backend}/store/${user}/${name}`, {method:'POST', body:payload, headers:{'Content-Type':'application/json'}});
    if (configName!==name) setConfigName(name);
  }

  const showNoConfigs = () => {
    popup('Config management...',<Stack direction={'row'} alignItems={'center'}><Info  color='info' fontSize='large'/>&nbsp;You have no config stored in your local store</Stack>,true, false, false, false, false, false);
  }
  const loadConfig = async () => {
    var allConfigs:string[] = await (await fetch (`${backend}/store/${user}`)).json();
    if (allConfigs.length===0)
      showNoConfigs();
    else
      pickList('Load config...','Please, select the config you want to load:',allConfigs,loadConfigSelected);
  }

  var clear = () => {
    setControlsVisible(false);
    for (var t of tabs) {
      stop(t);
    }
    setTabs([]);
    setMessages([]);

  }

  const onClickMenuConfigOption = async (option: string) => {
    switch(option) {
      case 'new':
        clear();
        setConfigName('untitled');
        break;
      case 'save':
        if (configName!=='' && configName!=='untitled')
          saveConfig(configName);
        else
          setShowSaveConfig(true);
        break;
      case 'saveas':
        setShowSaveConfig(true);
        break;
      case 'open':
        loadConfig();
        break;
      case 'delete':
        var allConfigs:string[] = await (await fetch (`${backend}/store/${user}`)).json();
        if (allConfigs.length===0)
          showNoConfigs();
        else
          pickList('Config delete...','Please, select the config you want to delete:',allConfigs,deleteConfigSelected);
        break;
      case 'mc':
        setShowManageClusters(true);
        break;
      case 'asec':
        setShowApiSecurity(true);
        break;
      case 'usec':
        setShowUserSecurity(true);
        break;
      case 'cfgexp':
        var allConfigs:string[] = await (await fetch (`${backend}/store/${user}`)).json();
        if (allConfigs.length===0)
          showNoConfigs();
        else {
          var content:any={};
          for (var cfg of allConfigs) {
            var read = await (await fetch (`${backend}/store/${user}/${cfg}`)).json();
            content[cfg]=JSON.parse(read);
          }
          handleDownload(JSON.stringify(content),`${user}-export-${new Date().toLocaleDateString()+'-'+new Date().toLocaleTimeString()}.kwirth.json`);
        }
        break;
      case 'cfgimp':
        // nothing to do, the menuitem launches the handleUpload
        break;
    }
    onCloseMenuConfig();
  };

  const handleDownload = (content:string,filename:string,  mimeType:string='text/plain') => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  const handleUpload = (event:any) => {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e:any) => {
          var allConfigs=JSON.parse(e.target.result);
          for (var cfg of Object.keys(allConfigs)) {
            var payload=JSON.stringify(allConfigs[cfg]);
            fetch (`${backend}/store/${user}/${cfg}`, {method:'POST', body:payload, headers:{'Content-Type':'application/json'}});
          }
        };
        reader.readAsText(file);
    }
    setAnchorMenuConfig(null);
  }

  const alertConfigClosed= (a:Alert) => {
    setShowAlertConfig(false);
    if (a.expression) {
        var alert=new Alert();
        alert.expression=a.expression;
        alert.severity=a.severity;
        alert.message=a.message;
        alert.type=a.type;
        alert.beep=a.beep;
        selectedTabObject?.alerts.push(alert);
        setTabs(tabs);
      }
  }

  const renameTabClosed= (newname:string|null) => {
    setShowRenameTab(false);
    if (newname!=null) {
      selectedTabObject!.tabname=newname;
      setTabs(tabs);
    }
  }

  const saveConfigClosed = (newname:string|null) => {
    setShowSaveConfig(false);
    if (newname!=null) saveConfig(newname);
  }

  const loadConfigSelected = async (a:string) => {
    if (a) {
      clear();
      var n = await (await fetch (`${backend}/store/${user}/${a}`)).json();
      var newtabs=JSON.parse(n) as ATab[];
      setControlsVisible(true);
      setTabs(newtabs);
      setConfigLoaded(true);
      setConfigName(a);
      //+++ habilitar el tab que este marcado como default
    }
  }

  const deleteConfigSelected = (cfg:string) => {
    if (cfg) fetch (`${backend}/store/${user}/${cfg}`, {method:'DELETE'});
  }

  const pickList = (title:string, message:string, values:string[], onClose:(a:string) => void ) =>{
    var plc:PickListConfig=new PickListConfig();
    plc.title=title;
    plc.message=message;
    plc.values=values;
    plc.originOnClose=onClose;
    plc.onClose=pickListClosed;
    setPickListConfig(plc);
    setShowPickList(true);
  }

  const popup = (title:string, message:JSX.Element, ok:boolean, yes:boolean, yestoall:boolean, no:boolean, notoall:boolean, cancel:boolean, onClose:(a:string) => void = () => {} ) =>{
    var pc:PopupConfig=new PopupConfig();
    pc.title=title;
    pc.message=message;
    pc.ok=ok;
    pc.yes=yes;
    pc.yestoall=yestoall;
    pc.no=no;
    pc.notoall=notoall;
    pc.cancel=cancel;
    pc.originOnClose=onClose;
    pc.onClose=popupClosed;
    setPopupConfig(pc);
    setShowPopup(true);
  }

  const pickListClosed = (a:string|null) => {
    setShowPickList(false);
    if (a!==null) pickListConfigRef?.current?.originOnClose(a);
    setPickListConfig(null);
  }

  const popupClosed = (a:string|null) => {
    setShowPopup(false);
    if (a!==null) popupConfigRef?.current?.originOnClose(a);
    setPopupConfig(null);
  }

  const manageClustersClosed = (cc:Cluster[]) => {
    setShowManageClusters(false);
    localStorage.setItem('kwirth.clusters', JSON.stringify(cc));
    setClusters(cc);
  }

  const menuConfig=(
    <>
      <Button onClick={onClickMenuConfig} variant='contained' endIcon={<KeyboardArrowDown/>} size='small'>Config</Button>      
      <Menu id='menu-kwirth' anchorEl={anchorMenuConfig} open={menuConfigOpen} onClose={onCloseMenuConfig}>
        <MenuList dense>
          <MenuItem key='new' onClick={() => onClickMenuConfigOption('new')}><CreateNewFolderTwoTone/>&nbsp;New</MenuItem>
          <MenuItem key='open' onClick={() => onClickMenuConfigOption('open')}><FileOpenTwoTone/>&nbsp;Load</MenuItem>
          <MenuItem key='save' onClick={() => onClickMenuConfigOption('save')}><SaveTwoTone/>&nbsp;Save</MenuItem>
          <MenuItem key='saveas' onClick={() => onClickMenuConfigOption('saveas')}><SaveAsTwoTone/>&nbsp;Save as...</MenuItem>
          <MenuItem key='delete' onClick={() => onClickMenuConfigOption('delete')}><DeleteTwoTone/>&nbsp;Delete</MenuItem>
          <Divider/>
          <MenuItem key='cfgexp' onClick={() => onClickMenuConfigOption('cfgexp')}><ImportExport/>&nbsp;Export all configs (to downloadable file)</MenuItem>
          <MenuItem key='cfgimp' component='label'><input type="file" hidden accept=".kwirth.json" onChange={handleUpload}/><ImportExport/>&nbsp;Import new configs (and merge overwriting)</MenuItem>
          <Divider/>
          <MenuItem key='mc' onClick={() => onClickMenuConfigOption('mc')}><Edit/>&nbsp;Manage cluster list</MenuItem>
          <MenuItem key='asec' onClick={() => onClickMenuConfigOption('asec')}><Key/>&nbsp;API Security</MenuItem>
          <MenuItem key='usec' onClick={() => onClickMenuConfigOption('usec')}><VerifiedUser />&nbsp;User security</MenuItem>
          <Divider/>
          <MenuItem key='exit' onClick={() => {setLogged(false); onCloseMenuConfig()}}><ExitToApp />Exit Kwirth</MenuItem>
        </MenuList>
      </Menu>
    </>
  );

  const onCloseLogin = (result:boolean, apiKey:string, user:string) => {
    if (result) {
      setLogged(true); 
      setUser(user);
      setApiKey(apiKey);
      clear();
      setConfigName('untitled');
    }
  }

  const menuTabs=(
    <Menu id='menu-tabs' anchorEl={anchorMenuTabs} open={menuTabsOpen} onClose={onCloseMenuTabs}>
      <MenuList dense>
        <MenuItem key='cfa' onClick={() => onClickMenuTabsOption('cfa')} disabled={filter===''}>Convert filter to alert...</MenuItem>
        <Divider/>
        <MenuItem key='dbn' onClick={() => onClickMenuTabsOption('dbn')}>{ selectedTabObject?.showBackgroundNotification &&  <Check/>} Show background notifications</MenuItem>
        <MenuItem key='ats' onClick={() => onClickMenuTabsOption('ats')}>{ selectedTabObject?.addTimestamp &&  <Check/>} Add timestamp to messages</MenuItem>
        <Divider/>
        <MenuItem key='dt' onClick={() => onClickMenuTabsOption('dt')} disabled={selectedTabIndex<0}> {selectedTabObject?.default && <Check/>} Default tab</MenuItem>
        <MenuItem key='rt' onClick={() => onClickMenuTabsOption('rt')} disabled={selectedTabIndex<0}>Rename tab</MenuItem>
        <MenuItem key='ml' onClick={() => onClickMenuTabsOption('ml')} disabled={selectedTabIndex===0}>Move to left</MenuItem>
        <MenuItem key='mr' onClick={() => onClickMenuTabsOption('mr')} disabled={selectedTabIndex===tabs.length-1}>Move to right</MenuItem>
        <MenuItem key='ms' onClick={() => onClickMenuTabsOption('ms')} disabled={selectedTabIndex===0}>Move to start</MenuItem>
        <MenuItem key='me' onClick={() => onClickMenuTabsOption('me')} disabled={selectedTabIndex===tabs.length-1}>Move to end</MenuItem>
        <Divider/>
        <MenuItem key='tabstart' onClick={onClickStart} disabled={startDisabled} ><Start/>&nbsp;Start</MenuItem>
        <MenuItem key='tabpr' onClick={onClickPauseResume} disabled={!startDisabled}>{paused?<><PlayArrow/>Resume</>:<><Pause/>Pause</>}</MenuItem>
        <MenuItem key='tabstop' onClick={onClickStop} disabled={!startDisabled}><Stop/>&nbsp;Stop</MenuItem>
        <MenuItem key='tabremove' onClick={onClickRemove} ><RemoveCircleRounded/>&nbsp;Remove</MenuItem>
      </MenuList>
    </Menu>
  );

  if (!logged) return (<>
    <div style={{ backgroundImage:`url('/front/turbo-pascal.png')`, backgroundPosition: 'center', backgroundSize: 'cover', backgroundRepeat: 'no-repeat', width: '100vw', height: '100vh' }} >
      <Login onClose={onCloseLogin} backend={backend}></Login>
    </div>
  </>);
  
  return (
    <>
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div>
        <Stack direction='row' spacing={1} sx={{ ml:1}} alignItems='baseline' >

          {menuConfig}
          <FormControl variant='standard' sx={{ m: 1, minWidth: 200 }}>
              <InputLabel id='cluster'>Cluster</InputLabel>
              <Select labelId='cluster' value={selectedClusterName} onChange={onChangeCluster} label='Cluster'>
                { clusters?.map( (value) => {
                    return <MenuItem key={value.name} value={value.name}>{value.name}</MenuItem>
                })}
              </Select>
          </FormControl>
          <FormControl variant='standard' sx={{ m: 1, minWidth: 200 }} disabled={selectedClusterName===''}>
              <InputLabel id='scope'>Scope</InputLabel>
              <Select labelId='scope' value={scope} onChange={onChangeScope} label='Scope'>
                  { ['cluster','deployment','pod'].map( (value:string) => {
                      return <MenuItem key={value} value={value}>{value}</MenuItem>
                  })}
              </Select>
          </FormControl>
          <FormControl variant='standard' sx={{ m: 1, minWidth: 200 }} disabled={namespaceSelectDisabled}>
              <InputLabel id='namespace'>Namespace</InputLabel>
              <Select labelId='namespace' value={namespace} onChange={onChangeNamespace} label='Namespace'>
                  { namespaces.map( (value:string) => {
                      return <MenuItem key={value} value={value}>{value}</MenuItem>
                  })}
              </Select>
          </FormControl>
          <FormControl variant="standard" sx={{ m: 1, minWidth: 200 }} disabled={objSelectDisabled}>
              <InputLabel id="obj">Object</InputLabel>
              <Select labelId="obj" value={obj} onChange={onChangeObj} label='Object'>
                  { objs.map( (value:string) => {
                      return <MenuItem key={value} value={value}>{value}</MenuItem>
                  })}
              </Select>
          </FormControl>
          <Button variant='contained' onClick={onClickAdd} size='small'>ADD</Button>
          <Stack direction={'column'} alignItems={'center'} alignSelf={'center'} paddingTop={3}>
            <Typography fontSize={8} sx={{backgroundColor:'lightGray'}}>&nbsp;{user}&nbsp;</Typography>
            <Typography fontSize={8} sx={{backgroundColor:'lightYellow'}}>&nbsp;{configName}&nbsp;</Typography>
          </Stack>
          
        </Stack>
        <Stack direction={'row'}>

          { controlsVisible && <>
              <Stack direction="row" spacing={1} sx={{ ml:1}} alignItems="baseline" >
                <TextField label="Filter" onChange={onChangeFilter} variant="standard" value={filter}/>
                <TextField value={search} onChange={onChangeSearch} label="Search" variant="standard" />
                <Typography sx={{ ml:1 }}></Typography>
                <IconButton onClick={onClickSearchUp} disabled={search==='' || searchFirstPos===searchPos}><ArrowUpward/> </IconButton>
                <IconButton onClick={onClickSearchDown} disabled={search===''  || searchLastPos===searchPos}><ArrowDownward/> </IconButton>
              </Stack>
          </>}

        <Tabs value={selectedTabname} onChange={onChangeTabs}>
          { tabs.length>0 && tabs.map(t => {
              if (t.scope==='cluster')
                return <Tab key={t.tabname} label='cluster' value={t.tabname}/>
              else {
                if (t===selectedTabObject)
                  return <Tab key={t.tabname} label={t.tabname} value={t.tabname} icon={<IconButton onClick={onClickMenuTabs}><Settings fontSize='small' color='primary'/></IconButton>} iconPosition='end' sx={{ mb:-2, mt:-1, backgroundColor: (highlightedTabs.includes(t)?'pink':'')}}/>
                else
                  return <Tab key={t.tabname} label={t.tabname} value={t.tabname} icon={<Settings fontSize='small'/>} iconPosition='end' sx={{ mb:-2, mt:-1, backgroundColor: (highlightedTabs.includes(t)?'pink':'')}}/>
              }
            })
          }
        </Tabs>
        </Stack>
        </div>

        {menuTabs}
        <Box sx={{ flex:1, overflowY: 'auto', ml:1 }}>
          <pre>
          {messages.map(m => {
            return m.includes(filter)? m : null;
          })
          .map((message, index) => {
            if (search!=='') {
              if (index===searchPos) {
                //+++ implement scroll into view for the item at the searchPos
                return <div key={index} dangerouslySetInnerHTML={{__html: message!.replaceAll(search,'<span style=\'background-color:#0000ff\'>'+search+'</span>')}}></div>;
              }
              else {
                return <div key={index} dangerouslySetInnerHTML={{__html: message!.replaceAll(search,'<span style=\'background-color:#ff0000\'>'+search+'</span>')}}></div>;
              }
            }
            else {
              return <div key={index}>{message}</div>;
            }
          })}
        </pre>
        </Box>
      </Box>
      { showAlertConfig && <AlertConfig onClose={alertConfigClosed} expression={filter}/> }
      { showBlockingAlert && <BlockingAlert onClose={() => setShowBlockingAlert(false)} alert={blockingAlert} /> }
      { showRenameTab && <RenameTab onClose={renameTabClosed} tabs={tabs} oldname={selectedTabObject?.tabname}/> }
      { showSaveConfig && <SaveConfig onClose={saveConfigClosed} name={configName} /> }
      { showManageClusters && <ManageClusters onClose={manageClustersClosed} clusters={clusters}/> }
      { showApiSecurity && <ManageApiSecurity onClose={() => setShowApiSecurity(false)} cluster={currentCluster}/> }
      { showUserSecurity && <ManageUserSecurity onClose={() => setShowUserSecurity(false)} backend={backend}/> }
      { pickListConfig!==null && <PickList config={pickListConfig}/> }
      { popupConfig!==null && <Popup config={popupConfig}/> }
    </>
  );
};

export default App;