import { createClient } from "@supabase/supabase-js"

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/** 環境変数が未設定の場合(ローカル開発でSupabase未接続時など)はnull、同期機能はすべて無効化される */
export const supabase = url && anonKey ? createClient(url, anonKey) : null
