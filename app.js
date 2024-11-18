// Wait for storage initialization
let storageReady = false;
document.addEventListener('DOMContentLoaded', async () => {
    await storageManager.initializeIndexedDB();
    storageReady = true;
});

// P2P Connection Management
let peer = null;
let connections = new Set();
let localPolls = new Map();
let activePollId = null; // Track the active poll ID
let selectedOption = null; // Track selected option

// DOM Elements
const sections = {
    creator: document.getElementById('creator-section'),
    voter: document.getElementById('voter-section'),
    share: document.getElementById('share-section'),
    results: document.getElementById('results-section')
};

const elements = {
    pollForm: document.getElementById('poll-form'),
    pollOptions: document.getElementById('poll-vote-options'), 
    pollOptionsContainer: document.getElementById('poll-options'),
    addOptionBtn: document.getElementById('add-option-btn'),
    shareUrl: document.getElementById('share-url'),
    copyUrlBtn: document.getElementById('copy-url-btn'),
    submitVoteBtn: document.getElementById('submit-vote-btn'),
    networkStatus: {
        peerId: document.getElementById('peer-id'),
        peerCount: document.getElementById('peer-count'),
        indicator: document.getElementById('connection-indicator')
    }
};

// Network Status Management
function updateNetworkStatus(isConnected) {
    const networkStatus = elements.networkStatus;
    if (!networkStatus) return;

    if (!isConnected) {
        networkStatus.classList.remove('hidden');
        networkStatus.querySelector('.status-indicator')?.classList.remove('connected');
        networkStatus.querySelector('.status-text').textContent = 'Connection Issue';
    } else {
        networkStatus.classList.add('hidden');
    }
}

// Initialize P2P Connection
function initializePeer() {
    try {
        peer = new Peer(generatePeerId(), {
            debug: 2,
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                    { urls: 'stun:stun2.l.google.com:19302' },
                    { urls: 'stun:stun3.l.google.com:19302' },
                    { urls: 'stun:stun4.l.google.com:19302' }
                ]
            }
        });

        peer.on('open', id => {
            console.log('Connected with ID:', id);
            updateNetworkStatus(true);
        });

        peer.on('error', error => {
            console.error('Peer connection error:', error);
            updateNetworkStatus(false);
            handlePeerError(error);
        });

        peer.on('disconnected', () => {
            console.log('Disconnected from server');
            updateNetworkStatus(false);
            reconnectPeer();
        });

        peer.on('connection', handlePeerConnection);

    } catch (error) {
        console.error('Failed to initialize peer:', error);
        updateNetworkStatus(false);
    }
}

// Connection Handling
function handleIncomingConnection(conn) {
    connections.add(conn);
    updatePeerCount();
    
    conn.on('data', data => handleIncomingData(conn, data));
    conn.on('close', () => {
        connections.delete(conn);
        updatePeerCount();
    });
}

function connectToPeer(peerId) {
    if (peerId === peer.id) return; // Don't connect to self
    
    const conn = peer.connect(peerId);
    
    conn.on('open', () => {
        connections.add(conn);
        updatePeerCount();
        activePollId = peerId; // Set active poll to creator's ID
        
        // Request poll data if we're joining as a voter
        conn.send({ type: 'request_poll' });
    });
    
    conn.on('data', data => handleIncomingData(conn, data));
    conn.on('close', () => {
        connections.delete(conn);
        updatePeerCount();
    });
}

function updatePeerCount() {
    elements.networkStatus.peerCount.textContent = `Connected Peers: ${connections.size}`;
}

// Data Handling
function handleIncomingData(conn, data) {
    console.log('Received data:', data);
    
    switch (data.type) {
        case 'request_poll':
            console.log('Poll requested, checking local polls...');
            if (peer && peer.id && localPolls.has(peer.id)) {
                console.log('Sending poll:', localPolls.get(peer.id));
                conn.send({
                    type: 'poll_data',
                    poll: localPolls.get(peer.id)
                });
            } else {
                console.log('No poll found to send');
                conn.send({
                    type: 'error',
                    message: 'No active poll found'
                });
            }
            break;
            
        case 'poll_data':
            console.log('Received poll data:', data.poll);
            if (data.poll && data.poll.id) {
                localPolls.set(data.poll.id, data.poll);
                activePollId = data.poll.id;
                displayPoll(data.poll);
            }
            break;
            
        case 'vote':
            console.log('Received vote:', data);
            if (data.option !== undefined) {
                handleVote(data.option);
                broadcastToOtherPeers(conn, data);
            }
            break;
            
        case 'error':
            console.error('Received error:', data.message);
            // Handle error appropriately
            break;
    }
}

function broadcastToOtherPeers(sourceConn, data) {
    for (const conn of connections) {
        if (conn !== sourceConn) {
            conn.send(data);
        }
    }
}

// Enhanced Poll Creation
async function createPoll(question, options, settings = {}) {
    const poll = {
        id: peer.id,
        question,
        options,
        settings: {
            multipleChoice: settings.multipleChoice || false,
            hideResults: settings.hideResults || false
        },
        votes: {},
        createdAt: Date.now()
    };
    
    await storageManager.savePoll(poll);
    localPolls.set(poll.id, poll);
    activePollId = poll.id;
    
    // Broadcast to peers
    broadcastToOtherPeers(null, {
        type: 'poll_data',
        poll
    });
    
    displayPoll(poll);
    updateShareUrl();
    
    // Initialize analytics
    analyticsManager.trackVote(poll.id, null, poll.createdAt);
}

// Poll Display
function displayPoll(poll) {
    if (!poll) {
        console.error('No poll data to display');
        return;
    }

    try {
        // Hide creator section and show voter/share sections
        sections.creator.classList.add('hidden');
        sections.voter.classList.remove('hidden');
        sections.share.classList.remove('hidden');
        
        // Update question
        const questionElement = document.getElementById('poll-question');
        if (questionElement) {
            questionElement.textContent = poll.question;
        }
        
        // Display options and results
        displayPollOptions(poll);
        displayResults(poll);
        
        // Update share URL
        updateShareUrl();
    } catch (error) {
        console.error('Error displaying poll:', error);
    }
}

function displayPollOptions(poll) {
    if (!elements.pollOptions) {
        console.error('Poll options container not found');
        return;
    }

    try {
        elements.pollOptions.innerHTML = '';
        
        poll.options.forEach((option, index) => {
            const optionDiv = document.createElement('div');
            optionDiv.className = 'option-group';
            
            const button = document.createElement('button');
            button.className = 'button secondary full-width';
            button.innerHTML = `<i data-feather="circle"></i> ${option}`;
            button.onclick = () => selectOption(index, button);
            
            optionDiv.appendChild(button);
            elements.pollOptions.appendChild(optionDiv);
        });
        
        // Re-initialize Feather icons for the new buttons
        if (window.feather) {
            feather.replace();
        }

        // Enable/disable submit button based on selection
        updateSubmitButton();
    } catch (error) {
        console.error('Error displaying poll options:', error);
    }
}

function selectOption(index, button) {
    // Remove selected class from all buttons
    const buttons = elements.pollOptions.querySelectorAll('.button');
    buttons.forEach(btn => btn.classList.remove('selected'));
    
    // Add selected class to clicked button
    button.classList.add('selected');
    
    // Update selected option
    selectedOption = index;
    
    // Enable/disable submit button
    updateSubmitButton();
}

function updateSubmitButton() {
    if (!elements.submitVoteBtn) return;
    
    if (selectedOption !== null) {
        elements.submitVoteBtn.removeAttribute('disabled');
    } else {
        elements.submitVoteBtn.setAttribute('disabled', 'disabled');
    }
}

function displayResults(poll) {
    const resultsDiv = document.getElementById('results');
    if (!poll || !resultsDiv) return;

    const totalVotes = Object.values(poll.votes).flat().length;
    const voteCounts = {};
    
    // Count votes for each option
    Object.values(poll.votes).flat().forEach(vote => {
        voteCounts[vote] = (voteCounts[vote] || 0) + 1;
    });
    
    // Display results
    resultsDiv.innerHTML = poll.options.map((option, index) => {
        const count = voteCounts[index] || 0;
        const percentage = totalVotes ? (count / totalVotes * 100).toFixed(1) : 0;
        
        return `
            <div class="result-item">
                <div class="result-label">
                    <span>${option}</span>
                    <span>${count} votes (${percentage}%)</span>
                </div>
                <div class="result-bar" style="width: ${percentage}%"></div>
            </div>
        `;
    }).join('');
    
    // Update analytics charts
    analyticsManager.renderVoteDistribution(poll.id, 'vote-distribution-chart');
    analyticsManager.renderVotingTrend(poll.id, 'voting-trend-chart');
}

// Vote Handling
function submitVote(optionIndex) {
    if (!activePollId || !localPolls.has(activePollId)) {
        console.error('No active poll found');
        return;
    }

    const poll = localPolls.get(activePollId);
    
    // Check if user has already voted
    const existingVotes = poll.votes[peer.id] || [];
    if (existingVotes.length > 0) {
        console.log('User has already voted');
        return;
    }

    // Record the vote
    if (!poll.votes[peer.id]) {
        poll.votes[peer.id] = [];
    }
    poll.votes[peer.id].push(optionIndex);

    // Update local storage
    localPolls.set(activePollId, poll);
    storageManager.savePoll(poll);

    // Broadcast vote to peers
    broadcastToOtherPeers(null, {
        type: 'vote',
        pollId: activePollId,
        option: optionIndex,
        voterId: peer.id
    });

    // Update display
    displayResults(poll);
    
    // Track analytics
    analyticsManager.trackVote(poll.id, optionIndex);
    
    // Disable voting options after vote is submitted
    disableVoting();
}

function disableVoting() {
    // Disable all option buttons
    const buttons = elements.pollOptions.querySelectorAll('.button');
    buttons.forEach(button => {
        button.setAttribute('disabled', 'disabled');
        button.classList.add('voted');
    });
    
    // Disable submit button
    if (elements.submitVoteBtn) {
        elements.submitVoteBtn.setAttribute('disabled', 'disabled');
    }
}

// URL Handling
function updateShareUrl() {
    const shareUrlInput = elements.shareUrl;
    const shareSection = sections.share;
    
    if (!shareUrlInput || !shareSection) {
        console.error('Share URL elements not found');
        return;
    }

    try {
        const url = new URL(window.location.href);
        url.searchParams.set('peer', peer.id);
        shareUrlInput.value = url.toString();
        shareSection.classList.remove('hidden');
    } catch (error) {
        console.error('Failed to update share URL:', error);
    }
}

function loadPollFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const peerId = urlParams.get('peer');
    
    if (peerId && peerId !== peer.id) {
        connectToPeer(peerId);
    }
}

// Event Listener Setup
function setupEventListeners() {
    if (!elements.createPollForm) return;

    elements.createPollForm.addEventListener('submit', handlePollCreation);
    elements.addOptionBtn?.addEventListener('click', addOptionInput);
    
    // Remove option buttons
    document.addEventListener('click', event => {
        if (event.target.closest('.remove-option')) {
            const optionInput = event.target.closest('.option-input');
            if (optionInput && document.querySelectorAll('.option-input').length > 2) {
                optionInput.remove();
            }
        }
    });

    // Submit vote button
    elements.submitVoteBtn?.addEventListener('click', () => {
        if (selectedOption !== null) {
            submitVote(selectedOption);
            selectedOption = null;
        }
    });

    // Export results
    elements.exportBtn?.addEventListener('click', async () => {
        const poll = localPolls.get(activePollId);
        if (!poll) return;
        
        const results = {
            question: poll.question,
            options: poll.options,
            votes: poll.votes,
            created: poll.created,
            id: poll.id
        };
        
        downloadJson(results, `poll-results-${poll.id}.json`);
    });

    // Export analytics
    elements.exportAnalyticsBtn?.addEventListener('click', async () => {
        const analytics = await analyticsManager.exportAnalytics(activePollId);
        if (!analytics) return;
        
        downloadJson(analytics, `poll-analytics-${activePollId}.json`);
    });
}

// Initialize the application
async function initializeApp() {
    try {
        console.log('Initializing application...');
        
        // First, initialize the database
        await storageManager.initializeIndexedDB();
        console.log('Database initialized');
        
        // Initialize peer connection
        initializePeer();
        console.log('Peer initialized');
        
        // Setup event listeners
        setupEventListeners();
        console.log('Event listeners set up');
        
        console.log('Application initialized successfully');
    } catch (error) {
        console.error('Failed to initialize application:', error);
        // Show error to user
        elements.networkStatus.peerId.textContent = 'Failed to initialize application';
        elements.networkStatus.indicator.classList.add('error');
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Content Loaded');
    initializeApp().catch(error => {
        console.error('Failed to initialize application:', error);
    });
});

// Add two default options
document.addEventListener('DOMContentLoaded', () => {
    for (let i = 1; i <= 2; i++) {
        addOption(i);
    }
});

function addOption(number) {
    if (!elements.pollOptionsContainer) {
        console.error('Poll options container not found');
        return;
    }

    const optionGroup = document.createElement('div');
    optionGroup.className = 'option-input-group';
    optionGroup.innerHTML = `
        <input type="text"
               name="option[]"
               class="form-input"
               placeholder="Option ${number}"
               required>
    `;
    elements.pollOptionsContainer.appendChild(optionGroup);
}
