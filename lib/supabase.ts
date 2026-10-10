import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://akzbrxmkrohvxrblxeij.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFremJyeG1rcm9odnhyYmx4ZWlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzNzAzMTcsImV4cCI6MjEwNjk0NjMxN30.WeIGwNLUXPB1otoTkVEBUMCQJBL279_g-9asFKyWukU";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});