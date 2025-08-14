import React, { useState, useEffect, useRef } from 'react';
import { User } from '../types';

declare const io: any;

interface Participant {
    id: string;
    name: string;
}

const GroupDiscussionPage: React.FC<{user: User}> = ({ user }) => {
    const [socket, setSocket] = useState<any>(null);
    const [inRoom, setInRoom] = useState(false);
    const [roomCode, setRoomCode] = useState('');
    const [joinRoomCode, setJoinRoomCode] = useState('');
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [error, setError] = useState<string | null>(null);

    const videoRef = useRef<HTMLVideoElement>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);

    useEffect(() => {
        const newSocket = io('http://localhost:3001');
        setSocket(newSocket);

        newSocket.on('connect_error', () => {
            setError("Failed to connect to server. Please ensure the server is running and try again.");
        });

        const getMedia = async () => {
            try {
                const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                setStream(mediaStream);
                if (videoRef.current) {
                    videoRef.current.srcObject = mediaStream;
                }
            } catch (err) {
                console.error("Error accessing media devices.", err);
                setError("Camera and microphone access denied. Please enable permissions in your browser settings.");
            }
        };
        getMedia();

        return () => {
            newSocket.disconnect();
            stream?.getTracks().forEach(track => track.stop());
        };
    }, []);

    useEffect(() => {
        if (!socket) return;
        
        socket.on('gd-room-created', (newRoomCode: string) => {
            setRoomCode(newRoomCode);
            setInRoom(true);
            setParticipants([{ id: socket.id, name: user.name }]);
        });

        socket.on('joined-gd-room', (data: { roomCode: string; participants: Participant[] }) => {
            setRoomCode(data.roomCode);
            setParticipants(data.participants);
            setInRoom(true);
            setError(null);
        });
        
        socket.on('user-joined-gd', (participant: Participant) => {
            setParticipants((prev) => [...prev, participant]);
        });
        
        socket.on('user-left-gd', (socketId: string) => {
            setParticipants((prev) => prev.filter(p => p.id !== socketId));
        });

        socket.on('error', (errorMessage: string) => {
            setError(errorMessage);
        });

    }, [socket, user.name]);


    const handleCreateRoom = () => {
        if (socket) {
            socket.emit('create-gd-room', { userName: user.name });
        }
    };

    const handleJoinRoom = (e: React.FormEvent) => {
        e.preventDefault();
        if (socket && joinRoomCode) {
            socket.emit('join-gd-room', { roomCode: joinRoomCode, userName: user.name });
        }
    };

    const handleLeaveRoom = () => {
        socket.emit('leave-gd-room', roomCode);
        setInRoom(false);
        setRoomCode('');
        setParticipants([]);
    }

    const Lobby = () => (
        <div className="w-full max-w-md mx-auto">
             <div className="bg-gray-800 p-8 rounded-lg shadow-xl mb-6">
                 <h2 className="text-2xl font-bold text-white text-center">Create Discussion Room</h2>
                 <p className="text-gray-400 text-center mt-2">Start a new GD room and invite others with a code.</p>
                 <button onClick={handleCreateRoom} className="w-full mt-4 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-500 transition-colors">
                     Create Room
                 </button>
             </div>
             <div className="bg-gray-800 p-8 rounded-lg shadow-xl">
                <h2 className="text-2xl font-bold text-white text-center">Join Discussion Room</h2>
                <form onSubmit={handleJoinRoom} className="mt-4 space-y-4">
                    <input type="text" placeholder="Enter Room Code" value={joinRoomCode} onChange={e => setJoinRoomCode(e.target.value.toUpperCase())}
                        className="w-full bg-gray-700 text-white p-3 rounded-md border border-gray-600 focus:ring-2 focus:ring-blue-500 focus:outline-none"/>
                    <button type="submit" className="w-full py-3 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-500 transition-colors">
                        Join Room
                    </button>
                </form>
             </div>
        </div>
    );
    
    const Room = () => (
        <div className="h-full flex flex-col">
            <div className="mb-4 flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-white">Room Code: <span className="text-blue-400 font-mono">{roomCode}</span></h2>
                    <p className="text-gray-400">{participants.length} participant(s) in the room.</p>
                </div>
                <button onClick={handleLeaveRoom} className="px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-500 transition-colors">
                    Leave Room
                </button>
            </div>
            <div className="flex-grow grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {stream && (
                    <div className="bg-black rounded-lg overflow-hidden relative">
                         <video ref={videoRef} autoPlay muted className="h-full w-full object-cover"></video>
                         <div className="absolute bottom-2 left-2 bg-black/50 text-white px-2 py-1 text-sm rounded">{user.name} (You)</div>
                    </div>
                )}
                {participants.filter(p => p.id !== socket.id).map(p => (
                    <div key={p.id} className="bg-black rounded-lg overflow-hidden relative flex items-center justify-center">
                       <div className="w-20 h-20 bg-gray-700 rounded-full flex items-center justify-center">
                           <span className="text-2xl font-bold text-white">{p.name.charAt(0).toUpperCase()}</span>
                       </div>
                       <div className="absolute bottom-2 left-2 bg-black/50 text-white px-2 py-1 text-sm rounded">{p.name}</div>
                    </div>
                ))}
            </div>
        </div>
    );

    return (
        <div className="h-full flex flex-col bg-gray-800/50 rounded-lg p-4 md:p-6 animate-fade-in">
             <div className="mb-4">
                <h1 className="text-3xl font-bold text-white">Group Discussion</h1>
                <p className="mt-1 text-gray-400">Join or create a room to practice group discussions with others in real-time.</p>
             </div>
             {error && <p className="mb-4 text-center text-red-400 bg-red-900/50 p-3 rounded-lg">{error}</p>}
             <div className="flex-grow flex items-center justify-center">
                {inRoom ? <Room /> : <Lobby />}
             </div>
        </div>
    );
};

export default GroupDiscussionPage;
