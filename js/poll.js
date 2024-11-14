import { PeerDiscovery } from './peer-discovery.js';

const discovery = new PeerDiscovery();

export class PollManager {
    constructor(discovery) {
        this.discovery = discovery;
        this.polls = new Map();
        this.activeVoters = new Set();
        
        // Setup poll sync interval
        setInterval(() => this.syncPolls(), 30000);
    }

    createPoll(question, options) {
        const pollId = crypto.randomUUID();
        const poll = {
            id: pollId,
            question,
            options,
            votes: Object.fromEntries(options.map(opt => [opt, 0])),
            timestamp: Date.now(),
            creator: this.discovery.nodeId
        };

        this.polls.set(pollId, poll);
        this.discovery.broadcastPoll(poll);
        return poll;
    }

    recordVote(pollId, option) {
        const poll = this.polls.get(pollId);
        if (!poll) return false;

        poll.votes[option]++;
        this.discovery.broadcastVote(pollId, option);
        return true;
    }

    // Add methods for poll syncing and validation
}

export function addOption() {
  const container = document.getElementById('options-container');
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'option-input w-full p-2 border rounded mb-2';
  input.placeholder = `Option ${container.children.length + 1}`;
  container.appendChild(input);
}

export function showPollInterface(pollData) {
  document.getElementById('creator-section').classList.add('hidden');
  document.getElementById('voter-section').classList.remove('hidden');
  document.getElementById('share-section').classList.remove('hidden');
    
  const shareUrl = `${window.location.origin}/votemesh#${pollData.id}`;
  document.getElementById('share-url').value = shareUrl;
}

export function copyShareUrl() {
  const shareUrl = document.getElementById('share-url');
  shareUrl.select();
  document.execCommand('copy');
  alert('Share URL copied!');
}