import { AccessKey } from "./AccessKey"

interface IUser {
    id: string
    name: string
    password: string
    accessKey: AccessKey
    resources: string
}

interface ILoginResponse {
    id: string
    name: string
    accessKey: AccessKey
}

interface IClusterMetricsConfig {
    metricsInterval: number
}

export { ILoginResponse, IUser, IClusterMetricsConfig }