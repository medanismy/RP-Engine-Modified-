import React, { useState } from 'react';
import SetupForm from './components/SetupForm';
import ChatInterface from './components/ChatInterface';
import { RoleplayConfig, AppState, Message } from './types';
import { initializeChat } from './services/geminiService';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.SETUP);
  const [config, setConfig] = useState<RoleplayConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [initialResponse, setInitialResponse] = useState<string>('');
  const [chatHistory, setChatHistory] = useState<Message[] | undefined>(undefined);

  const handleStartRoleplay = async (newConfig: RoleplayConfig, history?: Message[]) => {
    setIsLoading(true);
    setConfig(newConfig);
    setChatHistory(history);

    try {
      const response = await initializeChat(newConfig, history);
      
      // If history exists, response is a status code, otherwise it's the model's intro
      if (!history || history.length === 0) {
          setInitialResponse(response);
      }
      
      setAppState(AppState.ROLEPLAY);
    } catch (error) {
      alert("Failed to initialize the Roleplay Engine. Please check your API key and connection.");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    // Confirmation is now handled in the UI component to avoid blocking alerts
    setAppState(AppState.SETUP);
    setConfig(null);
    setInitialResponse('');
    setChatHistory(undefined);
  };

  return (
    <div className="min-h-screen bg-rp-900 text-rp-text font-sans selection:bg-rp-accent selection:text-white">
      {appState === AppState.SETUP ? (
        <SetupForm onStart={handleStartRoleplay} isLoading={isLoading} />
      ) : (
        config && (
          <ChatInterface 
            initialMessage={initialResponse} 
            config={config} 
            initialHistory={chatHistory}
            onReset={handleReset} 
          />
        )
      )}
    </div>
  );
};

export default App;