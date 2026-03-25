-- =====================================================
-- Migration 002: Add payout fields to seasons
-- Run in: Supabase Dashboard → SQL Editor
-- =====================================================

ALTER TABLE public.seasons
  ADD COLUMN IF NOT EXISTS payout_1st DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS payout_2nd DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS payout_3rd DECIMAL(10,2);
