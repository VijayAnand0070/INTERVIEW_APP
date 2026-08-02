-- Migration v2: Enhanced constraints and atomic operations
-- Run this in the Supabase SQL Editor.

-- ================================================================
-- 1. Add 'evaluating' status to interview_sessions
-- ================================================================
DO $$
BEGIN
    -- Update the check constraint for status
    ALTER TABLE public.interview_sessions DROP CONSTRAINT IF EXISTS interview_sessions_status_check;
    ALTER TABLE public.interview_sessions ADD CONSTRAINT interview_sessions_status_check
      CHECK (status IN ('in_progress', 'evaluating', 'completed', 'cancelled'));
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Could not update session status constraint: %', SQLERRM;
END $$;

-- ================================================================
-- 2. Score range constraints for final_reports
-- ================================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_overall_score') THEN
        ALTER TABLE public.final_reports ADD CONSTRAINT chk_overall_score CHECK (overall_score BETWEEN 0 AND 100);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_technical_score') THEN
        ALTER TABLE public.final_reports ADD CONSTRAINT chk_technical_score CHECK (technical_score BETWEEN 0 AND 100);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_communication_score') THEN
        ALTER TABLE public.final_reports ADD CONSTRAINT chk_communication_score CHECK (communication_score BETWEEN 0 AND 100);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_confidence_score') THEN
        ALTER TABLE public.final_reports ADD CONSTRAINT chk_confidence_score CHECK (confidence_score BETWEEN 0 AND 100);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_resume_relevance_score') THEN
        ALTER TABLE public.final_reports ADD CONSTRAINT chk_resume_relevance_score CHECK (resume_relevance_score BETWEEN 0 AND 100);
    END IF;
END $$;

-- ================================================================
-- 3. Answer constraints
-- ================================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_answer_score') THEN
        ALTER TABLE public.interview_answers ADD CONSTRAINT chk_answer_score CHECK (score BETWEEN 0 AND 100);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_answer_question_index') THEN
        ALTER TABLE public.interview_answers ADD CONSTRAINT chk_answer_question_index CHECK (question_index >= 0);
    END IF;
END $$;

-- ================================================================
-- 4. Session question index constraint
-- ================================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_session_question_index') THEN
        ALTER TABLE public.interview_sessions ADD CONSTRAINT chk_session_question_index CHECK (current_question_index >= 0);
    END IF;
END $$;

-- ================================================================
-- 5. Atomic question index advancement function
-- ================================================================
CREATE OR REPLACE FUNCTION public.advance_question_index(
  p_session_id uuid,
  p_user_id uuid,
  p_expected_index int
)
RETURNS public.interview_sessions
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result public.interview_sessions;
BEGIN
  UPDATE public.interview_sessions
  SET current_question_index = p_expected_index + 1
  WHERE id = p_session_id
    AND user_id = p_user_id
    AND current_question_index = p_expected_index
    AND status = 'in_progress'
  RETURNING * INTO result;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Race condition detected or invalid session state. Expected index: %, session: %',
      p_expected_index, p_session_id;
  END IF;

  RETURN result;
END;
$$;

-- ================================================================
-- 6. Idempotent report generation guard
-- ================================================================
CREATE OR REPLACE FUNCTION public.complete_session_with_guard(
  p_session_id uuid,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_status text;
BEGIN
  SELECT status INTO current_status
  FROM public.interview_sessions
  WHERE id = p_session_id AND user_id = p_user_id
  FOR UPDATE;

  IF current_status = 'completed' THEN
    RETURN false;
  END IF;

  UPDATE public.interview_sessions
  SET status = 'completed', completed_at = now()
  WHERE id = p_session_id AND user_id = p_user_id;

  RETURN true;
END;
$$;

-- ================================================================
-- 7. Additional indexes for performance
-- ================================================================
CREATE INDEX IF NOT EXISTS idx_interview_answers_session_question
  ON public.interview_answers(session_id, question_index);

CREATE INDEX IF NOT EXISTS idx_interview_sessions_status
  ON public.interview_sessions(status)
  WHERE status = 'in_progress';

CREATE INDEX IF NOT EXISTS idx_final_reports_session_id
  ON public.final_reports(session_id);
