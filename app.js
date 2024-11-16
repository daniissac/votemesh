class VoteMesh {
    constructor() {
        this.peers = new Map();
        this.polls = new Map();
        this.initializePeer();
        this.setupEventListeners();
        this.loadPolls();
        this.initializeFromUrl();
    }

    initializePeer() {
        // Initialize PeerJS with random ID
        this.peer = new Peer(this.generateId());
        
        this.peer.on('open', (id) => {
            console.log('My peer ID is: ' + id);
            document.getElementById('peer-id').textContent = `Your ID: ${id}`;
            document.getElementById('connection-indicator').classList.add('connected');
            this.broadcastPresence();
        });

        this.peer.on('connection', (conn) => {
            this.setupConnection(conn);
        });

        this.peer.on('error', (err) => {
            console.error('Peer error:', err);
            document.getElementById('connection-indicator').classList.add('error');
        });
    }

    setupConnection(conn) {
        conn.on('open', () => {
            this.peers.set(conn.peer, conn);
            this.updatePeerCount();
            
            // Send all known polls to the new peer
            this.polls.forEach(poll => {
                conn.send({
                    type: 'poll_state',
                    poll: poll
                });
            });
        });

        conn.on('data', (data) => {
            this.handlePeerMessage(data, conn.peer);
        });

        conn.on('close', () => {
            this.peers.delete(conn.peer);
            this.updatePeerCount();
        });
    }

    handlePeerMessage(data, fromPeerId) {
        switch (data.type) {
            case 'presence':
                if (!this.peers.has(fromPeerId)) {
                    this.connectToPeer(fromPeerId);
                }
                break;

            case 'poll_state':
                this.updatePollState(data.poll);
                break;

            case 'vote':
                this.handleVote(data.pollId, data.optionIndex, fromPeerId);
                break;
        }
    }

    broadcastPresence() {
        // Broadcast presence through localStorage
        const presence = {
            peerId: this.peer.id,
            timestamp: Date.now()
        };
        localStorage.setItem('votemesh_presence', JSON.stringify(presence));
        
        // Listen for other peers
        window.addEventListener('storage', (e) => {
            if (e.key === 'votemesh_presence') {
                const presence = JSON.parse(e.newValue);
                if (presence.peerId !== this.peer.id) {
                    this.connectToPeer(presence.peerId);
                }
            }
        });
    }

    connectToPeer(peerId) {
        if (!this.peers.has(peerId)) {
            const conn = this.peer.connect(peerId);
            this.setupConnection(conn);
        }
    }

    setupEventListeners() {
        // Poll creation form
        const pollForm = document.getElementById('poll-form');
        pollForm.addEventListener('submit', (e) => this.handlePollCreation(e));

        // Add option button
        const addOptionBtn = document.getElementById('add-option-btn');
        addOptionBtn.addEventListener('click', () => this.addOptionInput());

        // Copy URL button
        const copyUrlBtn = document.getElementById('copy-url-btn');
        copyUrlBtn.addEventListener('click', () => this.copyPollUrl());
    }

    async handlePollCreation(e) {
        e.preventDefault();

        const question = document.getElementById('question').value;
        const optionInputs = document.querySelectorAll('.option-input');
        const options = Array.from(optionInputs).map(input => ({
            text: input.value,
            votes: 0
        }));

        const poll = {
            id: this.generateId(),
            question,
            options,
            created: Date.now(),
            votes: {} // Track who voted for what
        };

        this.updatePollState(poll);
        this.broadcastPoll(poll);

        // Update URL and UI
        window.history.pushState({}, '', `#${poll.id}`);
        this.showPoll(poll);
        this.updateShareUrl(poll.id);
    }

    handleVote(pollId, optionIndex, voterId) {
        const poll = this.polls.get(pollId);
        if (!poll) return;

        // Check if user already voted
        if (poll.votes[voterId] !== undefined) {
            const previousVote = poll.votes[voterId];
            poll.options[previousVote].votes--;
        }

        // Record new vote
        poll.votes[voterId] = optionIndex;
        poll.options[optionIndex].votes++;

        // Update local state and storage
        this.updatePollState(poll);
        
        // Broadcast vote to peers
        this.broadcastToPeers({
            type: 'vote',
            pollId,
            optionIndex
        });

        // Update display
        this.updatePollDisplay(poll);
    }

    updatePollState(poll) {
        this.polls.set(poll.id, poll);
        this.savePollToStorage(poll);
        this.updatePollDisplay(poll);
    }

    broadcastPoll(poll) {
        this.broadcastToPeers({
            type: 'poll_state',
            poll: poll
        });
    }

    broadcastToPeers(message) {
        this.peers.forEach(conn => {
            if (conn.open) {
                conn.send(message);
            }
        });
    }

    updatePollDisplay(poll) {
        document.getElementById('poll-question').textContent = poll.question;

        const optionsContainer = document.getElementById('poll-options');
        const resultsContainer = document.getElementById('results');
        
        optionsContainer.innerHTML = '';
        resultsContainer.innerHTML = '';

        const totalVotes = poll.options.reduce((sum, opt) => sum + opt.votes, 0);

        poll.options.forEach((option, index) => {
            // Create voting button
            const button = document.createElement('button');
            button.className = 'button button-blue';
            button.textContent = option.text;
            button.addEventListener('click', () => this.handleVote(poll.id, index, this.peer.id));
            optionsContainer.appendChild(button);

            // Create result bar
            const percentage = totalVotes === 0 ? 0 : (option.votes / totalVotes) * 100;
            const resultBar = document.createElement('div');
            resultBar.className = 'result-bar';
            resultBar.innerHTML = `
                <div class="result-header">
                    <span class="result-text">${option.text}</span>
                    <span class="result-votes">${option.votes} votes (${percentage.toFixed(1)}%)</span>
                </div>
                <div class="result-bar-bg">
                    <div class="result-bar-fill" style="width: ${percentage}%"></div>
                </div>
            `;
            resultsContainer.appendChild(resultBar);
        });
    }

    addOptionInput() {
        const optionsContainer = document.getElementById('options-container');
        const optionCount = optionsContainer.children.length;
        
        if (optionCount >= 10) {
            alert('Maximum 10 options allowed');
            return;
        }

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'form-input';
        input.placeholder = `Option ${optionCount + 1}`;
        input.required = true;
        
        optionsContainer.appendChild(input);
    }

    copyPollUrl() {
        const url = document.getElementById('share-url').value;
        navigator.clipboard.writeText(url).then(() => {
            const copyBtn = document.getElementById('copy-url-btn');
            const originalText = copyBtn.textContent;
            copyBtn.textContent = 'Copied!';
            setTimeout(() => copyBtn.textContent = originalText, 2000);
        });
    }

    updateShareUrl(pollId) {
        const shareUrl = `${window.location.origin}${window.location.pathname}#${pollId}`;
        document.getElementById('share-url').value = shareUrl;
        document.getElementById('share-section').classList.remove('hidden');
    }

    updatePeerCount() {
        document.getElementById('peer-count').textContent = `Connected Peers: ${this.peers.size}`;
    }

    generateId() {
        return Math.random().toString(36).substr(2, 9);
    }

    savePollToStorage(poll) {
        try {
            const polls = JSON.parse(localStorage.getItem('votemesh_polls') || '{}');
            polls[poll.id] = poll;
            localStorage.setItem('votemesh_polls', JSON.stringify(polls));
        } catch (err) {
            console.error('Error saving poll to storage:', err);
        }
    }

    loadPolls() {
        try {
            const polls = JSON.parse(localStorage.getItem('votemesh_polls') || '{}');
            Object.values(polls).forEach(poll => {
                this.polls.set(poll.id, poll);
            });
        } catch (err) {
            console.error('Error loading polls from storage:', err);
        }
    }

    initializeFromUrl() {
        const pollId = window.location.hash.slice(1);
        if (pollId) {
            const poll = this.polls.get(pollId);
            if (poll) {
                this.showPoll(poll);
                this.updateShareUrl(pollId);
            }
        }
    }

    showPoll(poll) {
        document.getElementById('creator-section').classList.add('hidden');
        document.getElementById('voter-section').classList.remove('hidden');
        this.updatePollDisplay(poll);
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new VoteMesh();
});
