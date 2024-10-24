let peer = new Peer();
let connections = [];
let pollData = {};
let votes = {};

peer.on('open', (id) => {
    if (window.location.hash) {
        const hostId = window.location.hash.substring(1);
        joinPoll(hostId);
    }
});

peer.on('connection', (conn) => {
    handleConnection(conn);
});

function createPoll() {
    const question = document.getElementById('question').value;
    const options = Array.from(document.getElementsByClassName('option-input'))
        .map(input => input.value)
        .filter(value => value.trim() !== '');

    pollData = {
        question,
        options,
        votes: Object.fromEntries(options.map(opt => [opt, 0]))
    };

    document.getElementById('creator-section').classList.add('hidden');
    document.getElementById('share-section').classList.remove('hidden');
    document.getElementById('voter-section').classList.remove('hidden');
    
    const shareUrl = `${window.location.origin}${window.location.pathname}#${peer.id}`;
    document.getElementById('share-url').value = shareUrl;
    
    displayPoll();
    displayResults();
}

function joinPoll(hostId) {
    const conn = peer.connect(hostId);
    handleConnection(conn);
}

function handleConnection(conn) {
    connections.push(conn);
    
    conn.on('open', () => {
        if (pollData.question) {
            conn.send({ type: 'poll-data', data: pollData });
        }
    });

    conn.on('data', (data) => {
        if (data.type === 'poll-data') {
            pollData = data.data;
            document.getElementById('creator-section').classList.add('hidden');
            document.getElementById('voter-section').classList.remove('hidden');
            displayPoll();
        } else if (data.type === 'vote') {
            pollData.votes[data.option]++;
            displayResults();
            broadcastVote(data.option);
        }
    });
}

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

function submitVote(option) {
    pollData.votes[option]++;
    displayResults();
    broadcastVote(option);
}

function broadcastVote(option) {
    connections.forEach(conn => {
        conn.send({ type: 'vote', option });
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
