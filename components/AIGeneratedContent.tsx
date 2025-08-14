import React, { useState, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { marked } from 'marked';

interface AIGeneratedContentProps {
  topic: string;
}

const AIGeneratedContent: React.FC<AIGeneratedContentProps> = ({ topic }) => {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!topic) return;

    const fetchContent = async () => {
      setLoading(true);
      setError(null);
      setContent('');

      if (!process.env.API_KEY) {
        setError("API key is not configured. Please set the API_KEY environment variable.");
        setLoading(false);
        return;
      }

      try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const prompt = `
          Explain the topic "${topic}" for a computer science job interview.
          Your audience is a CS student preparing for a technical role.
          Please cover the following:
          1.  A clear and concise definition.
          2.  Key concepts and core principles.
          3.  Common use-cases or real-world examples.
          4.  Important trade-offs (time/space complexity, advantages/disadvantages).
          5.  A simple code example in JavaScript, if applicable.
          
          Format your response using Markdown, including headings, bold text, lists, and code blocks.
        `;

        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
        });

        const rawText = response.text;
        const htmlContent = await marked.parse(rawText);
        setContent(htmlContent);
      } catch (e) {
        console.error('Error fetching AI content:', e);
        setError('Failed to load content from AI. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchContent();
  }, [topic]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 text-gray-400">
        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span>Generating explanation for {topic}...</span>
      </div>
    );
  }

  if (error) {
    return <div className="p-8 text-red-400 bg-red-900/20 rounded-lg">{error}</div>;
  }

  if (!content && !loading) {
     return (
        <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 p-8">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.657 7.343A8 8 0 0118 18c.333.667.667 1.333 1 2h-1.343c-.333-.667-.667-1.333-1-2zM6 18a9.992 9.992 0 0110-10" />
            </svg>
            <h3 className="text-xl font-semibold text-gray-300">Welcome to the Study Zone</h3>
            <p>Select a topic from the list to get an AI-generated explanation tailored for interviews.</p>
        </div>
     );
  }

  return (
    <div
      className="animate-fade-in"
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
};

export default AIGeneratedContent;
