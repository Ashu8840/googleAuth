import React, { useState } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { subjects } from '../data/subjects';

const API_KEY = 'AIzaSyDuN41Uv5lhBALlQHo6pg2GZpbpE-ardck';

interface Question {
  question: string;
  options: string[];
  correctAnswerIndex: number;
}

interface TestState {
  status: 'idle' | 'loading' | 'active' | 'finished';
  questions: Question[];
  currentQuestionIndex: number;
  score: number;
  userAnswers: (number | null)[];
}

const MockTestsPage: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [testState, setTestState] = useState<TestState>({
    status: 'idle',
    questions: [],
    currentQuestionIndex: 0,
    score: 0,
    userAnswers: [],
  });
  const [error, setError] = useState<string | null>(null);

  const startTest = async (category: string) => {
    setSelectedCategory(category);
    setTestState({ ...testState, status: 'loading' });
    setError(null);

    try {
      const ai = new GoogleGenAI({ apiKey: API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Generate 5 unique multiple-choice questions about "${category}" for a technical job interview.`,
        config: {
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    questions: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                question: { type: Type.STRING },
                                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                                correctAnswerIndex: { type: Type.INTEGER }
                            },
                            required: ['question', 'options', 'correctAnswerIndex']
                        }
                    }
                }
            }
        }
      });
      
      const jsonResponse = JSON.parse(response.text);
      if (jsonResponse.questions && jsonResponse.questions.length > 0) {
        setTestState({
          status: 'active',
          questions: jsonResponse.questions,
          currentQuestionIndex: 0,
          score: 0,
          userAnswers: Array(jsonResponse.questions.length).fill(null),
        });
      } else {
        throw new Error("AI did not return any questions.");
      }
    } catch (e) {
      console.error("Failed to generate test:", e);
      setError(`Failed to generate a test for ${category}. Please try another topic.`);
      setTestState({ ...testState, status: 'idle' });
      setSelectedCategory(null);
    }
  };

  const handleAnswer = (optionIndex: number) => {
    const newAnswers = [...testState.userAnswers];
    newAnswers[testState.currentQuestionIndex] = optionIndex;
    
    const isCorrect = optionIndex === testState.questions[testState.currentQuestionIndex].correctAnswerIndex;

    setTestState({
      ...testState,
      userAnswers: newAnswers,
      score: isCorrect ? testState.score + 1 : testState.score,
    });

    setTimeout(() => {
      if (testState.currentQuestionIndex < testState.questions.length - 1) {
        setTestState(prevState => ({ ...prevState, currentQuestionIndex: prevState.currentQuestionIndex + 1 }));
      } else {
        setTestState(prevState => ({ ...prevState, status: 'finished' }));
      }
    }, 1000);
  };
  
  const resetTest = () => {
      setSelectedCategory(null);
      setTestState({
          status: 'idle',
          questions: [],
          currentQuestionIndex: 0,
          score: 0,
          userAnswers: [],
      });
  }

  if (testState.status === 'loading') {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-gray-800 rounded-lg p-8 animate-fade-in">
        <svg className="animate-spin h-10 w-10 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p className="mt-4 text-lg">Generating your test on {selectedCategory}...</p>
      </div>
    );
  }

  if (testState.status === 'active') {
    const question = testState.questions[testState.currentQuestionIndex];
    const userAnswer = testState.userAnswers[testState.currentQuestionIndex];
    return (
        <div className="h-full flex flex-col bg-gray-800 rounded-lg p-6 md:p-8 animate-fade-in-up">
            <div className="mb-6">
                <p className="text-sm text-blue-400 font-semibold">{selectedCategory} Test</p>
                <h2 className="text-2xl font-bold mt-1">{question.question}</h2>
                <p className="text-gray-400 mt-2">Question {testState.currentQuestionIndex + 1} of {testState.questions.length}</p>
            </div>
            <div className="space-y-4">
                {question.options.map((option, index) => {
                    const isSelected = userAnswer === index;
                    const isCorrect = question.correctAnswerIndex === index;
                    let buttonClass = 'bg-gray-700 hover:bg-gray-600';
                    if (isSelected) {
                        buttonClass = isCorrect ? 'bg-green-500' : 'bg-red-500';
                    }
                    return (
                        <button key={index} onClick={() => handleAnswer(index)} disabled={userAnswer !== null}
                            className={`w-full text-left p-4 rounded-lg transition-all duration-300 text-white font-medium text-lg ${buttonClass} ${userAnswer !== null ? 'cursor-not-allowed' : ''}`}>
                            {option}
                        </button>
                    );
                })}
            </div>
        </div>
    );
  }

  if (testState.status === 'finished') {
    return (
        <div className="h-full flex flex-col items-center justify-center bg-gray-800 rounded-lg p-8 text-center animate-fade-in">
            <h2 className="text-4xl font-bold text-white">Test Complete!</h2>
            <p className="text-xl text-gray-300 mt-2">You took the {selectedCategory} test.</p>
            <p className="text-6xl font-bold my-8 text-blue-400">{((testState.score / testState.questions.length) * 100).toFixed(0)}%</p>
            <p className="text-lg">You answered <span className="font-bold text-white">{testState.score}</span> out of <span className="font-bold text-white">{testState.questions.length}</span> questions correctly.</p>
            <button onClick={resetTest} className="mt-8 px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-500 transition-colors">
                Take Another Test
            </button>
        </div>
    );
  }

  return (
    <div className="h-full bg-gray-800 rounded-lg p-6 md:p-8 animate-fade-in">
      <h1 className="text-3xl font-bold text-white">Mock Tests</h1>
      <p className="mt-2 text-gray-400">Select a category to start a short, AI-generated quiz.</p>
      {error && <p className="mt-4 text-red-400 bg-red-900/50 p-3 rounded-lg">{error}</p>}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {subjects.map(subject => (
          <button key={subject.name} onClick={() => startTest(subject.name)}
            className="p-6 bg-gray-700 rounded-lg text-left hover:bg-blue-600 hover:scale-105 transition-all duration-200">
            <h3 className="font-bold text-xl text-white">{subject.name}</h3>
            <p className="text-gray-400 mt-1">{subject.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
};

export default MockTestsPage;
