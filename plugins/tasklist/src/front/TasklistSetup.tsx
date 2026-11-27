import React from 'react'
import { ISetupProps } from '@kwirthmagnify/kwirth-common-front'
import { TaskManager } from './icons'

const TasklistIcon = <TaskManager />

// The Task Manager asks nothing when it starts (requirements.setup is false); the contract still wants a dialog.
const TasklistSetup: React.FC<ISetupProps> = () => null

export { TasklistSetup, TasklistIcon }
