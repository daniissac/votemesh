# VoteMesh

A decentralized peer-to-peer polling platform that works directly in your browser. Create and share polls instantly with no server required!

## Features

- 🌐 Create and share polls instantly
- 📱 Real-time voting and results
- 🔄 Automatic peer discovery
- 💾 Local data persistence
- 🔒 No server required
- 📊 Beautiful result visualization
- 🎨 Modern, responsive UI

## How It Works

VoteMesh uses PeerJS for WebRTC-based peer-to-peer communication and browser's localStorage for data persistence. When you create a poll:

1. A unique poll ID is generated
2. Poll data is stored locally
3. Connected peers are notified
4. A shareable URL is created

When someone votes:
1. Their vote is recorded locally
2. The vote is broadcast to all connected peers
3. Results update in real-time for everyone

## Technology Stack

- PeerJS for P2P communication
- WebRTC Data Channels
- Browser's localStorage for persistence
- Tailwind CSS for styling
- Pure JavaScript (ES6+)

## Usage

1. Visit [https://daniissac.com/votemesh](https://daniissac.com/votemesh)
2. Create a poll by entering:
   - Your question
   - Multiple choice options (up to 10)
3. Share the generated URL with others
4. Watch as votes come in real-time!

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- PeerJS for WebRTC simplification
- Tailwind CSS for styling
- Pure JavaScript (ES6+)
