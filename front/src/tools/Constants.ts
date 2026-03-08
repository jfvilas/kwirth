import { EInstanceConfigView } from "@jfvilas/kwirth-common"
import { ITabSummary } from "../model/ITabObject"

interface IColors {
    stop: string
    start: string
    interrupt: string
    pause: string
    pending: string
}

const TABBASECOLORS: IColors = {
    stop: '#ebebeb',
    start: '#28a745',
    interrupt: 'salmon',
    pause: '#6c757d',
    pending: '#ffc107'
}

const TABBRIGHTCOLORS: IColors = {
    stop: '#cbcbcb',
    start: '#34d058',
    interrupt: 'red',
    pause: '#dfd7df',
    pending: '#ffca2c',
}

const DEFAULTLASTTABS:ITabSummary[] = [
  {
    name: 'all-namespaces-log',
    description: 'Consolidated logs from all existing objects in all namespaces',
    channel: 'log',
    channelObject: {
      clusterName: '$cluster',
      view: EInstanceConfigView.NAMESPACE,
      namespace: '*all',
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
      clusterName: '$cluster',
      view: EInstanceConfigView.GROUP,
      namespace: '*all',
      group: '*all',
      pod: '',
      container: ''
    }
  },
  {
    name: 'all-pods-metrics',
    description: 'Basic metrics for all pods in cluster',
    channel: 'metrics',
    channelObject: {
      clusterName: '$cluster',
      view: EInstanceConfigView.POD,
      namespace: '*all',
      group: '*all',
      pod: '*all',
      container: ''
    }
  },
  {
    name: 'all-containers-ops',
    description: 'Perform operations on all contianers',
    channel: 'ops',
    channelObject: {
      clusterName: '$cluster',
      view: EInstanceConfigView.CONTAINER,
      namespace: '*all',
      group: '*all',
      pod: '*all',
      container: '*all'
    }
  }
]

export type { IColors }
export { DEFAULTLASTTABS, TABBASECOLORS, TABBRIGHTCOLORS }