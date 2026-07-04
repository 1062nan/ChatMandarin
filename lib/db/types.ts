/**
 * Supabase Database 类型定义
 * 自动生成：npx supabase gen types typescript --project-id "xobfnmwaxlswfofmembv" > lib/db/types.ts
 *
 * 这里手写一份简化版（运行 supabase gen 后会被覆盖）
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type CorrectionMode = 'friendly' | 'strict' | 'tutor'
export type SubscriptionPlan = 'free' | 'plus' | 'pro'
export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'trialing' | 'expired'
export type MistakeType = 'tone' | 'grammar' | 'word' | 'fluency'
export type HSKKLevel = 'beginner' | 'intermediate' | 'advanced'
export type HSKKStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface Profile {
  id: string
  auth_id: string
  email: string
  display_name: string | null
  avatar_url: string | null
  hsk_level: number
  correction_mode: CorrectionMode
  audio_speed: number
  preferred_language: string
  total_conversations: number
  total_minutes: number
  current_streak: number
  longest_streak: number
  last_practice_date: string | null
  created_at: string
  updated_at: string
}

export interface Subscription {
  id: string
  user_id: string
  lemon_squeezy_id: string | null
  plan: SubscriptionPlan
  status: SubscriptionStatus
  current_period_end: string | null
  cancel_at_period_end: boolean
  created_at: string
  updated_at: string
}

export interface Conversation {
  id: string
  user_id: string
  scenario: string
  hsk_level: number
  correction_mode: CorrectionMode
  started_at: string
  ended_at: string | null
  total_turns: number
  avg_pronunciation: number | null
  avg_grammar: number | null
  avg_fluency: number | null
  avg_word_choice: number | null
}

export interface ConversationTurn {
  id: string
  conversation_id: string
  turn_index: number
  user_text: string | null
  ai_text: string | null
  user_audio_path: string | null
  ai_audio_path: string | null
  pronunciation_score: number | null
  grammar_score: number | null
  fluency_score: number | null
  word_choice_score: number | null
  errors: MistakeEntry[]
  user_audio_duration_ms: number | null
  ai_response_latency_ms: number | null
  created_at: string
}

export interface MistakeEntry {
  type: MistakeType
  user_said: string
  correct: string
  explanation?: string
  severity?: 'low' | 'medium' | 'high'
}

export interface Mistake {
  id: string
  user_id: string
  type: MistakeType
  user_said: string
  correct: string
  explanation: string | null
  hsk_level: number | null
  scenario: string | null
  source_conversation_id: string | null
  review_count: number
  next_review_at: string
  ease_factor: number
  interval_days: number
  mastered: boolean
  created_at: string
  last_reviewed_at: string | null
}

export interface HSKKTest {
  id: string
  user_id: string
  level: HSKKLevel
  section_read_audio: string | null
  section_qa_audio: string | null
  section_picture_audio: string | null
  section_read_text: string | null
  section_qa_text: Json
  section_picture_text: string | null
  total_score: number | null
  pronunciation_score: number | null
  fluency_score: number | null
  grammar_score: number | null
  vocabulary_score: number | null
  content_score: number | null
  feedback: Json
  status: HSKKStatus
  created_at: string
  completed_at: string | null
}

export interface Scenario {
  id: string
  name: { en: string; zh: string }
  description: { en: string; zh: string }
  recommended_hsk: number[]
  duration_minutes: number
  ai_persona: string
  scenario_prompt: string
  goals: string[]
  completion_criteria: {
    min_turns?: number
    min_vocab_used?: number
  }
  is_active: boolean
  sort_order: number
  created_at: string
}

export interface UsageStat {
  user_id: string
  date: string
  conversation_seconds: number
  conversation_count: number
  hskk_count: number
}

// Supabase Database 类型
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: Partial<Profile> & Pick<Profile, 'auth_id' | 'email'>
        Update: Partial<Profile>
      }
      subscriptions: {
        Row: Subscription
        Insert: Partial<Subscription> & Pick<Subscription, 'user_id'>
        Update: Partial<Subscription>
      }
      conversations: {
        Row: Conversation
        Insert: Partial<Conversation> & Pick<Conversation, 'user_id' | 'scenario' | 'hsk_level' | 'correction_mode'>
        Update: Partial<Conversation>
      }
      conversation_turns: {
        Row: ConversationTurn
        Insert: Partial<ConversationTurn> & Pick<ConversationTurn, 'conversation_id' | 'turn_index'>
        Update: Partial<ConversationTurn>
      }
      mistakes: {
        Row: Mistake
        Insert: Partial<Mistake> & Pick<Mistake, 'user_id' | 'type' | 'user_said' | 'correct'>
        Update: Partial<Mistake>
      }
      hskk_tests: {
        Row: HSKKTest
        Insert: Partial<HSKKTest> & Pick<HSKKTest, 'user_id' | 'level'>
        Update: Partial<HSKKTest>
      }
      scenarios: {
        Row: Scenario
        Insert: Partial<Scenario> & Pick<Scenario, 'id' | 'name' | 'description' | 'ai_persona' | 'scenario_prompt'>
        Update: Partial<Scenario>
      }
      usage_stats: {
        Row: UsageStat
        Insert: Partial<UsageStat> & Pick<UsageStat, 'user_id'>
        Update: Partial<UsageStat>
      }
    }
  }
}
