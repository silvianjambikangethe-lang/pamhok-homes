"use client";

import { useState, type FormEvent } from "react";
import { CheckCircle, PaperPlaneTilt } from "@phosphor-icons/react";

type Status = "idle" | "submitting" | "success" | "error";

export default function ContactForm() {
  const [status, setStatus] = useState<Status>("idle");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");

    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form).entries());

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Request failed");
      setStatus("success");
      form.reset();
    } catch {
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-taupe/20 bg-surface p-10 text-center shadow-card">
        <CheckCircle size={40} weight="fill" className="text-success" />
        <p className="font-serif text-xl font-semibold text-ink">
          Message sent
        </p>
        <p className="text-sm text-ink/80">
          Thank you — we&apos;ll get back to you shortly.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5 rounded-2xl border border-taupe/20 bg-surface p-7 shadow-card"
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className="text-sm font-medium text-ink/80">
            Full name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            autoComplete="name"
            className="focus-ring mt-1.5 w-full rounded-lg border border-taupe/25 bg-page px-3.5 py-2.5 text-sm text-ink placeholder:text-ink/40"
            placeholder="Jane Doe"
          />
        </div>
        <div>
          <label htmlFor="email" className="text-sm font-medium text-ink/80">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="focus-ring mt-1.5 w-full rounded-lg border border-taupe/25 bg-page px-3.5 py-2.5 text-sm text-ink placeholder:text-ink/40"
            placeholder="jane@example.com"
          />
        </div>
      </div>

      <div>
        <label htmlFor="message" className="text-sm font-medium text-ink/80">
          Message
        </label>
        <textarea
          id="message"
          name="message"
          required
          rows={5}
          className="focus-ring mt-1.5 w-full rounded-lg border border-taupe/25 bg-page px-3.5 py-2.5 text-sm text-ink placeholder:text-ink/40"
          placeholder="How can we help?"
        />
      </div>

      {status === "error" && (
        <p role="alert" className="text-sm text-danger">
          Something went wrong — please try again, or message us on
          WhatsApp instead.
        </p>
      )}

      <button
        type="submit"
        disabled={status === "submitting"}
        className="focus-ring inline-flex items-center justify-center gap-2 rounded-full bg-mocha-500 dark:bg-terracotta-500 px-6 py-3 text-sm font-semibold text-mousse dark:text-white transition-colors hover:bg-mocha-600 dark:hover:bg-terracotta-600 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <PaperPlaneTilt size={18} weight="fill" />
        {status === "submitting" ? "Sending…" : "Send Message"}
      </button>
    </form>
  );
}
