class WebRTCConnection {
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
