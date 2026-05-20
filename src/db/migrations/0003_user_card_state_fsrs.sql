CREATE TYPE "public"."card_state" AS ENUM('new', 'learning', 'review', 'relearning');--> statement-breakpoint
ALTER TABLE "user_card_state" ADD COLUMN "state" "card_state" DEFAULT 'new' NOT NULL;