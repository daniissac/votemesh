export class WebRTCConnection {
    constructor(peerId) {
        this.peerId = peerId;
        this.connection = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        });
        this.dataChannel = null;
        this.onMessage = null;
        this.setupConnection();
    }

    setupConnection() {
        this.dataChannel = this.connection.createDataChannel('voteMesh');
        this.setupEventListeners();
    }

    setupEventListeners() {
        this.dataChannel.onopen = () => {
            console.log(`Connection established with peer: ${this.peerId}`);
        };

        this.dataChannel.onmessage = (event) => {
            if (this.onMessage) {
                try {
                    const data = JSON.parse(event.data);
                    this.onMessage(data);
                } catch (error) {
                    console.error('Error parsing message:', error);
                }
            }
        };

        this.connection.onicecandidate = (event) => {
            if (event.candidate) {
                this.broadcastIceCandidate(event.candidate);
            }
        };
    }

    async connect() {
        try {
            const offer = await this.createOffer();
            await this.handleAnswer(await this.sendOfferToPeer(offer));
            return true;
        } catch (error) {
            console.error('Connection failed:', error);
            return false;
        }
    }

    async createOffer() {
        const offer = await this.connection.createOffer();
        await this.connection.setLocalDescription(offer);
        return offer;
    }

    async handleAnswer(answer) {
        await this.connection.setRemoteDescription(answer);
    }

    send(data) {
        if (this.dataChannel?.readyState === 'open') {
            this.dataChannel.send(data);
        }
    }

    close() {
        this.dataChannel?.close();
        this.connection.close();
    }
}

async function sendOfferToPeer(offer) {
    // Send offer through DHT and wait for answer
    const peerAnswer = await discovery.sendOffer(offer);
    return peerAnswer;
}