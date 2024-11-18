// Wait for storage initialization
let storageReady = false;
document.addEventListener('DOMContentLoaded', async () => {
    await storageManager.initializeIndexedDB();
    storageReady = true;
    initializeApp();
});

// P2P Connection Management
let peer = null;
let connections = new Set();
let localPolls = new Map();
let activePollId = null; // Track the active poll ID

// DOM Elements
const networkStatus = {
    peerCount: document.getElementById('peer-count'),
    peerId: document.getElementById('peer-id'),
    indicator: document.getElementById('connection-indicator')
};

const sections = {
    creator: document.getElementById('creator-section'),
    voter: document.getElementById('voter-section'),
    share: document.getElementById('share-section')
};

const pollForm = document.getElementById('poll-form');
const addOptionBtn = document.getElementById('add-option-btn');
const pollOptions = document.getElementById('poll-options');
const results = document.getElementById('results');
const shareUrl = document.getElementById('share-url');
const copyUrlBtn = document.getElementById('copy-url-btn');

// Initialize P2P Connection
function initializePeer() {
    peer = new Peer();
    
    peer.on('open', id => {
        networkStatus.peerId.textContent = `Your ID: ${id}`;
        networkStatus.indicator.classList.add('connected');
        loadPollFromUrl();
    });

    peer.on('connection', handleIncomingConnection);
    
    peer.on('error', error => {
        console.error('Peer connection error:', error);
        networkStatus.indicator.classList.remove('connected');
        networkStatus.indicator.classList.add('error');
    });
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
    networkStatus.peerCount.textContent = `Connected Peers: ${connections.size}`;
}

// Data Handling
function handleIncomingData(conn, data) {
    console.log('Received data:', data); // Debug log
    
    switch (data.type) {
        case 'request_poll':
            if (localPolls.has(peer.id)) {
                conn.send({
                    type: 'poll_data',
                    poll: localPolls.get(peer.id)
                });
            }
            break;
            
        case 'poll_data':
            console.log('Received poll data:', data.poll); // Debug log
            localPolls.set(data.poll.id, data.poll);
            activePollId = data.poll.id;
            displayPoll(data.poll);
            break;
            
        case 'vote':
            console.log('Received vote:', data); // Debug log
            handleVote(data.option);
            broadcastToOtherPeers(conn, data);
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
    sections.creator.classList.add('hidden');
    sections.voter.classList.remove('hidden');
    sections.share.classList.remove('hidden');
    
    document.getElementById('poll-question').textContent = poll.question;
    
    // Display options and results
    displayPollOptions(poll);
    displayResults(poll);
}

function displayPollOptions(poll) {
    pollOptions.innerHTML = '';
    
    poll.options.forEach((option, index) => {
        const button = document.createElement('button');
        button.className = 'button button-secondary';
        button.textContent = option;
        button.onclick = () => submitVote(index);
        pollOptions.appendChild(button);
    });
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
    const poll = localPolls.get(activePollId);
    if (!poll) {
        console.error('No active poll found'); // Debug log
        return;
    }
    
    handleVote(optionIndex);
    
    // Broadcast vote to all peers
    for (const conn of connections) {
        conn.send({
            type: 'vote',
            option: optionIndex
        });
    }
}

function handleVote(optionIndex) {
    const poll = localPolls.get(activePollId);
    if (!poll || !poll.options[optionIndex]) {
        console.error('Invalid poll or option index:', { activePollId, optionIndex, poll }); // Debug log
        return;
    }
    
    if (!poll.votes[peer.id]) {
        poll.votes[peer.id] = [];
    }
    
    poll.votes[peer.id].push(optionIndex);
    displayResults(poll);
}

// URL Handling
function updateShareUrl() {
    const url = new URL(window.location.href);
    url.searchParams.set('peer', peer.id);
    shareUrl.value = url.toString();
}

function loadPollFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const peerId = urlParams.get('peer');
    
    if (peerId && peerId !== peer.id) {
        connectToPeer(peerId);
    }
}

// Template Integration
function initializeTemplates() {
    const templatesList = document.getElementById('templates-list');
    const createTemplateBtn = document.getElementById('create-template-btn');
    
    createTemplateBtn.addEventListener('click', () => {
        // Show template creation modal
        showTemplateModal();
    });
    
    // Load and display templates
    refreshTemplatesList();
}

async function refreshTemplatesList() {
    const templatesList = document.getElementById('templates-list');
    const templates = await templatesManager.getAllTemplates();
    
    templatesList.innerHTML = templates.map(template => `
        <div class="template-card" data-template-id="${template.id}">
            <h3>${template.name}</h3>
            <p>${template.question}</p>
        </div>
    `).join('');
    
    // Add click handlers
    templatesList.querySelectorAll('.template-card').forEach(card => {
        card.addEventListener('click', () => useTemplate(card.dataset.templateId));
    });
}

async function useTemplate(templateId) {
    const poll = await templatesManager.createPollFromTemplate(templateId);
    if (poll) {
        document.getElementById('question').value = poll.question;
        updatePollOptions(poll.options);
    }
}

// Event Listeners
pollForm.addEventListener('submit', e => {
    e.preventDefault();
    
    const question = document.getElementById('question').value;
    const options = Array.from(document.getElementsByName('option[]'))
        .map(input => input.value.trim())
        .filter(value => value);
    
    if (question && options.length >= 2) {
        createPoll(question, options);
    }
});

addOptionBtn.addEventListener('click', () => {
    const container = document.getElementById('options-container');
    const optionCount = container.children.length;
    
    const optionGroup = document.createElement('div');
    optionGroup.className = 'option-input-group';
    optionGroup.innerHTML = `
        <input type="text"
               name="option[]"
               class="form-input"
               placeholder="Option ${optionCount + 1}"
               required>
    `;
    
    container.appendChild(optionGroup);
});

copyUrlBtn.addEventListener('click', async () => {
    try {
        await navigator.clipboard.writeText(shareUrl.value);
        copyUrlBtn.textContent = 'Copied!';
        setTimeout(() => {
            copyUrlBtn.textContent = 'Copy Link';
        }, 2000);
    } catch (err) {
        console.error('Failed to copy URL:', err);
    }
});

document.getElementById('export-results-btn').addEventListener('click', async () => {
    if (!activePollId) return;
    
    const poll = localPolls.get(activePollId);
    if (!poll) return;
    
    const data = {
        question: poll.question,
        options: poll.options,
        votes: poll.votes,
        createdAt: poll.createdAt
    };
    
    downloadJson(data, `poll-results-${activePollId}.json`);
});

document.getElementById('export-analytics-btn').addEventListener('click', async () => {
    if (!activePollId) return;
    
    const analytics = await analyticsManager.exportAnalytics(activePollId);
    if (!analytics) return;
    
    downloadJson(analytics, `poll-analytics-${activePollId}.json`);
});

function downloadJson(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Initialize templates when app starts
function initializeApp() {
    initializePeer();
    initializeTemplates();
    setupEventListeners();
}

// Initialize
initializeApp();
