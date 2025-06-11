import { InstanceMessage } from "@jfvilas/kwirth-common"

export interface IEchoMessage extends InstanceMessage {
    namespace: string
    pod: string
    container: string
    text: string
}

export class EchoObject {
    public lines: string[] = []
}
