export interface CharacterDefinition {
  name: string;
  personality: string;
  appearance: string;
  backstory: string;
  motivations: string;
  behaviorPatterns: string;
  speechStyle: string;
}

export interface ScenarioDefinition {
  description: string;
  setting: string;
  eraGenre: string;
  tone: string;
  context: string;
  example: string;
  notes: string;
}

export interface UserCharacterDefinition {
  name: string;
  personality: string;
  appearance: string;
  relationshipToScenario: string;
  relationshipsToOthers: string;
}

export interface RoleplayConfig {
  character: CharacterDefinition;
  scenario: ScenarioDefinition;
  userCharacter: UserCharacterDefinition;
  customSystemInstruction?: string;
  firstMessage?: string;
}

export interface Message {
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  isThinking?: boolean;
}

export interface RoleplaySession {
  config: RoleplayConfig;
  history: Message[];
  savedAt: string;
}

export enum AppState {
  SETUP,
  ROLEPLAY,
}