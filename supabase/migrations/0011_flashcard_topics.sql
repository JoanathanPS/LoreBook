-- Flashcard topic grouping (study board redesign) — each card now carries
-- the short topic label the model assigns it, so the review UI can group
-- cards under topic headings instead of one long linear deck.
-- Run after 0001-0010.

alter table public.flashcards
  add column if not exists topic text not null default 'General';
