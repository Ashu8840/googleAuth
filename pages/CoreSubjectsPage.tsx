
import React, { useState } from 'react';
import { subjects } from '../data/subjects';
import AIGeneratedContent from '../components/AIGeneratedContent';

const CoreSubjectsPage: React.FC = () => {
  const [selectedTopic, setSelectedTopic] = useState<string>('');

  return (
    <div className="flex flex-col lg:flex-row h-full bg-gray-800 rounded-lg overflow-hidden">
      {/* Topics Column */}
      <div className="w-full lg:w-1/3 border-b lg:border-b-0 lg:border-r border-gray-700 flex flex-col">
          <div className="p-4 border-b border-gray-700">
             <h2 className="text-xl font-bold text-white">Core Topics</h2>
             <p className="text-sm text-gray-400">Select a topic to begin</p>
          </div>
          <div className="flex-grow overflow-y-auto max-h-60 lg:max-h-full">
            {subjects.map((subject) => (
                <div key={subject.name} className="p-4">
                    <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">{subject.name}</h3>
                    <ul>
                        {subject.topics.map((topic) => (
                            <li key={topic}>
                                <button
                                    onClick={() => setSelectedTopic(topic)}
                                    className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors duration-200 flex items-center justify-between ${
                                        selectedTopic === topic
                                        ? 'bg-blue-600 text-white'
                                        : 'text-gray-300 hover:bg-gray-700'
                                    }`}
                                >
                                    {topic}
                                    {selectedTopic === topic && (
                                        <span className="w-2 h-2 bg-white rounded-full animate-fade-in"></span>
                                    )}
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            ))}
          </div>
      </div>

      {/* AI Content Column */}
      <main className="w-full lg:w-2/3 flex flex-col">
         <div className="flex-grow overflow-y-auto p-6 md:p-8">
            <div className="prose prose-invert max-w-none">
                 <style>{`
                    .prose h1, .prose h2, .prose h3, .prose h4, .prose h5, .prose h6 { color: white; }
                    .prose p, .prose ul, .prose ol, .prose li { color: #d1d5db; line-height: 1.7; }
                    .prose strong { color: white; }
                    .prose a { color: #93c5fd; text-decoration: none; }
                    .prose a:hover { color: #60a5fa; text-decoration: underline; }
                    .prose blockquote { color: #9ca3af; border-left-color: #4b5563; font-style: italic; padding-left: 1em; }
                    .prose pre { background-color: #111827; color: #e5e7eb; padding: 1em; border-radius: 0.5rem; overflow-x: auto; }
                    .prose code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }
                    .prose code:not(pre > code) { background-color: #374151; padding: 0.2em 0.4em; border-radius: 0.25rem; }
                 `}</style>
                <AIGeneratedContent topic={selectedTopic} />
            </div>
         </div>
      </main>
    </div>
  );
};

export default CoreSubjectsPage;
