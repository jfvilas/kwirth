import { InstanceConfig, InstanceConfigActionEnum } from './InstanceConfig';
import WebSocket from 'ws';
type ChannelData = {
    id: string;
    pauseable: boolean;
    modifyable: boolean;
    reconnectable: boolean;
};
interface IChannel {
    getChannelData(): ChannelData;
    getChannelScopeLevel(scope: string): number;
    startInstance(webSocket: WebSocket, instanceConfig: InstanceConfig, podNamespace: string, podName: string, containerName: string): void;
    pauseContinueInstance(webSocket: WebSocket, instanceConfig: InstanceConfig, action: InstanceConfigActionEnum): void;
    modifyInstance(webSocket: WebSocket, instanceConfig: InstanceConfig): void;
    containsInstance(instanceId: string): boolean;
    stopInstance(webSocket: WebSocket, instanceConfig: InstanceConfig): void;
    removeInstance(webSocket: WebSocket, instanceId: string): void;
    removeConnection(webSocket: WebSocket): void;
    updateConnection(webSocket: WebSocket, instanceId: string): boolean;
}
export type { ChannelData };
export { IChannel };
