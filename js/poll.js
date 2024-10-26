import { PeerDiscovery } from './peer-discovery.js';

const discovery = new PeerDiscovery();

export function createPoll() {
  const question = document.getElementById('question').value;
  const options = Array.from(document.getElementsByClassName('option-input'))
      .map(input => input.value)
      .filter(value => value.trim() !== '');

  const pollData = {
      id: crypto.randomUUID(),
      question,
      options,
      votes: Object.fromEntries(options.map(opt => [opt, 0])),
      timestamp: Date.now()
  };

  discovery.broadcastPoll(pollData);
  showPollInterface(pollData);
  return pollData;
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