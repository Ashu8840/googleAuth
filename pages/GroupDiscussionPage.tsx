import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from '@google/genai';
import { marked } from 'marked';

const API_KEY = 'AIzaSyDuN41Uv5lhBALlQHo6pg2GZpbpE-ardck';

const GroupDiscussionPage: React.FC = () => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isMuted, setIsMuted] = useState(false);
    const [isCameraOff, setIsCameraOff] = useState(false);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [permissionError, setPermissionError] = useState<string | null>(null);
    const [discussionTopic, setDiscussionTopic] = useState('Scalability in System Design');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [aiSummary, setAiSummary] = useState('');
    const [isLoadingSummary, setIsLoadingSummary] = useState(false);


    useEffect(() => {
        const getMedia = async () => {
            try {
                const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                setStream(mediaStream);
                if (videoRef.current) {
                    videoRef.current.srcObject = mediaStream;
                }
            } catch (err) {
                console.error("Error accessing media devices.", err);
                setPermissionError("Camera and microphone access denied. Please enable permissions in your browser settings to use this feature.");
            }
        };
        getMedia();
        return () => {
            stream?.getTracks().forEach(track => track.stop());
        };
    }, []);

    const toggleMute = () => {
        if (stream) {
            stream.getAudioTracks().forEach(track => track.enabled = !track.enabled);
            setIsMuted(!isMuted);
        }
    };

    const toggleCamera = () => {
        if (stream) {
            stream.getVideoTracks().forEach(track => track.enabled = !track.enabled);
            setIsCameraOff(!isCameraOff);
        }
    };
    
    const getAiSummary = async () => {
        setIsModalOpen(true);
        setIsLoadingSummary(true);
        setAiSummary('');
        try {
            const ai = new GoogleGenAI({ apiKey: API_KEY });
            const prompt = `
                Act as an expert interviewer providing feedback for a group discussion practice session.
                The topic was: "${discussionTopic}".
                Assume the user just participated in a 10-minute discussion.
                Provide a summary of what key points should have been discussed.
                Then, give constructive feedback in the following areas:
                1.  **Clarity and Communication:** How to articulate points clearly.
                2.  **Technical Depth:** What advanced concepts could be mentioned.
                3.  **Collaborative Spirit:** Tips on how to engage with others, build on ideas, and manage disagreements professionally.

                Format your response in Markdown. Use headings, bold text, and bullet points for readability.
            `;
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
            });
            const htmlContent = await marked.parse(response.text);
            setAiSummary(htmlContent);
        } catch (error) {
            console.error(error);
            setAiSummary("<p class='text-red-400'>Failed to get AI summary. Please check your API key and try again.</p>");
        } finally {
            setIsLoadingSummary(false);
        }
    };

    return (
        <div className="h-full flex flex-col bg-gray-800 rounded-lg p-4 md:p-6 animate-fade-in">
            <div className="mb-4">
                <h1 className="text-3xl font-bold text-white">Group Discussion Practice</h1>
                <p className="mt-1 text-gray-400">Simulate a real GD. When you're done, get AI feedback.</p>
            </div>
            <div className="flex-grow bg-black rounded-lg relative flex items-center justify-center">
                {permissionError ? (
                    <div className="p-8 text-center text-red-400">
                        <h3 className="text-xl font-bold">Permissions Required</h3>
                        <p className="mt-2">{permissionError}</p>
                    </div>
                ) : (
                    <video ref={videoRef} autoPlay muted className={`h-full w-full object-cover rounded-lg ${isCameraOff ? 'invisible' : 'visible'}`}></video>
                )}
                 {isCameraOff && !permissionError && (
                    <div className="absolute flex flex-col items-center text-gray-400">
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-24 w-24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                         </svg>
                        <p className="mt-4 text-lg">Camera is off</p>
                    </div>
                )}
            </div>
            <div className="mt-4 p-4 bg-gray-900 rounded-lg flex items-center justify-between flex-wrap gap-4">
                <div className="flex-grow">
                     <label htmlFor="topic" className="text-sm font-medium text-gray-400">Discussion Topic:</label>
                     <input id="topic" type="text" value={discussionTopic} onChange={(e) => setDiscussionTopic(e.target.value)}
                        className="w-full mt-1 bg-gray-700 text-white p-2 rounded-md border border-gray-600 focus:ring-2 focus:ring-blue-500 focus:outline-none"/>
                </div>
                <div className="flex items-center gap-4">
                    <button onClick={toggleMute} className={`p-3 rounded-full transition-colors ${isMuted ? 'bg-red-600' : 'bg-gray-600 hover:bg-gray-500'}`}>
                        {isMuted ? 
                            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7.5 7.5 0 01-7.5 7.5M12 21a7.5 7.5 0 01-7.5-7.5m15 0a.5.5 0 00-.5-.5H3.5a.5.5 0 000 1h17a.5.5 0 00.5-.5zM3 3l18 18" /></svg> :
                            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7.5 7.5 0 01-7.5 7.5M12 21a7.5 7.5 0 01-7.5-7.5m7.5-9v-.5a3.5 3.5 0 10-7 0V11" /></svg>
                        }
                    </button>
                    <button onClick={toggleCamera} className={`p-3 rounded-full transition-colors ${isCameraOff ? 'bg-red-600' : 'bg-gray-600 hover:bg-gray-500'}`}>
                         {isCameraOff ?
                            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2zM1 1l22 22" /></svg> :
                            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                        }
                    </button>
                    <button onClick={getAiSummary} disabled={!discussionTopic}
                        className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-500 transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed">
                        Get AI Summary
                    </button>
                </div>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50 animate-fade-in">
                    <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                        <div className="p-4 border-b border-gray-700 flex justify-between items-center">
                            <h2 className="text-xl font-bold">AI Analyst Feedback</h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white">&times;</button>
                        </div>
                        <div className="p-6 overflow-y-auto prose prose-invert max-w-none">
                            {isLoadingSummary ? (
                                <div className="flex items-center justify-center">
                                    <svg className="animate-spin mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                    <span>Generating feedback...</span>
                                </div>
                            ) : (
                                <div dangerouslySetInnerHTML={{ __html: aiSummary }} />
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GroupDiscussionPage;