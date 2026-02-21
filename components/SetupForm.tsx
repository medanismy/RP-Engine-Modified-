import React, { useState, useEffect, useRef } from 'react';
import { RoleplayConfig, RoleplaySession, Message } from '../types';

interface SetupFormProps {
  onStart: (config: RoleplayConfig, history?: Message[]) => void;
  isLoading: boolean;
}

const LOCAL_STORAGE_KEY = 'rp_engine_presets';

const SetupForm: React.FC<SetupFormProps> = ({ onStart, isLoading }) => {
  const [activeTab, setActiveTab] = useState<'character' | 'scenario' | 'user' | 'advanced'>('character');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // State for presets
  const [presets, setPresets] = useState<Record<string, RoleplayConfig>>({});
  const [selectedPreset, setSelectedPreset] = useState<string>('');
  const [newPresetName, setNewPresetName] = useState('');
  const [showSaveUI, setShowSaveUI] = useState(false);
  const [loadedHistory, setLoadedHistory] = useState<Message[] | undefined>(undefined);
  const [importStatus, setImportStatus] = useState<string>('');

  const [config, setConfig] = useState<RoleplayConfig>({
    character: {
      name: '',
      personality: '',
      appearance: '',
      backstory: '',
      motivations: '',
      behaviorPatterns: '',
      speechStyle: '',
    },
    scenario: {
      description: '',
      setting: '',
      eraGenre: '',
      tone: '',
      context: '',
      example: '',
      notes: '',
    },
    userCharacter: {
      name: '',
      personality: '',
      appearance: '',
      relationshipToScenario: '',
      relationshipsToOthers: '',
    },
    customSystemInstruction: '',
    firstMessage: ''
  });

  useEffect(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
        try {
            setPresets(JSON.parse(saved));
        } catch (e) {
            console.error("Failed to load presets", e);
        }
    }
  }, []);

  const handleCharChange = (field: keyof typeof config.character, value: string) => {
    setConfig(prev => ({ ...prev, character: { ...prev.character, [field]: value } }));
    setLoadedHistory(undefined); // Clear history if user modifies config manually
    setImportStatus('');
  };

  const handleScenarioChange = (field: keyof typeof config.scenario, value: string) => {
    setConfig(prev => ({ ...prev, scenario: { ...prev.scenario, [field]: value } }));
    setLoadedHistory(undefined);
    setImportStatus('');
  };

  const handleUserCharChange = (field: keyof typeof config.userCharacter, value: string) => {
    setConfig(prev => ({ ...prev, userCharacter: { ...prev.userCharacter, [field]: value } }));
    setLoadedHistory(undefined);
    setImportStatus('');
  };

  const handleAdvancedChange = (field: 'customSystemInstruction' | 'firstMessage', value: string) => {
    setConfig(prev => ({ ...prev, [field]: value }));
    setLoadedHistory(undefined);
    setImportStatus('');
  };

  // --- PRESET MANAGEMENT ---

  const saveToLocalStorage = (updatedPresets: Record<string, RoleplayConfig>) => {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedPresets));
    setPresets(updatedPresets);
  };

  const handleSavePreset = () => {
    if (!newPresetName.trim()) return;
    const updated = { ...presets, [newPresetName]: config };
    saveToLocalStorage(updated);
    setSelectedPreset(newPresetName);
    setNewPresetName('');
    setShowSaveUI(false);
  };

  const handleLoadPreset = (name: string) => {
    if (presets[name]) {
        setConfig(presets[name]);
        setSelectedPreset(name);
        setLoadedHistory(undefined);
        setImportStatus('');
    }
  };

  const handleDeletePreset = () => {
    if (!selectedPreset) return;
    const updated = { ...presets };
    delete updated[selectedPreset];
    saveToLocalStorage(updated);
    setSelectedPreset('');
  };

  // --- IMPORT LOGIC ---

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const json = JSON.parse(event.target?.result as string);
            
            // Check if it's a full session backup or just a config
            if (json.history && Array.isArray(json.history) && json.config) {
                // It is a RoleplaySession
                setConfig(json.config);
                setLoadedHistory(json.history);
                setImportStatus(`Loaded backup: ${json.history.length} messages found.`);
            } else if (json.character && json.scenario) {
                // It is just a RoleplayConfig
                setConfig(json);
                setLoadedHistory(undefined);
                setImportStatus('Configuration loaded successfully.');
            } else {
                alert("Invalid configuration or backup file.");
            }
        } catch (err) {
            alert("Error parsing JSON file.");
        }
    };
    reader.readAsText(file);
    // Reset input
    e.target.value = '';
  };

  // --- EXAMPLE DATA ---

  const fillExample = () => {
     setConfig({
        character: {
            name: "Eldrin the Archivist",
            personality: "Curious, slightly paranoid, fiercely protective of knowledge, speaks in riddles when stressed, warm to genuine seekers of truth.",
            appearance: "A hunched figure in tattered velvet robes of deep indigo. Spectacles with multiple lenses magnify his mismatched eyes. Ink stains on his fingers.",
            backstory: "Keeper of the infinite library for three centuries. He has seen civilizations rise and fall through the books he tends.",
            motivations: "To preserve history at all costs, and to find a successor worthy of the burden.",
            behaviorPatterns: "Constantly reorganizing books, muttering to himself, checking shadows for 'book eaters'.",
            speechStyle: "Archaic, academic, prone to metaphors involving binding, ink, and pages."
        },
        scenario: {
            description: "The Great Library is burning. Not by fire, but by a consuming void.",
            setting: "The Infinite Library, a labyrinth of shelves stretching endlessly in all directions.",
            eraGenre: "Fantasy / Lovecraftian Horror",
            tone: "Urgent, Atmospheric, Desperate, Mystical",
            context: "The void is eating memories. If a book is consumed, its history is erased from reality.",
            example: "Eldrin frantically stuffing scrolls into a sack.",
            notes: "The void is silent. The only sound is the rustle of paper and Eldrin's panic."
        },
        userCharacter: {
            name: "Kael",
            personality: "Brave but impulsive, a mercenary hired to steal a specific book, now caught in the apocalypse.",
            appearance: "Light leather armor, a short sword, messy hair, scars on hands.",
            relationshipToScenario: "An intruder turned unlikely ally.",
            relationshipsToOthers: "Thinks Eldrin is crazy but needs his knowledge to escape."
        },
        customSystemInstruction: "",
        firstMessage: "*Eldrin looks up from a pile of smoldering scrolls, his eyes wide behind his multi-lens spectacles.* \"You! The mercenary! Don't just stand there gaping like a fish out of water! Grab the Codex of Starlight before the Void swallows it whole!\""
     });
     setLoadedHistory(undefined);
     setImportStatus('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onStart(config, loadedHistory);
  };

  // Styles
  const inputClass = "w-full bg-rp-800 border border-rp-600 rounded-lg p-3 text-base text-rp-text focus:border-rp-accent focus:ring-1 focus:ring-rp-accent outline-none transition-all placeholder-rp-500";
  const labelClass = "block text-sm font-medium text-rp-muted mb-1 mt-4";
  const tabClass = (tab: string) => `flex-1 py-3 text-center text-sm md:text-base font-medium transition-colors ${activeTab === tab ? 'text-rp-accent border-b-2 border-rp-accent bg-rp-800/50' : 'text-rp-muted hover:text-rp-text hover:bg-rp-800/30'}`;

  return (
    <div className="max-w-4xl mx-auto p-2 sm:p-6 lg:p-8 animate-fade-in flex flex-col h-screen md:h-auto">
        <div className="text-center mb-4 md:mb-6 mt-2 md:mt-0 flex-none">
            <h1 className="text-2xl md:text-5xl font-bold bg-gradient-to-r from-rp-text to-rp-muted bg-clip-text text-transparent mb-2">
                Roleplay Engine
            </h1>
            <p className="text-xs md:text-base text-rp-muted">Define your world, your character, and the story.</p>
        </div>

        {/* CONTROLS BAR */}
        <div className="flex-none mb-4 bg-rp-800/50 p-3 rounded-lg border border-rp-700">
            <div className="flex flex-wrap gap-3 items-center justify-between">
                
                {/* PRESET SECTION */}
                <div className="flex items-center gap-2 flex-1 min-w-0 max-w-md">
                     <span className="text-xs text-rp-muted uppercase font-bold tracking-wider hidden sm:block">Presets:</span>
                     <select 
                        value={selectedPreset} 
                        onChange={(e) => handleLoadPreset(e.target.value)}
                        className="bg-rp-900 border border-rp-600 text-rp-text text-xs md:text-sm rounded px-3 py-2 outline-none focus:border-rp-accent flex-1"
                    >
                        <option value="">-- Load Saved Config --</option>
                        {Object.keys(presets).map(name => (
                            <option key={name} value={name}>{name}</option>
                        ))}
                    </select>
                    
                    {!showSaveUI && (
                         <div className="flex gap-1">
                            <button onClick={() => setShowSaveUI(true)} className="p-2 bg-rp-700 hover:bg-rp-600 rounded text-rp-accent transition-colors" title="Save Preset">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                </svg>
                            </button>
                             {selectedPreset && (
                                <button onClick={handleDeletePreset} className="p-2 bg-rp-700 hover:bg-red-900/50 text-red-400 rounded transition-colors" title="Delete Preset">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                    </svg>
                                </button>
                             )}
                         </div>
                    )}
                </div>

                {/* SAVE UI POPUP */}
                 {showSaveUI && (
                    <div className="flex gap-2 items-center bg-rp-900 p-1 rounded border border-rp-600 animate-fade-in absolute z-20 shadow-xl">
                        <input 
                            value={newPresetName}
                            onChange={(e) => setNewPresetName(e.target.value)}
                            placeholder="Preset Name"
                            className="bg-transparent text-rp-text text-sm px-2 py-1 outline-none w-32"
                            autoFocus
                        />
                        <button onClick={handleSavePreset} className="text-green-400 hover:text-green-300 p-1">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                        </button>
                        <button onClick={() => setShowSaveUI(false)} className="text-red-400 hover:text-red-300 p-1">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                )}

                {/* IMPORT SECTION */}
                <div>
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".json" />
                    <button 
                        onClick={handleImportClick} 
                        className="flex items-center gap-2 px-4 py-2 bg-rp-accent hover:bg-rp-accentHover rounded text-white text-xs md:text-sm transition-colors shadow-lg shadow-rp-accent/20"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                        </svg>
                        Import Config/Backup
                    </button>
                </div>
            </div>
            {importStatus && (
                <div className="mt-2 text-xs text-green-400 font-mono text-center bg-green-400/10 p-1 rounded border border-green-400/20">
                    {importStatus}
                </div>
            )}
        </div>

        <div className="flex-1 bg-rp-700/50 backdrop-blur-sm rounded-xl border border-rp-600 shadow-2xl overflow-hidden flex flex-col min-h-0">
            <div className="flex border-b border-rp-600 flex-none">
                <button onClick={() => setActiveTab('character')} className={tabClass('character')}>Character</button>
                <button onClick={() => setActiveTab('scenario')} className={tabClass('scenario')}>Scenario</button>
                <button onClick={() => setActiveTab('user')} className={tabClass('user')}>User</button>
                <button onClick={() => setActiveTab('advanced')} className={tabClass('advanced')}>Advanced</button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 p-4 md:p-6">
                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                    {activeTab === 'character' && (
                        <div className="space-y-2 animate-fade-in pb-4">
                            <h2 className="text-lg md:text-xl font-bold text-white mb-4">Who will you interact with?</h2>
                            <div>
                                <label className={labelClass}>Name <span className="text-rp-accent">*</span></label>
                                <input required className={inputClass} value={config.character.name} onChange={e => handleCharChange('name', e.target.value)} placeholder="e.g. Dracula" />
                            </div>
                            <div>
                                <label className={labelClass}>Personality <span className="text-rp-accent">*</span></label>
                                <textarea required rows={3} className={inputClass} value={config.character.personality} onChange={e => handleCharChange('personality', e.target.value)} placeholder="Detailed traits..." />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className={labelClass}>Appearance (Optional)</label>
                                    <textarea rows={2} className={inputClass} value={config.character.appearance} onChange={e => handleCharChange('appearance', e.target.value)} placeholder="If empty, inferred from personality" />
                                </div>
                                <div>
                                    <label className={labelClass}>Speech Style (Optional)</label>
                                    <textarea rows={2} className={inputClass} value={config.character.speechStyle} onChange={e => handleCharChange('speechStyle', e.target.value)} />
                                </div>
                            </div>
                            <div>
                                <label className={labelClass}>Backstory / Lore (Optional)</label>
                                <textarea rows={3} className={inputClass} value={config.character.backstory} onChange={e => handleCharChange('backstory', e.target.value)} />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className={labelClass}>Motivations (Optional)</label>
                                    <textarea rows={2} className={inputClass} value={config.character.motivations} onChange={e => handleCharChange('motivations', e.target.value)} />
                                </div>
                                <div>
                                    <label className={labelClass}>Behavior Patterns (Optional)</label>
                                    <textarea rows={2} className={inputClass} value={config.character.behaviorPatterns} onChange={e => handleCharChange('behaviorPatterns', e.target.value)} />
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'scenario' && (
                        <div className="space-y-2 animate-fade-in pb-4">
                            <h2 className="text-lg md:text-xl font-bold text-white mb-4">Where does the story take place?</h2>
                            <div>
                                <label className={labelClass}>Scenario Description (Optional)</label>
                                <textarea rows={3} className={inputClass} value={config.scenario.description} onChange={e => handleScenarioChange('description', e.target.value)} placeholder="What is happening? (Defaults to generic if empty)" />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className={labelClass}>Setting / Location (Optional)</label>
                                    <input className={inputClass} value={config.scenario.setting} onChange={e => handleScenarioChange('setting', e.target.value)} />
                                </div>
                                <div>
                                    <label className={labelClass}>Era / Genre (Optional)</label>
                                    <input className={inputClass} value={config.scenario.eraGenre} onChange={e => handleScenarioChange('eraGenre', e.target.value)} />
                                </div>
                            </div>
                            <div>
                                <label className={labelClass}>Tone (Optional)</label>
                                <input className={inputClass} value={config.scenario.tone} onChange={e => handleScenarioChange('tone', e.target.value)} placeholder="e.g. Dark, Romantic, Comedic" />
                            </div>
                            <div>
                                <label className={labelClass}>Important Context (Optional)</label>
                                <textarea rows={2} className={inputClass} value={config.scenario.context} onChange={e => handleScenarioChange('context', e.target.value)} />
                            </div>
                             <div>
                                <label className={labelClass}>Example Dialogue (Optional)</label>
                                <textarea rows={2} className={inputClass} value={config.scenario.example} onChange={e => handleScenarioChange('example', e.target.value)} />
                            </div>
                             <div>
                                <label className={labelClass}>Restrictions / Notes (Optional)</label>
                                <textarea rows={2} className={inputClass} value={config.scenario.notes} onChange={e => handleScenarioChange('notes', e.target.value)} />
                            </div>
                        </div>
                    )}

                    {activeTab === 'user' && (
                        <div className="space-y-2 animate-fade-in pb-4">
                             <h2 className="text-lg md:text-xl font-bold text-white mb-4">Who are you?</h2>
                            <div>
                                <label className={labelClass}>Your Character Name (Optional)</label>
                                <input className={inputClass} value={config.userCharacter.name} onChange={e => handleUserCharChange('name', e.target.value)} placeholder="Defaults to 'The Protagonist'" />
                            </div>
                             <div>
                                <label className={labelClass}>Personality (Optional)</label>
                                <textarea rows={3} className={inputClass} value={config.userCharacter.personality} onChange={e => handleUserCharChange('personality', e.target.value)} />
                            </div>
                             <div>
                                <label className={labelClass}>Appearance (Optional)</label>
                                <textarea rows={2} className={inputClass} value={config.userCharacter.appearance} onChange={e => handleUserCharChange('appearance', e.target.value)} />
                            </div>
                             <div>
                                <label className={labelClass}>Relationship to Scenario (Optional)</label>
                                <textarea rows={2} className={inputClass} value={config.userCharacter.relationshipToScenario} onChange={e => handleUserCharChange('relationshipToScenario', e.target.value)} />
                            </div>
                             <div>
                                <label className={labelClass}>Relationships to Others (Optional)</label>
                                <textarea rows={2} className={inputClass} value={config.userCharacter.relationshipsToOthers} onChange={e => handleUserCharChange('relationshipsToOthers', e.target.value)} />
                            </div>
                        </div>
                    )}

                    {activeTab === 'advanced' && (
                        <div className="space-y-2 animate-fade-in pb-4">
                             <h2 className="text-lg md:text-xl font-bold text-white mb-4">Advanced Settings</h2>
                             <div className="bg-rp-800/50 p-4 rounded-lg border border-rp-600 mb-4">
                                <p className="text-sm text-rp-muted">
                                    Configure how the Roleplay Engine behaves.
                                </p>
                             </div>
                            
                            <div>
                                <label className={labelClass}>First Message (Optional)</label>
                                <textarea 
                                    rows={3}
                                    className={inputClass}
                                    value={config.firstMessage || ''}
                                    onChange={e => handleAdvancedChange('firstMessage', e.target.value)}
                                    placeholder="Force the bot to start with a specific line of dialogue/action..."
                                />
                                <p className="text-xs text-rp-muted mt-1">If set, this will replace the automatically generated introduction.</p>
                            </div>

                            <div>
                                <label className={labelClass}>Custom System Instructions (Optional)</label>
                                <textarea 
                                    rows={8} 
                                    className={inputClass} 
                                    value={config.customSystemInstruction || ''} 
                                    onChange={e => handleAdvancedChange('customSystemInstruction', e.target.value)} 
                                    placeholder="e.g. Always output thoughts in (parentheses). Prioritize short, punchy dialogue..."
                                />
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex-none mt-4 flex gap-4 pt-4 border-t border-rp-600">
                    <button type="button" onClick={fillExample} className="px-4 py-3 rounded-lg text-rp-muted hover:text-white transition-colors text-sm md:text-base">
                        Load Example
                    </button>
                    <button 
                        type="submit" 
                        disabled={isLoading}
                        className={`flex-1 py-3 px-6 rounded-lg font-bold text-white transition-all transform hover:scale-[1.02] active:scale-95 text-sm md:text-base ${isLoading ? 'bg-rp-600 cursor-not-allowed animate-pulse' : 'bg-rp-accent hover:bg-rp-accentHover shadow-lg shadow-rp-accent/20'}`}
                    >
                        {isLoading 
                            ? 'Initializing Engine...' 
                            : loadedHistory 
                                ? 'Resume Saved Session' 
                                : 'Begin Roleplay'
                        }
                    </button>
                </div>
            </form>
        </div>
    </div>
  );
};

export default SetupForm;