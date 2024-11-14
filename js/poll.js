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

    syncPolls() {
        // Request latest poll data from peers
        this.discovery.broadcast({
            type: 'SYNC_REQUEST',
            data: {
                polls: Array.from(this.polls.keys())
            }
        });
    }

    handlePollMessage(pollData) {
        if (!this.polls.has(pollData.id)) {
            this.polls.set(pollData.id, pollData);
        }
    }

    handleVoteMessage(voteData) {
        const { pollId, option } = voteData;
        const poll = this.polls.get(pollId);
        if (poll) {
            poll.votes[option]++;
        }
    }

    handleSyncMessage(syncData) {
        syncData.polls.forEach(poll => {
            const existingPoll = this.polls.get(poll.id);
            if (!existingPoll || existingPoll.timestamp < poll.timestamp) {
                this.polls.set(poll.id, poll);
            }
        });
    }

    getPoll(pollId) {
        return this.polls.get(pollId);
    }
}