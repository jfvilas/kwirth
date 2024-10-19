export enum ServiceConfigTypeEnum {
    LOG='log',
    METRICS='metrics',
    // OPER='oper' will be implemented for segregating restart from log
}

export interface ServiceConfig {
    type:ServiceConfigTypeEnum
    accessKey:string
    view:string
    scope:string
    namespace:string
    group:string
    set:string
    pod:string
    container:string
}