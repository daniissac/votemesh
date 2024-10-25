// Core state
let connections = [];
let pollData = {};
const discovery = new PeerDiscovery();
const BASE_URL = '/votemesh';

// Network initialization
async function initializeVoteMesh() {
    const nodeId = crypto.getRandomValues(new Uint8Array(32))[0];
    await discovery.joinNetwork(nodeId);
    setupNetworkListeners();
    updateNetworkStatus();
}

function setupNetworkListeners() {
    discovery.on('peerDiscovered', async (peerId) => {
        const connection = new WebRTCConnection(peerId);
        connections.push(connection);
        await establishConnection(connection);
        updateNetworkStatus();
    });
}

// Poll creation and management
function createPoll() {
    const question = document.getElementById('question').value;
    const options = Array.from(document.getElementsByClassName('option-input'))
        .map(input => input.value)
        .filter(value => value.trim() !== '');

    pollData = {
        id: crypto.randomUUID(),
        question,
        options,
        votes: Object.fromEntries(options.map(opt => [opt, 0])),
        timestamp: Date.now()
    };

    discovery.broadcastPoll(pollData);
    showPollInterface();
    displayPoll();
    displayResults();
}

function showPollInterface() {
    document.getElementById('creator-section').classList.add('hidden');
    document.getElementById('share-section').classList.remove('hidden');
    document.getElementById('voter-section').classList.remove('hidden');
    
    const pollId = pollData.id;
    const shareUrl = `${window.location.origin}${BASE_URL}#${pollId}`;
    document.getElementById('share-url').value = shareUrl;
}

// Voting functionality
function submitVote(option) {
    pollData.votes[option]++;
    broadcastVote(option);
    displayResults();
}

function broadcastVote(option) {
    connections.forEach(conn => {
        conn.sendVote({ 
            pollId: pollData.id, 
            option 
        });
    });
}

// UI updates
function displayPoll() {
    document.getElementById('poll-question').textContent = pollData.question;
    const optionsContainer = document.getElementById('poll-options');
    optionsContainer.innerHTML = '';
    
    pollData.options.forEach(option => {
        const button = document.createElement('button');
        button.className = 'w-full p-3 bg-gray-100 hover:bg-gray-200 rounded text-left';
        button.textContent = option;
        button.onclick = () => submitVote(option);
        optionsContainer.appendChild(button);
    });
}

function displayResults() {
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = '';
    
    const total = Object.values(pollData.votes).reduce((a, b) => a + b, 0);
    
    Object.entries(pollData.votes).forEach(([option, count]) => {
        const percentage = total === 0 ? 0 : Math.round((count / total) * 100);
        
        resultsDiv.innerHTML += `
            <div class="mb-2">
                <div class="flex justify-between mb-1">
                    <span>${option}</span>
                    <span>${percentage}% (${count} votes)</span>
                </div>
                <div class="w-full bg-gray-200 rounded">
                    <div class="bg-green-500 rounded h-2" style="width: ${percentage}%"></div>
                </div>
            </div>
        `;
    });
}

function updateNetworkStatus() {
    document.getElementById('peer-count').textContent = `Connected Peers: ${connections.length}`;
    document.getElementById('dht-status').textContent = `DHT Status: Connected`;
}

// Utility functions
function addOption() {
    const container = document.getElementById('options-container');
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'option-input w-full p-2 border rounded mb-2';
    input.placeholder = `Option ${container.children.length + 1}`;
    container.appendChild(input);
}

function copyShareUrl() {
    const shareUrl = document.getElementById('share-url');
    shareUrl.select();
    document.execCommand('copy');
    alert('Share URL copied to clipboard!');
}

// Handle URL hash for joining polls
window.addEventListener('hashchange', async () => {
    const pollId = window.location.hash.substring(1);
    if (pollId) {
        pollData = await discovery.findPoll(pollId);
        if (pollData) {
            displayPoll();
            displayResults();
        }
    }
});

// Initialize the application
initializeVoteMesh();
