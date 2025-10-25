import { ITabSummary } from "../model/ITabObject"

interface IColors {
    stop: string
    start: string
    pause: string
    pending: string
}

const BASECOLORS: IColors = {
    stop: '#f7f7f7',
    start: '#28a745',
    pause: '#6c757d',
    pending: '#ffc107'
}

const BRIGHTCOLORS: IColors = {
    stop: '#f1f1f1',
    start: '#34d058',
    pause: '#dfd7df',
    pending: '#ffca2c',
}

const OPSWELCOMEMESSAGE:string[] = [
    'Welcome to OpsChannel frontend interface. This is a command-like interface where you can launch several commands:',
    ' '
]

const OPSHELPMESSAGE:string[] = [
    'CLEAR      to clear this command console',
    'GET        to get simple information on a specific namespace, pod or container',
    '             samples: GET default/mypod-1234-abcd/mycontainer   GET default/mypod   GET default',
    'DESCRIBE   obtain detailed info on object (same formats as GET)',
    'LIST       get a list of your authorized objects (according to your accessKey)',
    'EXECUTE    launch a command to a container object (format: EXECUTE ns/pod/cont command)',
    'SHELL      launch a shell console against object (format: SHELL ns/pod/cont) ',
    '             You can switch between shell sessions using F1-F10 keys, use F11 to show all shells and F12 to return here',
    'RESTART    You can restart a container inside a pod (format: RESTART ns/pod/cont)',
    'RESTARTPOD You can also restart a specific pod (format: RESTARTPOD ns/pod)',
    'RESTARTNS  Or you can even restart a whoooooole namespace (format: RESTARTNS ns) ',
    ' '
]

const DEFAULTLASTTABS:ITabSummary[] = [
  {
    name: 'all-namespaces-log',
    description: 'Consolidated logs from all existing objects in all namespaces',
    channel: 'log',
    channelObject: {
      clusterName: 'inCluster',
      view: 'namespace',
      namespace: '$all',
      group: '',
      pod: '',
      container: ''
    }
  },
  {
    name: 'all-groups-fileman',
    description: 'File manager for all sets',
    channel: 'fileman',
    channelObject: {
      clusterName: 'inCluster',
      view: 'group',
      namespace: '$all',
      group: '$all',
      pod: '',
      container: ''
    }
  },
  {
    name: 'all-pods-metrics',
    description: 'Basic metrics for all pods in cluster',
    channel: 'metrics',
    channelObject: {
      clusterName: 'inCluster',
      view: 'pod',
      namespace: '$all',
      group: '$all',
      pod: '$all',
      container: ''
    }
  },
  {
    name: 'all-containers-ops',
    description: 'Perform operations on all contianers',
    channel: 'ops',
    channelObject: {
      clusterName: 'inCluster',
      view: 'container',
      namespace: '$all',
      group: '$all',
      pod: '$all',
      container: '$all'
    }
  }
]

export type { IColors }
export { OPSWELCOMEMESSAGE, OPSHELPMESSAGE, DEFAULTLASTTABS, BASECOLORS, BRIGHTCOLORS }