export interface StreamMessage {
    namespace?: string,
    podName?: string,
    type: string,
    text: string,
    timestamp?: Date
}
