# VoteMesh

A 100% decentralized, peer-to-peer polling application that works directly in your browser using DHT-based peer discovery and WebRTC.

![VoteMesh Logo](public/votemesh-icon.svg)

## Features

- 🌐 Fully decentralized using DHT (Distributed Hash Table)
- 🔄 Direct WebRTC peer connections
- 📱 Mobile-friendly responsive design
- ⚡ Real-time vote synchronization
- 🔗 Easy poll sharing
- 🎨 Beautiful minimal UI
- 🔒 Zero server dependency

## How It Works

VoteMesh uses a Kademlia-style DHT for peer discovery and native WebRTC for direct peer-to-peer connections:

1. New peers join the DHT network through bootstrap nodes
2. Polls are stored and discovered through the distributed hash table
3. Direct WebRTC connections are established between peers
4. Votes are synchronized in real-time across the mesh network

## Technology Stack

- Custom DHT implementation for peer discovery
- Native WebRTC for P2P communication
- Tailwind CSS for styling
- Pure JavaScript for functionality

## Usage

1. Open VoteMesh in your browser
2. Wait for DHT network connection
3. Create a poll with your question and options
4. Share the generated poll ID with participants
5. Watch votes come in real-time through the P2P mesh!

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Live Demo

Check out the [Demo here](https://daniissac.com/votemesh)

## License

MIT License - see the [LICENSE](LICENSE) file for details
