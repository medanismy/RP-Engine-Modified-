import React, { useState, useEffect, useRef } from 'react';
import { Message, RoleplayConfig, RoleplaySession } from '../types';
import { sendMessageStream, reloadSession, initializeChat } from '../services/geminiService';

interface ChatInterfaceProps {
  initialMessage: string;
  config: RoleplayConfig;
  initialHistory?: Message[];
  onReset: () => void;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ initialMessage, config, initialHistory, onReset }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  // Edit State
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const editInputRef = useRef<HTMLTextAreaElement>(null);

  // Initialize messages state
  useEffect(() => {
    if (initialHistory && initialHistory.length > 0) {
        // CLEANUP: Filter out system errors and reset thinking states from backup
        const cleanHistory = initialHistory.filter(m => 
            m.text && 
            !m.text.startsWith('[System Error') && 
            m.text.trim().length > 0
        ).map(m => ({ ...m, isThinking: false })); 
        
        setMessages(cleanHistory);
    } else {
        if (initialMessage) {
            setMessages([{ role: 'model', text: initialMessage, timestamp: Date.now() }]);
        } else {
            setMessages([]);
        }
    }
  }, [initialMessage, initialHistory]);

  const scrollToBottom = () => {
    if (!editingId) {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isStreaming]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  
  // Focus edit input when edit mode starts
  useEffect(() => {
    if (editingId && editInputRef.current) {
        editInputRef.current.focus();
        editInputRef.current.style.height = 'auto';
        editInputRef.current.style.height = editInputRef.current.scrollHeight + 'px';
    }
  }, [editingId]);

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return;

    const userMsg: Message = { role: 'user', text: input.trim(), timestamp: Date.now() };
    
    // Optimistic UI update
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsStreaming(true);

    const modelMsgId = Date.now() + 1;
    // Add placeholder immediately
    setMessages(prev => [...prev, { role: 'model', text: '', timestamp: modelMsgId, isThinking: true }]);

    try {
      // Auto-repair: Filter out system errors from history before sending
      // IMPORTANT: We use 'messages' here, which is the state BEFORE userMsg was added (React state update is async)
      let validHistory = messages.filter(m => m.text && !m.text.startsWith('[System Error') && m.text.trim() !== '');
      
      // CRITICAL FIX: If the history ends with a 'user' message, it means the previous turn was incomplete 
      // (e.g., model error). We MUST remove that dangling user message from the context we send to the AI,
      // otherwise we send [User, User] sequence which causes "Empty response" or API errors.
      if (validHistory.length > 0 && validHistory[validHistory.length - 1].role === 'user') {
          validHistory = validHistory.slice(0, -1);
      }

      // If we have history, ensure session is synced
      if (validHistory.length > 0) {
          await reloadSession(config, validHistory);
      } else {
          // If history is empty (first msg), ensure init
          await initializeChat(config, []);
      }

      const stream = sendMessageStream(userMsg.text);
      let fullText = '';
      
      for await (const chunk of stream) {
        fullText += chunk;
        setMessages(prev => prev.map(msg => 
            msg.timestamp === modelMsgId 
            ? { ...msg, text: fullText, isThinking: false } 
            : msg
        ));
      }

      if (!fullText) {
          throw new Error("The model returned an empty response.");
      }
    } catch (error: any) {
      console.error("Chat error:", error);
      const errorMessage = error?.message || "Connection interrupted";
      setMessages(prev => prev.map(msg => 
          msg.timestamp === modelMsgId 
          ? { ...msg, text: `[System Error: ${errorMessage}. Please try regenerating.]`, isThinking: false } 
          : msg
      ));
    } finally {
      setIsStreaming(false);
      setMessages(prev => prev.map(msg => 
        msg.isThinking ? { ...msg, isThinking: false } : msg
      ));
    }
  };

  const handleRegenerate = async () => {
      if (isStreaming || messages.length === 0) return;

      const lastMsg = messages[messages.length - 1];
      if (lastMsg.role !== 'model') return;

      // 1. Determine new state by removing the last model message
      const historyWithoutLast = messages.slice(0, -1);
      
      setIsStreaming(true);
      
      // Update UI immediately to remove the old message
      setMessages(historyWithoutLast);

      let modelMsgId = Date.now();

      try {
          // Scenario A: It was a response to a user message
          // The last message in historyWithoutLast should be the user message that triggered the response
          const lastUserMsg = historyWithoutLast[historyWithoutLast.length - 1];

          if (lastUserMsg && lastUserMsg.role === 'user') {
               // We need to reload the session with history UP TO that user message (excluding the user message itself)
               // This ensures the session ends with a MODEL message (or empty)
               const historyBeforeUser = historyWithoutLast.slice(0, -1);
               
               // Ensure we don't pass a dangling user message if historyBeforeUser is somehow malformed
               const validHistory = historyBeforeUser.filter(m => !m.text.startsWith('[System Error'));
               
               await reloadSession(config, validHistory);
               
               // Create placeholder for new response
               modelMsgId = Date.now();
               setMessages(prev => [...prev, { role: 'model', text: '', timestamp: modelMsgId, isThinking: true }]);
               
               const stream = sendMessageStream(lastUserMsg.text);
               let fullText = '';
               for await (const chunk of stream) {
                  fullText += chunk;
                  setMessages(prev => prev.map(msg => 
                      msg.timestamp === modelMsgId 
                      ? { ...msg, text: fullText, isThinking: false } 
                      : msg
                  ));
               }

               if (!fullText) throw new Error("Empty response during regeneration.");
          } 
          // Scenario B: It was the very first message (Intro)
          else if (historyWithoutLast.length === 0) {
               // Re-initialize to get a new intro
               const newIntro = await initializeChat(config, []);
               setMessages([{ role: 'model', text: newIntro, timestamp: Date.now() }]);
          }

      } catch (error: any) {
          console.error("Regeneration error:", error);
          const errorMessage = error?.message || "Failed to regenerate";
          
          setMessages(prev => {
              const exists = prev.some(m => m.timestamp === modelMsgId);
              if (exists) {
                  return prev.map(msg => 
                      msg.timestamp === modelMsgId 
                      ? { ...msg, text: `[System Error: ${errorMessage}]`, isThinking: false } 
                      : msg
                  );
              } else {
                  return [...prev, { role: 'model', text: `[System Error: ${errorMessage}]`, timestamp: Date.now(), isThinking: false }];
              }
          });
      } finally {
          setIsStreaming(false);
          setMessages(prev => prev.map(msg => 
            msg.isThinking ? { ...msg, isThinking: false } : msg
          ));
      }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleEndSession = () => {
    if (confirmEnd) {
        onReset();
    } else {
        setConfirmEnd(true);
        setTimeout(() => setConfirmEnd(false), 3000);
    }
  };

  const handleExportBackup = () => {
      // Filter out system errors from backup
      const cleanHistory = messages.filter(m => !m.text.startsWith('[System Error'));
      
      const backup: RoleplaySession = {
          config: config,
          history: cleanHistory,
          savedAt: new Date().toISOString()
      };
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backup, null, 2));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", dataStr);
      const safeName = config.character.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      downloadAnchorNode.setAttribute("download", `${safeName}_backup_${new Date().toISOString().slice(0,10)}.json`);
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
      setShowSettings(false);
  };

  // --- EDIT FUNCTIONS ---

  const startEdit = (msg: Message) => {
      setEditingId(msg.timestamp);
      setEditContent(msg.text);
  };

  const cancelEdit = () => {
      setEditingId(null);
      setEditContent('');
  };

  const saveEdit = async (timestamp: number) => {
      setIsSyncing(true);
      try {
          const updatedMessages = messages.map(msg => 
              msg.timestamp === timestamp ? { ...msg, text: editContent } : msg
          );
          
          setMessages(updatedMessages);
          await reloadSession(config, updatedMessages);
          setEditingId(null);
          setEditContent('');
      } catch (e) {
          console.error("Failed to sync edited history:", e);
          alert("Failed to update AI context. Changes saved locally.");
      } finally {
          setIsSyncing(false);
      }
  };

  return (
    <div className="flex flex-col h-screen bg-rp-900 overflow-hidden relative">
      
      {/* Settings Modal */}
      {showSettings && (
          <div className="absolute inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center animate-fade-in p-4">
              <div className="bg-rp-800 border border-rp-600 rounded-xl p-6 max-w-sm w-full shadow-2xl">
                  <h3 className="text-xl font-bold text-white mb-4">Session Settings</h3>
                  <div className="space-y-3">
                      <button 
                        onClick={handleExportBackup}
                        className="w-full flex items-center gap-3 p-3 bg-rp-700 hover:bg-rp-600 rounded-lg text-rp-text transition-colors"
                      >
                           <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                           </svg>
                           <div>
                               <div className="font-semibold">Save Backup</div>
                               <div className="text-xs text-rp-muted">Download chat history + config</div>
                           </div>
                      </button>
                      <button 
                        onClick={() => setShowSettings(false)}
                        className="w-full p-2 text-center text-rp-muted hover:text-white mt-2"
                      >
                          Close
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Header */}
      <header className="flex-none bg-rp-800 border-b border-rp-700 p-3 md:p-4 shadow-md z-10 flex justify-between items-center gap-2">
        <div className="min-w-0">
            <h2 className="text-base md:text-lg font-bold text-white truncate">{config.scenario.description}</h2>
            <p className="text-[10px] md:text-xs text-rp-muted truncate">{config.character.name} & {config.userCharacter.name}</p>
        </div>
        
        <div className="flex items-center gap-2">
             <button
                onClick={() => setShowSettings(true)}
                className="p-2 text-rp-muted hover:text-white bg-rp-700/50 hover:bg-rp-600 rounded-full transition-colors"
                title="Settings"
             >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.212 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
             </button>
            <button 
                onClick={handleEndSession}
                className={`flex-none text-xs px-3 py-2 md:px-4 md:py-2 rounded transition-all font-medium ${
                    confirmEnd 
                    ? 'bg-red-600 text-white animate-pulse' 
                    : 'bg-rp-700 hover:bg-red-900/50 text-rp-muted hover:text-red-200'
                }`}
            >
                {confirmEnd ? 'Confirm End?' : 'End'}
            </button>
        </div>
      </header>

      {/* Messages Area */}
      <main className="flex-1 overflow-y-auto p-3 md:p-6 space-y-4 md:space-y-6 custom-scrollbar">
        {messages.map((msg, idx) => {
            // Check if this is the last message (and it's from the model) to show persistent Regenerate button
            const isLastMessage = idx === messages.length - 1;
            const isModelMessage = msg.role === 'model';
            
            return (
              <div 
                key={msg.timestamp} 
                className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'} group`}
              >
                <div 
                    className={`
                        relative max-w-[90%] md:max-w-[75%] rounded-2xl p-3 md:p-6 shadow-xl leading-relaxed whitespace-pre-wrap text-sm md:text-base
                        ${msg.role === 'user' 
                            ? 'bg-rp-600 text-rp-text rounded-tr-none border border-rp-500' 
                            : 'bg-rp-800 text-rp-text rounded-tl-none border border-rp-700'
                        }
                        ${editingId === msg.timestamp ? 'w-full md:max-w-[85%]' : ''}
                    `}
                >
                    {editingId === msg.timestamp ? (
                        <div className="animate-fade-in w-full">
                            <textarea
                                ref={editInputRef}
                                value={editContent}
                                onChange={(e) => setEditContent(e.target.value)}
                                className="w-full bg-rp-900/50 text-rp-text p-2 rounded border border-rp-500 outline-none focus:ring-1 focus:ring-rp-accent resize-none overflow-hidden"
                                style={{ minHeight: '80px' }}
                                disabled={isSyncing}
                            />
                            <div className="flex gap-2 mt-2 justify-end">
                                <button 
                                    onClick={cancelEdit} 
                                    disabled={isSyncing}
                                    className="px-3 py-1 rounded bg-rp-700 hover:bg-rp-600 text-xs text-red-300 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button 
                                    onClick={() => saveEdit(msg.timestamp)}
                                    disabled={isSyncing} 
                                    className="px-3 py-1 rounded bg-rp-accent hover:bg-rp-accentHover text-xs text-white transition-colors flex items-center gap-1"
                                >
                                    {isSyncing ? (
                                        <span className="animate-spin h-3 w-3 border-2 border-white border-t-transparent rounded-full"></span>
                                    ) : (
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                        </svg>
                                    )}
                                    Save
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Thinking Indicator */}
                            {msg.isThinking && msg.text === '' && (
                                <div className="flex items-center space-x-2 text-rp-muted text-sm italic">
                                    <span className="w-2 h-2 bg-rp-accent rounded-full animate-bounce"></span>
                                    <span className="w-2 h-2 bg-rp-accent rounded-full animate-bounce delay-100"></span>
                                    <span className="w-2 h-2 bg-rp-accent rounded-full animate-bounce delay-200"></span>
                                    <span>Reasoning...</span>
                                </div>
                            )}
                            
                            {/* Content */}
                            <div className={msg.role === 'model' ? 'prose prose-invert prose-sm md:prose-base max-w-none' : ''}>
                                {msg.text}
                            </div>
                            
                            {/* Action Buttons (Visible on Hover or if Last Message) */}
                            {!msg.isThinking && !isStreaming && (
                                <div className={`absolute -top-3 right-0 flex gap-1 transition-opacity ${isLastMessage ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                                    {/* Edit Button */}
                                    <button 
                                        onClick={() => startEdit(msg)}
                                        className="p-1.5 bg-rp-700 text-rp-muted hover:text-white rounded-full shadow-lg border border-rp-600 hover:scale-110"
                                        title="Edit Message"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                                        </svg>
                                    </button>
                                </div>
                            )}
                            
                            {/* Meta */}
                            <div className={`text-[10px] mt-2 opacity-50 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                                {msg.role === 'user' ? config.userCharacter.name : config.character.name}
                            </div>
                        </>
                    )}
                </div>
              </div>
            );
        })}
        <div ref={messagesEndRef} />
      </main>

      {/* Input Area */}
      <footer className="flex-none bg-rp-800 border-t border-rp-700 p-3 pb-safe md:p-4">
        <div className="max-w-4xl mx-auto relative">
            {/* NEW REGENERATE BUTTON: Visible above input if last msg is from Model */}
            {!isStreaming && messages.length > 0 && messages[messages.length - 1].role === 'model' && !messages[messages.length - 1].isThinking && (
                 <div className="absolute right-0 -top-10">
                    <button
                        onClick={handleRegenerate}
                        className="flex items-center gap-2 text-xs text-rp-muted hover:text-white bg-rp-800 border border-rp-600 hover:border-rp-accent rounded-full px-3 py-1 shadow-lg transition-all"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                        </svg>
                        Regenerate Response
                    </button>
                 </div>
            )}
            
            <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Speak as ${config.userCharacter.name}...`}
                disabled={isStreaming || editingId !== null}
                className="w-full bg-rp-900 text-rp-text rounded-xl border border-rp-600 p-3 pr-12 focus:outline-none focus:border-rp-accent focus:ring-1 focus:ring-rp-accent resize-none h-14 md:h-24 transition-all disabled:opacity-50 text-base"
            />
            <button
                onClick={handleSend}
                disabled={!input.trim() || isStreaming || editingId !== null}
                className="absolute right-2 bottom-2 md:right-3 md:bottom-7 p-2 bg-rp-accent hover:bg-rp-accentHover text-white rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 active:scale-95 touch-manipulation"
            >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
            </button>
        </div>
        <div className="text-center mt-2 text-[10px] md:text-xs text-rp-muted hidden md:block">
            Shift + Enter for new line. /break to pause roleplay.
        </div>
      </footer>
    </div>
  );
};

export default ChatInterface;