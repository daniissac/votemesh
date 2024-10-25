export class WebRTCConnection {
    constructor(peerId) {
        this.peerId = peerId;
        this.connection = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        });
        this.dataChannel = this.connection.createDataChannel('voteMesh');
        this.setupEventListeners();
    }

    setupEventListeners() {
        this.dataChannel.onmessage = this.handleMessage.bind(this);
        this.dataChannel.onopen = () => console.log('Connection established with peer:', this.peerId);
        this.connection.onicecandidate = event => {
            if (event.candidate) {
                this.broadcastIceCandidate(event.candidate);
            }
        };
    }

    async createOffer() {
        const offer = await this.connection.createOffer();
        await this.connection.setLocalDescription(offer);
        return offer;
    }

    async handleAnswer(answer) {
        await this.connection.setRemoteDescription(answer);
    }

    handleMessage(event) {
        const data = JSON.parse(event.data);
        if (data.type === 'VOTE') {
            updatePollData(data.vote);
        }
    }

    sendVote(vote) {
        this.dataChannel.send(JSON.stringify({
            type: 'VOTE',
            vote: vote
        }));
    }
}

async function establishConnection(connection) {
    try {
        const offer = await connection.createOffer();
        await connection.handleAnswer(await sendOfferToPeer(offer));
        return true;
    } catch (error) {
        console.error('Failed to establish connection:', error);
        return false;
    }
}

async function sendOfferToPeer(offer) {
    // Send offer through DHT and wait for answer
    const peerAnswer = await discovery.sendOffer(offer);
    return peerAnswer;
}
