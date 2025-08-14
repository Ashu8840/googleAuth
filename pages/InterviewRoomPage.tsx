import React, { useState, useEffect, useRef, useCallback } from 'react';
import { User } from '../types';

declare const io: any;

type Role = 'interviewer' | 'student';
type PageState = 'lobby' | 'waiting' | 'in-room' | 'error';

interface RoomState {
    interviewer: { id: string; name: string };
    student: { id: string; name: string } | null;
    code: string;
}

const VideoDisplay: React.FC<{ stream: MediaStream | null, name: string, role: string, isMuted: boolean }> = ({ stream, name, role, isMuted }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    useEffect(() => {
        if (videoRef.current && stream) {
            videoRef.current.srcObject = stream;
        }
    }, [stream]);

    return (
        <div className="bg-black rounded-lg flex flex-col items-center justify-center relative aspect-video w-full overflow-hidden shadow-lg">
            {stream ? (
                 <video ref={videoRef} autoPlay playsInline muted={isMuted} className="w-full h-full object-cover"></video>
            ) : (
                <div className="flex flex-col items-center text-gray-400">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <span className="font-semibold">{name}</span>
                </div>
            )}
             <div className="absolute top-2 left-2 bg-black/60 text-white px-2 py-1 text-xs rounded font-semibold">{role}</div>
        </div>
    );
};

const InterviewRoomPage: React.FC<{ user: User }> = ({ user }) => {
    const [pageState, setPageState] = useState<PageState>('lobby');
    const [error, setError] = useState<string | null>(null);
    const [role, setRole] = useState<Role | null>(null);
    const [roomCode, setRoomCode] = useState('');
    const [inputRoomCode, setInputRoomCode] = useState('');
    const [editorCode, setEditorCode] = useState('');
    const [output, setOutput] = useState('// Code output will appear here');
    
    // Use refs for objects that should not trigger re-renders
    const socketRef = useRef<any>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
    const codeChangeTimeoutRef = useRef<number | null>(null);
    
    // Use state for values that should trigger UI updates
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
    const [roomState, setRoomState] = useState<RoomState | null>(null);

    const handleLeaveRoom = useCallback(() => {
        socketRef.current?.emit('leave-interview-room');
        
        localStreamRef.current?.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
        setLocalStream(null);
        
        peerConnectionRef.current?.close();
        peerConnectionRef.current = null;
        setRemoteStream(null);
        
        setPageState('lobby');
        setRole(null);
        setRoomCode('');
        setRoomState(null);
        setError(null);
        setInputRoomCode('');
    }, []);

    // Effect for initializing and cleaning up the socket connection
    useEffect(() => {
        socketRef.current = io('https://googleauth-bu6c.onrender.com', { transports: ['websocket'] });
        
        navigator.mediaDevices.getUserMedia({ video: true, audio: true })
            .then(stream => {
                localStreamRef.current = stream;
                setLocalStream(stream);
            })
            .catch(err => {
                console.error("Error accessing media devices.", err);
                setError("Camera/mic access denied. Please enable permissions and refresh.");
                setPageState('error');
            });
            
        const socket = socketRef.current;
        socket.on('interview-room-created', (newRoomCode: string) => { setRoomCode(newRoomCode); setPageState('waiting'); });
        socket.on('code-updated', (newCode: string) => setEditorCode(newCode));
        socket.on('output-updated', (newOutput: string) => setOutput(newOutput));
        socket.on('partner-disconnected', () => {
             setError('The other participant has disconnected.');
             handleLeaveRoom();
        });
        socket.on('connect_error', () => { setError("Failed to connect to server."); setPageState('error'); });
        socket.on('error', (errorMessage: string) => { setError(errorMessage); setPageState('lobby'); setRoomCode(''); });

        return () => {
            handleLeaveRoom();
            socket.disconnect();
        };
    }, [handleLeaveRoom]);
    
    const setupPeerConnection = useCallback((peerId: string, isInitiator: boolean) => {
        if (!localStreamRef.current) return;
        
        const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
        peerConnectionRef.current = pc;
        
        localStreamRef.current.getTracks().forEach(track => pc.addTrack(track, localStreamRef.current!));

        pc.onicecandidate = event => {
            if (event.candidate) {
                socketRef.current?.emit('webrtc-signal', { to: peerId, signal: { type: 'candidate', candidate: event.candidate } });
            }
        };

        pc.ontrack = event => setRemoteStream(event.streams[0]);

        if (isInitiator) {
            pc.createOffer()
                .then(offer => pc.setLocalDescription(offer))
                .then(() => {
                    socketRef.current?.emit('webrtc-signal', { to: peerId, signal: { type: 'offer', sdp: pc.localDescription } });
                });
        }
    }, []);
    
    // Effect for handling WebRTC signaling and room readiness
    useEffect(() => {
        const socket = socketRef.current;
        if (!socket) return;
        
        const handleRoomReady = (data: { roomData: RoomState, roomCode: string }) => {
            setRoomCode(data.roomCode);
            setRoomState(data.roomData);
            setEditorCode(data.roomData.code);
            setPageState('in-room');
            setError(null);
            
            const partner = role === 'interviewer' ? data.roomData.student : data.roomData.interviewer;
            if (partner) {
                const isInitiator = role === 'interviewer';
                setupPeerConnection(partner.id, isInitiator);
            }
        };

        const handleWebrtcSignal = async (data: { from: string; signal: any }) => {
            let pc = peerConnectionRef.current;
            if (!pc) {
                setupPeerConnection(data.from, false);
                pc = peerConnectionRef.current;
            }
            if (!pc) return;

            if (data.signal.sdp) {
                await pc.setRemoteDescription(new RTCSessionDescription(data.signal.sdp));
                if (data.signal.type === 'offer') {
                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);
                    socket.emit('webrtc-signal', { to: data.from, signal: { type: 'answer', sdp: pc.localDescription } });
                }
            } else if (data.signal.candidate) {
                try { await pc.addIceCandidate(new RTCIceCandidate(data.signal.candidate)); } catch (e) { console.error('Error adding ICE candidate', e); }
            }
        };
        
        socket.on('interview-room-ready', handleRoomReady);
        socket.on('webrtc-signal', handleWebrtcSignal);

        return () => {
            socket.off('interview-room-ready', handleRoomReady);
            socket.off('webrtc-signal', handleWebrtcSignal);
        }
    }, [role, setupPeerConnection]);

    const handleCreateRoom = () => { setRole('interviewer'); socketRef.current.emit('create-interview-room', { userName: user.name }); };
    const handleJoinRoom = (e: React.FormEvent) => { e.preventDefault(); if (inputRoomCode.trim()) { setRole('student'); socketRef.current.emit('join-interview-room', { roomCode: inputRoomCode.trim().toUpperCase(), userName: user.name }); }};

    const handleCodeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newCode = e.target.value;
        setEditorCode(newCode); // Update local state immediately for responsiveness
        if (codeChangeTimeoutRef.current) clearTimeout(codeChangeTimeoutRef.current);
        codeChangeTimeoutRef.current = window.setTimeout(() => {
            socketRef.current.emit('code-change', { roomCode, newCode });
        }, 300);
    };

    const handleRunCode = () => {
        let logs: string[] = [];
        const oldLog = console.log;
        console.log = (...args) => logs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' '));
        try {
            new Function(editorCode)();
            const result = logs.length > 0 ? logs.join('\n') : '// Code ran successfully with no output.';
            setOutput(result);
            socketRef.current.emit('code-run', { roomCode, output: result });
        } catch (e: any) { 
            const errorResult = `Error: ${e.message}`;
            setOutput(errorResult);
            socketRef.current.emit('code-run', { roomCode, output: errorResult });
        }
        finally { console.log = oldLog; }
    };
    
    const renderContent = () => {
        switch (pageState) {
            case 'in-room':
                if (!roomState) return null;
                return (
                    <div className="h-full flex flex-col md:flex-row gap-4 animate-fade-in">
                        <div className="w-full md:w-1/2 lg:w-3/5 flex flex-col gap-4 min-h-0">
                             <div className="bg-gray-900 rounded-lg flex flex-col flex-1 min-h-0">
                                <div className="p-3 border-b border-gray-700 flex justify-between items-center flex-shrink-0">
                                    <h3 className="font-bold text-white">JavaScript Canvas</h3>
                                    {role === 'student' && <button onClick={handleRunCode} className="px-4 py-1 bg-green-600 text-white text-sm font-semibold rounded hover:bg-green-500">Run Code</button>}
                                </div>
                                <textarea value={editorCode} onChange={handleCodeChange} readOnly={role !== 'student'}
                                    className="w-full h-full flex-grow bg-[#1e1e1e] text-white font-mono p-4 text-sm resize-none focus:outline-none"
                                    placeholder="Write your JavaScript code here..."/>
                            </div>
                            <div className="bg-gray-900 rounded-lg flex flex-col h-1/3 min-h-[150px] flex-shrink-0">
                                <div className="p-3 border-b border-gray-700"><h3 className="font-bold text-white">Output</h3></div>
                                <pre className="w-full h-full flex-grow bg-[#1e1e1e] text-gray-300 font-mono p-4 text-xs whitespace-pre-wrap overflow-auto">{output}</pre>
                            </div>
                        </div>
                        <div className="w-full md:w-1/2 lg:w-2/5 flex flex-col justify-center items-center gap-4">
                            <VideoDisplay stream={role === 'interviewer' ? localStream : remoteStream} name={roomState.interviewer.name} role="Interviewer" isMuted={role === 'interviewer'} />
                            <VideoDisplay stream={role === 'student' ? localStream : remoteStream} name={roomState.student?.name ?? 'Waiting...'} role="Student" isMuted={role === 'student'} />
                             <button onClick={handleLeaveRoom} className="w-full mt-2 px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-500 transition-colors">End Interview</button>
                        </div>
                    </div>
                );
            case 'waiting':
                return (
                    <div className="text-center">
                        <h2 className="text-2xl font-bold">Room Code: <span className="text-blue-400 font-mono tracking-widest">{roomCode}</span></h2>
                        <p className="mt-4 text-gray-400">Share this code with the student to have them join.</p>
                        <div className="mt-8 flex justify-center items-center gap-3">
                            <svg className="animate-spin h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            Waiting for student to join...
                        </div>
                        <button onClick={handleLeaveRoom} className="mt-8 px-6 py-2 bg-gray-600 rounded-lg hover:bg-gray-500">Cancel</button>
                    </div>
                );
            case 'error':
            case 'lobby':
            default:
                return (
                    <div className="w-full max-w-lg mx-auto animate-fade-in-up">
                         <div className="bg-gray-800 p-8 rounded-lg shadow-xl mb-6">
                             <h2 className="text-2xl font-bold text-white text-center">Interviewer</h2>
                             <p className="text-gray-400 text-center mt-2">Create a private room to conduct a 1-on-1 interview.</p>
                             <button onClick={handleCreateRoom} className="w-full mt-4 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-500 transition-colors" disabled={!localStream}>Create Interview Room</button>
                         </div>
                         <div className="bg-gray-800 p-8 rounded-lg shadow-xl">
                            <h2 className="text-2xl font-bold text-white text-center">Student</h2>
                             <p className="text-gray-400 text-center mt-2">Join an interview room with a code from an interviewer.</p>
                            <form onSubmit={handleJoinRoom} className="mt-4 space-y-4">
                                <input type="text" placeholder="ENTER ROOM CODE" value={inputRoomCode} onChange={e => setInputRoomCode(e.target.value)}
                                    className="w-full text-center tracking-widest font-mono bg-gray-700 text-white p-3 rounded-md border border-gray-600 focus:ring-2 focus:ring-blue-500 focus:outline-none"/>
                                <button type="submit" className="w-full py-3 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-500 transition-colors" disabled={!localStream}>Join as Student</button>
                            </form>
                         </div>
                    </div>
                );
        }
    }

    return (
        <div className="h-full flex flex-col bg-gray-900/50 rounded-lg p-2 md:p-6">
             <div className="mb-4 flex-shrink-0">
                <h1 className="text-2xl md:text-3xl font-bold text-white">1-on-1 Interview Room</h1>
                <p className="mt-1 text-gray-400 text-sm md:text-base">A real-time, collaborative environment for technical interviews.</p>
             </div>
             {error && <p className="mb-4 text-center text-red-400 bg-red-900/50 p-3 rounded-lg animate-fade-in">{error}</p>}
             <div className="flex-grow flex items-center justify-center min-h-0">
                {renderContent()}
             </div>
        </div>
    );
};

export default InterviewRoomPage;
