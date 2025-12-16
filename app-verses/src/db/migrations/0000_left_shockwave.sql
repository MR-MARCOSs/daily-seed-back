CREATE TABLE "verses" (
	"id" serial PRIMARY KEY NOT NULL,
	"text" text NOT NULL,
	"book" text NOT NULL,
	"chapter" integer NOT NULL,
	"lesson" text NOT NULL,
	"from" integer NOT NULL,
	"to" integer,
	"approved" boolean DEFAULT false
);
