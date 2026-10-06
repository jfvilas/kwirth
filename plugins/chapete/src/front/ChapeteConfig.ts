import { IChapeteInstanceConfig } from '../common/ChapeteTypes'

export interface IChapeteConfig {
}

export class ChapeteConfig implements IChapeteConfig {
}

export class ChapeteInstanceConfig implements IChapeteInstanceConfig {
    llmId = ''
    temperature = 0.7
}
