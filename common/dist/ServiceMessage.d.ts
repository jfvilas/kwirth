export interface ServiceMessage {
    channel: string;
    instance: string;
    type: string;
    namespace?: string;
    podName?: string;
}
