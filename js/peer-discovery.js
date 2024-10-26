import { DHTNode } from './dht.js';
import { EventEmitter } from './event-emitter.js';
import { WebRTCConnection } from './webrtc.js';

export class PeerDiscovery extends EventEmitter {
    constructor() {
        super();
        this.dht = null;
        this.peers = new Map();
        this.bootstrapNodes = [
            '0x1234567890abcdef',
            '0xabcdef1234567890'
        ];
    }

    async joinNetwork(nodeId) {
        this.dht = new DHTNode(nodeId);
        
        for (const bootstrapId of this.bootstrapNodes) {
            try {
                const peers = await this.dht.findNode(bootstrapId);
                peers.forEach(([peerId]) => this.connectToPeer(peerId));
            } catch (error) {
                console.warn(`Failed to connect to bootstrap node ${bootstrapId}`);
            }
        }
    }

    async connectToPeer(peerId) {
        if (!this.peers.has(peerId)) {
            const connection = new WebRTCConnection(peerId);
            this.peers.set(peerId, connection);
            
            connection.onMessage = (data) => {
                this.emit('peerMessage', peerId, data);
            };

            await connection.connect();
            this.emit('peerConnected', peerId);
        }
    }

    broadcastPoll(pollData) {
        const pollId = pollData.id;
        this.dht.store(pollId, pollData);
        this.peers.forEach(connection => {
            connection.send(JSON.stringify({
                type: 'POLL',
                data: pollData
            }));
        });
        return pollId;
    }

    async findPoll(pollId) {
        return this.dht.get(pollId);
    }

    disconnect() {
        this.peers.forEach(connection => connection.close());
        this.peers.clear();
        this.dht.cleanup();
    }
}