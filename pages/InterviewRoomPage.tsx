import React, { useState, useEffect, useRef } from 'react';
import { User } from '../types';

declare const io: any;

type Role = 'interviewer' | 'student';

interface RoomState {
    interviewer: { id: string; name: string } | null;
    student: { id: string; name: string } | null;
    code: string;
}

const InterviewRoomPage: React.FC<{ user: User }> = ({ user }) => {
    const [socket, setSocket] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    const [role, setRole] = useState<Role | null>(null);
    const [roomCode, setRoomCode] = useState('');
    const [joinRoomCode, setJoinRoomCode] = useState('');
    
    const [inRoom, setInRoom] = useState(false);
    const [roomState, setRoomState] = useState<RoomState | null>(null);
    const [output, setOutput] = useState('// Code output will appear here');
    
    const studentCode = roomState?.code ?? '';

    useEffect(() => {
        const newSocket = io('http://localhost:3001');
        setSocket(newSocket);

        newSocket.on('connect_error', () => {
            setError("Failed to connect to server. Please ensure the server is running and try again.");
            setInRoom(false);
            setRole(null);
        });

        return () => newSocket.disconnect();
    }, []);

    useEffect(() => {
        if (!socket) return;
        
        socket.on('interview-room-created', (newRoomCode: string) => {
            setRoomCode(newRoomCode);
        });

        socket.on('interview-room-ready', (initialRoomState: RoomState) => {
            setRoomState(initialRoomState);
            setInRoom(true);
            setError(null);
        });
        
        socket.on('code-updated', (newCode: string) => {
            setRoomState(prev => prev ? {...prev, code: newCode} : null);
        });
        
        socket.on('output-updated', (newOutput: string) => {
            setOutput(newOutput);
        });

        socket.on('partner-disconnected', () => {
            setError('The other participant has disconnected. The session has ended.');
            setInRoom(false);
        });

        socket.on('error', (errorMessage: string) => setError(errorMessage));

    }, [socket]);

    const handleCreateRoom = () => {
        setRole('interviewer');
        socket.emit('create-interview-room', { userName: user.name });
    };
    
    const handleJoinRoom = (e: React.FormEvent) => {
        e.preventDefault();
        setRole('student');
        socket.emit('join-interview-room', { roomCode: joinRoomCode, userName: user.name });
    };
    
    const handleCodeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newCode = e.target.value;
        setRoomState(prev => prev ? {...prev, code: newCode} : null);
        socket.emit('code-change', { roomCode: roomState?.interviewer ? joinRoomCode : roomCode, newCode });
    };

    const runCode = (codeToRun: string) => {
        let capturedLogs: string[] = [];
        const originalLog = console.log;
        console.log = (...args) => {
            capturedLogs.push(args.map(arg => {
                try {
                    return typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg);
                } catch (e) {
                    return 'Unserializable object';
                }
            }).join(' '));
        };
        try {
            const result = new Function(codeToRun)();
            if (result !== undefined) {
                capturedLogs.push(`Returned: ${JSON.stringify(result, null, 2)}`);
            }
            return capturedLogs.length > 0 ? capturedLogs.join('\n') : 'Code executed successfully with no output.';
        } catch (error: any) {
            return error.toString();
        } finally {
            console.log = originalLog;
        }
    };

    const handleRunCode = () => {
        const executionResult = runCode(studentCode);
        setOutput(executionResult);
        socket.emit('code-run', { roomCode: joinRoomCode, output: executionResult });
    };

    const Lobby = () => (
         <div className="w-full max-w-lg mx-auto">
             <div className="bg-gray-800 p-8 rounded-lg shadow-xl mb-6">
                 <h2 className="text-2xl font-bold text-white text-center">Interviewer</h2>
                 <p className="text-gray-400 text-center mt-2">Create a private room to conduct a 1-on-1 interview.</p>
                 <button onClick={handleCreateRoom} className="w-full mt-4 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-500 transition-colors">
                     Create Interview Room
                 </button>
                 {roomCode && (
                    <div className="mt-4 text-center bg-gray-900 p-3 rounded-md">
                        <p className="text-gray-300">Share this code with the student:</p>
                        <p className="text-2xl text-blue-400 font-mono tracking-widest my-2">{roomCode}</p>
                    </div>
                 )}
             </div>
             <div className="bg-gray-800 p-8 rounded-lg shadow-xl">
                <h2 className="text-2xl font-bold text-white text-center">Student</h2>
                 <p className="text-gray-400 text-center mt-2">Join an interview room with a code from an interviewer.</p>
                <form onSubmit={handleJoinRoom} className="mt-4 space-y-4">
                    <input type="text" placeholder="Enter Room Code" value={joinRoomCode} onChange={e => setJoinRoomCode(e.target.value.toUpperCase())}
                        className="w-full bg-gray-700 text-white p-3 rounded-md border border-gray-600 focus:ring-2 focus:ring-blue-500 focus:outline-none"/>
                    <button type="submit" className="w-full py-3 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-500 transition-colors">
                        Join as Student
                    </button>
                </form>
             </div>
        </div>
    );

    const Room = () => (
        <div className="h-full grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Code Editor */}
            <div className="bg-gray-900 rounded-lg flex flex-col">
                <div className="p-3 border-b border-gray-700 flex justify-between items-center">
                    <h3 className="font-bold text-white">JavaScript Canvas</h3>
                    {role === 'student' && <button onClick={handleRunCode} className="px-4 py-1 bg-green-600 text-white text-sm font-semibold rounded hover:bg-green-500">Run Code</button>}
                </div>
                <textarea
                    value={studentCode}
                    onChange={handleCodeChange}
                    readOnly={role !== 'student'}
                    className="w-full h-full flex-grow bg-[#1e1e1e] text-white font-mono p-4 text-sm resize-none focus:outline-none"
                    placeholder="Write your JavaScript code here..."
                />
            </div>
            {/* Output and Video */}
            <div className="flex flex-col gap-4">
                <div className="bg-gray-900 rounded-lg flex flex-col flex-grow">
                    <div className="p-3 border-b border-gray-700"><h3 className="font-bold text-white">Output</h3></div>
                    <pre className="w-full h-full flex-grow bg-[#1e1e1e] text-gray-300 font-mono p-4 text-xs whitespace-pre-wrap overflow-auto">{output}</pre>
                </div>
                <div className="grid grid-cols-2 gap-4 h-40">
                    <div className="bg-black rounded-lg flex items-center justify-center relative">
                        <span className="font-semibold">{roomState?.interviewer?.name ?? 'Interviewer'}</span>
                        <div className="absolute bottom-1 left-1 bg-black/50 text-white px-1 py-0.5 text-xs rounded">Interviewer</div>
                    </div>
                    <div className="bg-black rounded-lg flex items-center justify-center relative">
                         <span className="font-semibold">{roomState?.student?.name ?? 'Waiting...'}</span>
                         <div className="absolute bottom-1 left-1 bg-black/50 text-white px-1 py-0.5 text-xs rounded">Student</div>
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <div className="h-full flex flex-col bg-gray-800/50 rounded-lg p-4 md:p-6 animate-fade-in">
             <div className="mb-4">
                <h1 className="text-3xl font-bold text-white">1-on-1 Interview Room</h1>
                <p className="mt-1 text-gray-400">A real-time, collaborative environment for technical interviews.</p>
             </div>
             {error && <p className="mb-4 text-center text-red-400 bg-red-900/50 p-3 rounded-lg">{error}</p>}
             <div className="flex-grow flex items-center justify-center">
                {inRoom ? <Room /> : <Lobby />}
             </div>
        </div>
    );
};

export default InterviewRoomPage;
