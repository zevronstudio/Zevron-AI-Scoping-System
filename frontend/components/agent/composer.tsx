"use client";
import { useEffect, useRef, type ChangeEvent } from "react";
import { ArrowUp, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MAX_MESSAGE_LENGTH } from "@/lib/config";

const QUICK_ANSWERS = [
  { label: "📱 Mobile App (iOS & Android)", text: "Project Type: Mobile App for iOS and Android" },
  { label: "🌐 Website / Landing Page", text: "Project Type: Professional Website / Landing Page" },
  { label: "💻 Web Application / SaaS", text: "Project Type: Web Application / SaaS platform" },
  { label: "⚡ Automation & Workflow Bot", text: "Project Type: Backend Automation & Integration Workflow" },
  { label: "🛍️ E-Commerce Online Store", text: "Project Type: E-Commerce Store with checkout & products" },
  { label: "👥 Target Audience: B2C", text: "Target Audience: Direct Consumers (B2C)" },
  { label: "🏢 Target Audience: B2B", text: "Target Audience: Businesses and Corporate Clients (B2B)" },
  { label: "📅 Feature: Online Booking", text: "Required Feature: Online appointment booking with calendar" },
  { label: "💳 Feature: Stripe Payments", text: "Required Feature: Online card payments via Stripe" },
  { label: "🚀 Timeline: Within 1 month", text: "Timeline: Launch within 1 month (urgent)" },
  { label: "🗓️ Timeline: 1-2 months", text: "Timeline: Standard 1 to 2 months" },
  { label: "💰 Budget: $1,000 - $3,000", text: "Budget: $1,000 - $3,000" },
  { label: "💰 Budget: $3,000 - $10,000", text: "Budget: $3,000 - $10,000" },
];

const PROMPT_TEMPLATES = [
  {
    label: "🏥 Clinic / Medical Booking",
    text: "I run a healthcare clinic and need an online appointment booking system for patients with SMS/WhatsApp confirmations and doctor scheduling.",
  },
  {
    label: "🛍️ E-Commerce with Stripe",
    text: "I want to launch a modern e-commerce storefront with product search, shopping cart, Stripe checkout, and automated customer receipt emails.",
  },
  {
    label: "🏡 Real Estate Lead CRM",
    text: "I need an automated lead capture system for real-estate properties with instant WhatsApp replies and an agent follow-up dashboard.",
  },
  {
    label: "🤖 AI Customer Support Bot",
    text: "I want an AI-powered customer support chatbot that answers queries based on our knowledge base and routes complex issues to human agents.",
  },
  {
    label: "📊 SaaS Analytics & Billing",
    text: "I want to build a B2B SaaS web app with tiered subscription billing, user role permissions, and an interactive analytics dashboard.",
  },
  {
    label: "🚚 Food Delivery Mobile App",
    text: "I need a food delivery platform with live rider GPS tracking, restaurant menu management, and push notification updates.",
  },
];

export function Composer({
  value,
  onChange,
  onSend,
  busy,
  disabled,
  hasMessages,
}: {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  busy: boolean;
  disabled: boolean;
  hasMessages?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = "auto";
      ref.current.style.height = `${Math.min(Math.max(ref.current.scrollHeight, 48), 280)}px`;
    }
  }, [value]);

  const handleTemplateSelect = (event: ChangeEvent<HTMLSelectElement>) => {
    const selectedText = event.target.value;
    if (selectedText) {
      onChange(selectedText);
      event.target.value = "";
      if (ref.current) {
        ref.current.focus();
      }
    }
  };

  const handleQuickAnswerSelect = (event: ChangeEvent<HTMLSelectElement>) => {
    const selectedText = event.target.value;
    if (selectedText) {
      onChange(value.trim() ? `${value.trim()}\n${selectedText}` : selectedText);
      event.target.value = "";
      if (ref.current) {
        ref.current.focus();
      }
    }
  };

  return (
    <form
      className="composer-area"
      onSubmit={(event) => {
        event.preventDefault();
        if (value.trim() && !disabled) onSend();
      }}
    >
      <div className="composer">
        <div className="composer-header">
          <label htmlFor="project-message">
            {hasMessages
              ? "Continue your project discovery"
              : "What do you have in mind?"}
          </label>
          <div className="composer-selectors">
            {/* Quick Answer Dropdown (App, Website, Web App, Automation, etc.) */}
            <div className="composer-template-select-wrapper">
              <select
                aria-label="Quick answer selector"
                className="composer-template-select"
                disabled={disabled}
                defaultValue=""
                onChange={handleQuickAnswerSelect}
              >
                <option value="" disabled>
                  ⚡ Quick answer (App, Web, Automation)…
                </option>
                {QUICK_ANSWERS.map((ans) => (
                  <option key={ans.label} value={ans.text}>
                    {ans.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Full Prompt Template Dropdown */}
            <div className="composer-template-select-wrapper">
              <select
                aria-label="Prompt templates"
                className="composer-template-select"
                disabled={disabled}
                defaultValue=""
                onChange={handleTemplateSelect}
              >
                <option value="" disabled>
                  ✨ Ideas / Templates…
                </option>
                {PROMPT_TEMPLATES.map((tmpl) => (
                  <option key={tmpl.label} value={tmpl.text}>
                    {tmpl.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <textarea
          ref={ref}
          id="project-message"
          maxLength={MAX_MESSAGE_LENGTH}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={
            hasMessages
              ? "Answer a question, select an option from the dropdown above, or type your update…"
              : "Describe what you want to build, or pick from the dropdowns above…"
          }
          disabled={disabled}
          rows={1}
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault();
              if (value.trim() && !disabled) onSend();
            }
          }}
        />
        <div className="composer-bottom">
          <span>
            {value.length > 5500
              ? `${value.length.toLocaleString()} / 6,000`
              : "Press Enter to send · Shift+Enter for new line"}
          </span>
          <Button
            type="submit"
            variant="primary"
            disabled={disabled || !value.trim()}
            aria-label="Send message"
          >
            {busy ? (
              <LoaderCircle size={15} className="spin" />
            ) : (
              <ArrowUp size={15} />
            )}
          </Button>
        </div>
      </div>
      <div className="composer-hint">
      </div>
    </form>
  );
}
