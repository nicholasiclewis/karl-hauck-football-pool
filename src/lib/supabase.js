import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
  ?? 'https://jpeaijrdvbvbpcmuqhgt.supabase.co'

const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()
  ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpwZWFpanJkdmJ2YnBjbXVxaGd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2NjE4MTgsImV4cCI6MjA4OTIzNzgxOH0.XIK-uiH08hQKMNYd0rd_0cENqUITWWfb47CKxWuX408'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
