import { useState, useRef, ChangeEvent, useEffect } from 'react';

// material & icons
import { AppBar, Box, Button, Divider, Drawer, IconButton, List, ListItem, ListItemButton, ListItemIcon, ListItemText, MenuItem, MenuList, Stack, Tab, Tabs, TextField, Toolbar, Tooltip, Typography } from '@mui/material';
import { KeyboardArrowDown, Settings, Info, ArrowUpward, ArrowDownward, Clear, Beenhere, Rule, ExitToApp, Menu, Person, CreateNewFolderTwoTone, FileOpenTwoTone, SaveTwoTone, SaveAsTwoTone, DeleteTwoTone, ImportExport, Edit, Key } from '@mui/icons-material';

// model
import { Alert } from './model/Alert';
import { LogObject } from './model/LogObject';
import { Cluster } from './model/Cluster';

// tools
import { SnackbarKey, closeSnackbar, enqueueSnackbar } from 'notistack';
import { Beep } from './tools/Beep';
import { PickListConfig } from './model/PickListConfig';
import { PopupConfig } from './model/PopupConfig';

// components
import BlockingAlert from './components/BlockingAlert';
import AlertConfig from './components/AlertConfig';
import RenameLog from './components/RenameLog';
import SaveConfig from './components/SaveConfig';
import ManageApiSecurity from './components/ManageApiSecurity';
import PickList from './components/PickList';
import Popup from './components/Popup';
import Login from './components/Login';
import ManageClusters from './components/ManageClusters';
import ManageUserSecurity from './components/ManageUserSecurity';
//import MenuMain from './menus/MenuMain';
import Selector from './components/ResourceSelector';
import MenuLog from './menus/MenuLog';
import LogContent from './components/LogContent';
import MenuDrawer from './menus/MenuDrawer';


const App: React.FC = () => {
  var backend='http://localhost:3883';
  if ( process.env.NODE_ENV==='production') backend=window.location.protocol+'//'+window.location.host;

  const [user, setUser] = useState<string>('');
  const [logged,setLogged]=useState(false);
  const [apiKey,setApiKey]=useState('');

  //navigation
  const [drawerOpen,setDrawerOpen]=useState(false);

  
  //+++ move picklist objects to a helper class
  const [pickListConfig, setPickListConfig] = useState<PickListConfig|null>(null);
  var pickListConfigRef=useRef(pickListConfig);
  pickListConfigRef.current=pickListConfig;

  //+++ move popup objects to a helper class
  const [popupConfig, setPopupConfig] = useState<PopupConfig|null>(null);
  var popupConfigRef=useRef(popupConfig);
  popupConfigRef.current=popupConfig;

  const [clusters, setClusters] = useState<Cluster[]>();
  const clustersRef = useRef(clusters);
  clustersRef.current=clusters;

  const [logs, setLogs] = useState<LogObject[]>([]);
  const [highlightedLogs, setHighlightedLogs] = useState<LogObject[]>([]);
  const [pausedLogs, setPausedLogs] = useState<LogObject[]>([]);

  const [selectedLogName, setSelectedLogName] = useState<string>();
  const selectedLogRef = useRef(selectedLogName);
  selectedLogRef.current=selectedLogName;
  var selectedLog = logs.find(t => t.name===selectedLogName);
  var selectedLogIndex = logs.findIndex(t => t.name===selectedLogName);

  // message list management
  const [messages, setMessages] = useState<string[]>([]);
  const searchLineRef = useRef(null);
  const lastLineRef = useRef(null);

  // search & filter
  const [filter, setFilter] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [searchPos, setSearchPos] = useState<number>(0);
  const [searchFirstPos, setSearchFirstPos] = useState<number>(-1);
  const [searchLastPos, setSearchLastPos] = useState<number>(-1);

  // menus
  const [anchorMenuConfig, setAnchorMenuConfig] = useState<null | HTMLElement>(null);
  const [anchorMenuLog, setAnchorMenuLog] = useState<null | HTMLElement>(null);

  // components
  const [showAlertConfig, setShowAlertConfig]=useState<boolean>(false);
  const [showBlockingAlert, setShowBlockingAlert]=useState<boolean>(false);
  const [showRenameLog, setShowRenameLog]=useState<boolean>(false);
  const [showManageClusters, setShowManageClusters]=useState<boolean>(false);
  const [showSaveConfig, setShowSaveConfig]=useState<boolean>(false);
  const [showApiSecurity, setShowApiSecurity]=useState<boolean>(false);
  const [showUserSecurity, setShowUserSecurity]=useState<boolean>(false);
  const [blockingAlert, setBlockingAlert] = useState<Alert>();
  const [configLoaded, setConfigLoaded] = useState<boolean>(false);
  const [configName, setConfigName] = useState('');
  const [showPickList, setShowPickList]=useState<boolean>(false);
  const [showPopup, setShowPopup]=useState<boolean>(false);

  useEffect ( () => {
    //+++ implement admin role (enabling/disabling menu options)
    //+++ implement role checking on backend
    if (logged && !clustersRef.current) getClusters();
  });

  useEffect ( () => {
    if (logged) {
      setConfigLoaded(false);
      if (logs.length>0) {
        for (var t of logs)
          startLog(t);
        onChangeLogs(null, logs[0].name);
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

    // get previously configured clusters
    var clusterList:Cluster[]=[];
    var data=localStorage.getItem('kwirth.clusters');
    if (data) clusterList=JSON.parse(data);
    clusterList=clusterList.filter (c => c.name!==srcCluster.name);
    for (var c of clusterList) {
      if (c.source) delete c.source;
    }
    clusterList.push(srcCluster);
    localStorage.setItem('kwirth.clusters', JSON.stringify(clusterList));
    setClusters(clusterList);
  }

  const onSelectorAdd = (selection:any) => {
    var logName=selection.namespace+"-"+selection.resource;
    if (selection.resource==='') logName=logName.substring(0,logName.length-1);
    if (selection.scope==='cluster') logName='cluster';

    // create unduplicated (unique) name
    var index=-1;
    while (logs.find (l => l.name===logName+index)) index-=1;

    var newLog:LogObject= new LogObject();
    newLog.cluster=selection.clusterName;
    newLog.scope=selection.scope;
    newLog.namespace=selection.namespace;
    newLog.obj=selection.resource;
    newLog.name=logName+index;

    logs.push(newLog);
    setMessages(['Use log menu (settings button on tab) to start log reciever...']);
    setLogs(logs);
    setSelectedLogName(newLog.name);
    setFilter('');
    setSearch('');
  };

  const onChangeLogs = (event:any,value:string)=> {
    var newlog = logs.find(log => log.name === value);
    if (newlog) {
      newlog.pending=false;
      setHighlightedLogs (highlightedLogs.filter(t => t.pending));
      setPausedLogs (pausedLogs.filter(log => log.paused));
      setFilter(newlog.filter);
      setMessages(newlog.messages);
      setLogs(logs);
    }
    setSelectedLogName(value);
  }

  // process an event received via websocket
  const processEvent = (event:any) => {
    // find the log who this web socket belongs to, and add the new message
    var log=logs.find(log => log.ws!==null && log.ws===event.target);
    if (!log) return;
    
    var msg:any={};
    try {
      msg=JSON.parse(event.data);
    }
    catch (err) {
      console.log(err);
      console.log(event.data);
    }

    var text=msg.text;
    if (log.scope==='namespace' || log.scope==='cluster' ) text=msg.podName+'  '+text;

    if (log) {
      if (msg.timestamp) text=msg.timestamp.replace('T',' ').replace('Z','') + ' ' + text;
      log.messages.push(text);
    }
    else {
      console.log('log not found');
      return;
    }

    // if this log is displayed (focused), add message to the screen
    if (selectedLogRef.current === log?.name) {
      if (!log?.paused) {
        setMessages( (prev) => [...prev, text ]);
        if (lastLineRef.current) (lastLineRef.current as any).scrollIntoView({ behavior: 'instant', block: 'start' });
      }
    }
    else {
      // the received message is for a log that is no selected, so we highlight the log if background notification is enabled
      if (log && log.showBackgroundNotification && !log.paused) {
        log.pending=true;
        setHighlightedLogs((prev)=> [...prev, log!]);
        setLogs(logs);
      }
    }

    // review alerts
    if (log) {
      for (var alert of log.alerts) {
        if (text.includes(alert.expression)) {
          if (alert.beep) {
            Beep.beepError();
          }
          
          if (alert.type==='blocking') {
            setBlockingAlert(alert);
            setShowBlockingAlert(true);
          }
          else {
            // in the view action, implement scrollinto view for showing the message that caused the received alert
            const action = (snackbarId: SnackbarKey | undefined) => (
              <>
                <Button onClick={() => { closeSnackbar(snackbarId); onChangeLogs(null,log?.name); }}>
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

  const startLog = (log:LogObject) => {
    log.messages=[];
    var cluster=clusters!.find(c => c.name===log.cluster);
    if (!cluster) {
      console.log('nocluster');
      return;
    }
    var ws = new WebSocket(cluster.url+'?key='+cluster.apiKey);
    log.ws=ws;
    ws.onopen = () => {
      console.log(`Connected to the WebSocket: ${ws.url}`);
      var payload={ scope:log?.scope, namespace:log?.namespace, deploymentName:log?.obj, timestamp:log?.addTimestamp};
      if (log) {
        ws.send(JSON.stringify(payload));
        log.started=true;
      }
      else {
        console.log('no loobject');
      }
    };
    
    ws.onmessage = (event) => processEvent(event);

    ws.onclose = (event) => {
      console.log(`Disconnected from the WebSocket: ${ws.url}`);
    };

    setMessages([]);
  }

  const onClickLogStart = () => {
    var log=logs.find(l => l.name===selectedLogRef.current);
    if (log) startLog(log);
    setAnchorMenuLog(null);
  }

  const stopLog = (log:LogObject) => {
    var endline='====================================================================================================';
    log.messages.push(endline);
    log.started=false;
    log.paused=false;
    setPausedLogs(logs.filter(t => t.paused));
    setMessages((prev) => [...prev,endline]);
    if (!log) {
      console.log('nto');
    }
    log.ws?.close();
  }

  const onClickLogStop = () => {    
    if (selectedLog) stopLog(selectedLog);
    setAnchorMenuLog(null);
  }

  const onClickLogRemove = () => {
    if (selectedLog) {
      onClickLogStop();
      if (logs.length===1)
        setMessages([]);
      else
        onChangeLogs(null,logs[0].name);
      setLogs(logs.filter(t => t!==selectedLog));
    }
    setAnchorMenuLog(null);
  }

  const onClickLogPauseResume = () => {
    if (selectedLog) {
      if (selectedLog.paused) {
        selectedLog.paused=false;
        setMessages(selectedLog.messages);
        setPausedLogs(logs.filter(t => t.paused));
        setLogs(logs);
      }
      else {
        selectedLog.paused=true;
        setPausedLogs( (prev) => [...prev, selectedLog!]);
        setLogs(logs);
      }
    }
    setAnchorMenuLog(null);
  }

  const onChangeFilter = (event:ChangeEvent<HTMLInputElement>) => {
    setFilter(event.target.value);
    if (selectedLog) selectedLog.filter=event.target.value;
  }

  const onChangeSearch = (event:ChangeEvent<HTMLInputElement>) => {
    var newsearch=event.target.value;
    if (newsearch!=='') {
      var first=selectedLog!.messages.findIndex(m => m.includes(newsearch));
      setSearchFirstPos(first);
      setSearchLastPos(selectedLog!.messages.findLastIndex(m => m.includes(newsearch)));
      setSearchPos(first);
      if (searchLineRef.current) (searchLineRef.current as any).scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    else {
      if (lastLineRef.current) (lastLineRef.current as any).scrollIntoView({ alignToTop:false, behavior: 'smooth', block: 'start' });
    }
    setSearch(newsearch);
  }

  const onClickSearchDown = () => {
    var i=messages!.findIndex( (m,i) => m.includes(search) && i>searchPos);
    if (i>=0) {
      setSearchPos(i);
      (searchLineRef.current as any).scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  //+++ review whole functionality of search up/down and first finding regarding message positioning and highliting
  const onClickSearchUp = () => {
    var i=messages!.findLastIndex( (m,i) => m.includes(search) && i<searchPos);
    if (i>=0) {
      setSearchPos(i);
      (searchLineRef.current as any).scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  const menuLogOptionSelected = (option: string) => {
    //+++ convert literals in enumeration
    switch(option) {
      case 'ml':
        if (selectedLog) {
          logs[selectedLogIndex]=logs[selectedLogIndex-1];
          logs[selectedLogIndex-1]=selectedLog;
          setLogs(logs);
        }
        break;
      case 'mr':
        if (selectedLog) {
          logs[selectedLogIndex]=logs[selectedLogIndex+1];
          logs[selectedLogIndex+1]=selectedLog;
          setLogs(logs);
        }
        break;
      case 'ms':
        if (selectedLog) {
          logs.splice(selectedLogIndex, 1);
          logs.splice(0, 0, selectedLog);
          setLogs(logs);
        }
        break;  
      case 'me':
        if (selectedLog) {
          logs.splice(selectedLogIndex, 1);
          logs.push(selectedLog);
          setLogs(logs);
        }
        break;
      case 'bn':
        if (selectedLog) selectedLog.showBackgroundNotification=!selectedLog.showBackgroundNotification;
        break;
      case 'ts':
        if (selectedLog) selectedLog.addTimestamp=!selectedLog.addTimestamp;
        break;
      case 'fa':
        setShowAlertConfig(true);
        break;
      case 'rl':
        setShowRenameLog(true);
        break;
      case 'dl':
        if (selectedLog) selectedLog.default=true;
        break;
      case 'ls':
        onClickLogStart();
        break;
      case 'lpr':
        onClickLogPauseResume();
        break;
      case 'lstop':
        onClickLogStop();
        break;
      case 'lr':
        onClickLogRemove();
        break;
    }
    setAnchorMenuLog(null);
  };

  const saveConfig = (name:string) => {
    var newlos:LogObject[]=[];
    for (var lo of logs) {
      var newlo = new LogObject();
      newlo.addTimestamp=lo.addTimestamp;
      newlo.alerts=lo.alerts;
      newlo.cluster=lo.cluster;
      newlo.filter=lo.filter;
      newlo.namespace=lo.namespace;
      newlo.obj=lo.obj;
      newlo.default=lo.default;
      newlo.paused=lo.paused;
      newlo.scope=lo.scope;
      newlo.showBackgroundNotification=lo.showBackgroundNotification;
      newlo.started=lo.started;
      newlo.name=lo.name;
      newlos.push(newlo);
    }
    var payload=JSON.stringify(newlos);
    fetch (`${backend}/store/${user}/${name}`, {method:'POST', body:payload, headers:{'Content-Type':'application/json'}});
    if (configName!==name) setConfigName(name);
  }

  const showNoConfigs = () => {
    popup('Config management...',<Stack direction={'row'} alignItems={'center'}><Info  color='info' fontSize='large'/>&nbsp;You have no config stored in your personal Kwirth space</Stack>,true, false, false, false, false, false);
  }

  const loadConfig = async () => {
    var allConfigs:string[] = await (await fetch (`${backend}/store/${user}`)).json();
    if (allConfigs.length===0)
      showNoConfigs();
    else
      pickList('Load config...','Please, select the config you want to load:',allConfigs,loadConfigSelected);
  }

  var clearLogs = () => {
    for (var t of logs)
      stopLog(t);
    setLogs([]);
    setMessages([]);
  }

  const menuConfigOptionSelected = async (option: string) => {
    setDrawerOpen(false);
    switch(option) {
      case 'new':
        clearLogs();
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
            var readCfg = await (await fetch (`${backend}/store/${user}/${cfg}`)).json();
            content[cfg]=JSON.parse(readCfg);
          }
          handleDownload(JSON.stringify(content),`${user}-export-${new Date().toLocaleDateString()+'-'+new Date().toLocaleTimeString()}.kwirth.json`);
        }
        break;
      case 'cfgimp':
        // nothing to do, the menuitem launches the handleUpload
        break;
      case 'exit':
        setLogged(false);
        break;
    }
    setAnchorMenuConfig(null);
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

  const alertConfigClosed= (alert:Alert) => {
    setShowAlertConfig(false);
    if (alert.expression) {
        var alert=new Alert();
        alert.expression=alert.expression;
        alert.severity=alert.severity;
        alert.message=alert.message;
        alert.type=alert.type;
        alert.beep=alert.beep;
        selectedLog?.alerts.push(alert);
      }
  }

  const renameLogClosed= (newname:string|null) => {
    setShowRenameLog(false);
    if (newname!=null) {
      selectedLog!.name=newname;
      setLogs(logs);
      //+++ set focus to recently renamed tab
    }
  }

  const saveConfigClosed = (newname:string|null) => {
    setShowSaveConfig(false);
    if (newname!=null) saveConfig(newname);
  }

  const loadConfigSelected = async (a:string) => {
    if (a) {
      clearLogs();
      var n = await (await fetch (`${backend}/store/${user}/${a}`)).json();
      var newlos=JSON.parse(n) as LogObject[];
      setLogs(newlos);
      setConfigLoaded(true);
      setConfigName(a);
      //+++ move log focus the the log which has a default check
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

  //+++ create convenient yes-no dialogs
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

  const onCloseLogin = (result:boolean, apiKey:string, user:string) => {
    if (result) {
      setLogged(true); 
      setUser(user);
      setApiKey(apiKey);
      setConfigName('untitled');
      clearLogs();
    }
  }

  if (!logged) return (<>
    <div style={{ backgroundImage:`url('/front/turbo-pascal.png')`, backgroundPosition: 'center', backgroundSize: 'cover', backgroundRepeat: 'no-repeat', width: '100vw', height: '100vh' }} >
      <Login onClose={onCloseLogin} backend={backend}></Login>
    </div>
  </>);

  return (<>

    <AppBar position="sticky" elevation={0}  sx={{ zIndex: 99, height:'64px' }}>
      <Toolbar>
        <IconButton size="large" edge="start" color="inherit" aria-label="menu" sx={{ mr: 1 }} onClick={() => setDrawerOpen(true)}>
            <Menu />
        </IconButton>
        <Typography sx={{ ml:1,flexGrow: 1 }}>
          KWirth
        </Typography>
        <Typography variant="h6" component="div" sx={{mr:2}}>
            {configName}
        </Typography>
        <Tooltip title={user} sx={{ mr:2 }}>
            <Person/>
        </Tooltip>
      </Toolbar>
    </AppBar>
    <Drawer sx={{  flexShrink: 0,  '& .MuiDrawer-paper': { mt: '64px' }  }} anchor="left" open={drawerOpen} onClose={() => setDrawerOpen(false)}>
      <MenuDrawer optionSelected={menuConfigOptionSelected} uploadSelected={handleUpload} />
    </Drawer>

    <Box sx={{ display: 'flex', flexDirection: 'column', height: '92vh' }}>
      <div>
        <Selector clusters={clusters} onAdd={onSelectorAdd} sx={{ mt:1, ml:3, mr:3 }}/>

        <Stack direction={'row'} alignItems={'end'} sx={{mb:1}}>
          { (logs.length>0) && <>
              <Stack direction="row" sx={{ ml:1}} alignItems="bottom" >
                <TextField value={filter} onChange={onChangeFilter} InputProps={{ endAdornment: <IconButton onClick={()=>setFilter('')}><Clear fontSize='small'/></IconButton> }} label="Filter" variant="standard"/>
                <TextField value={search} onChange={onChangeSearch} InputProps={{ endAdornment: <IconButton onClick={()=>setSearch('')}><Clear fontSize='small'/></IconButton> }} sx={{ml:1}} label="Search" variant="standard" />
                <Typography sx={{ ml:1 }}></Typography>
                <IconButton onClick={onClickSearchUp} disabled={search==='' || searchFirstPos===searchPos}><ArrowUpward/> </IconButton>
                <IconButton onClick={onClickSearchDown} disabled={search===''  || searchLastPos===searchPos}><ArrowDownward/> </IconButton>
              </Stack>
          </>}
          
          <Tabs value={selectedLogName} onChange={onChangeLogs}>
            { logs.length>0 && logs.map(t => {
                if (t.scope==='cluster')
                  return <Tab key={t.name} label='cluster' value={t.name} icon={<IconButton onClick={(event) => setAnchorMenuLog(event.currentTarget)}><Settings fontSize='small' color='primary'/></IconButton>} iconPosition='end' sx={{ backgroundColor: (highlightedLogs.includes(t)?'pink':pausedLogs.includes(t)?'#cccccc':'')}}/>
                else {
                  if (t===selectedLog)
                    return <Tab key={t.name} label={t.name} value={t.name} icon={<IconButton onClick={(event) => setAnchorMenuLog(event.currentTarget)}><Settings fontSize='small' color='primary'/></IconButton>} iconPosition='end' sx={{ backgroundColor: (highlightedLogs.includes(t)?'pink':pausedLogs.includes(t)?'#cccccc':'')}}/>
                  else
                    return <Tab key={t.name} label={t.name} value={t.name} icon={<Settings fontSize='small'/>} iconPosition='end' sx={{ backgroundColor: (highlightedLogs.includes(t)?'pink':pausedLogs.includes(t)?'#cccccc':'')}}/>
                }
              })
            }
          </Tabs>
        </Stack>

      </div>

      { anchorMenuLog && <MenuLog onClose={() => setAnchorMenuLog(null)} optionSelected={menuLogOptionSelected} anchorMenuLog={anchorMenuLog} logs={logs} selectedLog={selectedLog} selectedLogIndex={selectedLogIndex} />}
      <LogContent messages={messages} filter={filter} search={search} searchPos={searchPos} searchLineRef={searchLineRef} lastLineRef={lastLineRef}/>
    </Box>

    { showAlertConfig && <AlertConfig onClose={alertConfigClosed} expression={filter}/> }
    { showBlockingAlert && <BlockingAlert onClose={() => setShowBlockingAlert(false)} alert={blockingAlert} /> }
    { showRenameLog && <RenameLog onClose={renameLogClosed} logs={logs} oldname={selectedLog?.name}/> }
    { showSaveConfig && <SaveConfig onClose={saveConfigClosed} name={configName} /> }
    { showManageClusters && <ManageClusters onClose={manageClustersClosed} clusters={clusters}/> }
    { showApiSecurity && <ManageApiSecurity onClose={() => setShowApiSecurity(false)} backend={backend}/> }
    { showUserSecurity && <ManageUserSecurity onClose={() => setShowUserSecurity(false)} backend={backend}/> }
    { pickListConfig!==null && <PickList config={pickListConfig}/> }
    { popupConfig!==null && <Popup config={popupConfig}/> }    
  </>);
};

export default App;