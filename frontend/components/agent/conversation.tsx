"use client";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { ArrowDown, Bot, ChevronDown, LoaderCircle, Sparkles, User } from "lucide-react";
import type { Project } from "@/types/project";
import { product } from "@/lib/config";

export function getSmartOptionsForQuestion(
  questionText: string,
): { label: string; value: string }[] | null {
  const q = questionText.toLowerCase();

  // 1. Project Type / Platform Category (Mobile App, Website, Web App, Automation)
  if (
    q.includes("type of project") ||
    q.includes("project type") ||
    q.includes("what type") ||
    q.includes("which type") ||
    q.includes("kis type") ||
    q.includes("kind of project") ||
    q.includes("kind of app") ||
    q.includes("type of app") ||
    q.includes("web app or mobile") ||
    q.includes("website or app") ||
    q.includes("web application, mobile") ||
    q.includes("what are you building") ||
    q.includes("what kind of platform") ||
    (q.includes("platform") && (q.includes("web") || q.includes("mobile") || q.includes("app") || q.includes("build")))
  ) {
    return [
      { label: "📱 Mobile App (iOS / Android)", value: "Project Type: Mobile App (iOS & Android native/hybrid)" },
      { label: "🌐 Website (Landing Page / Corporate Site)", value: "Project Type: Professional Website / Landing Page" },
      { label: "💻 Web App (SaaS / Portal / Dashboard)", value: "Project Type: Web Application / SaaS Portal" },
      { label: "⚡ Automation & Workflow (Bot / Integration)", value: "Project Type: Automation & Backend Workflow Bot" },
      { label: "🛍️ E-Commerce Online Store", value: "Project Type: E-Commerce Store with checkout & catalog" },
      { label: "🤖 AI Agent & Chatbot System", value: "Project Type: Custom AI Agent solution" },
    ];
  }

  // 2. Mobile Specific (iOS / Android / Cross-platform)
  if (
    q.includes("ios or android") ||
    q.includes("android or ios") ||
    q.includes("native or cross") ||
    (q.includes("mobile") && (q.includes("operating system") || q.includes("devices")))
  ) {
    return [
      { label: "📱 Both iOS & Android (Cross-Platform)", value: "Mobile Platforms: Both iOS and Android" },
      { label: "🍏 iOS Only (iPhone & iPad)", value: "Mobile Platforms: iOS only" },
      { label: "🤖 Android Only", value: "Mobile Platforms: Android only" },
      { label: "🌐 Responsive Web Only (No native app)", value: "Platform: Responsive Mobile Web only (no native app)" },
    ];
  }

  // 3. Target Audience / User Type
  if (
    q.includes("target audience") ||
    q.includes("who is the audience") ||
    q.includes("who will use") ||
    q.includes("who are the primary users") ||
    q.includes("b2b or b2c")
  ) {
    return [
      { label: "👥 Consumers / General Public (B2C)", value: "Target Audience: Direct Consumers / Public (B2C)" },
      { label: "🏢 Businesses & Corporate Clients (B2B)", value: "Target Audience: Corporate Clients & Businesses (B2B)" },
      { label: "🏥 Patients & Healthcare Seekers", value: "Target Audience: Patients and healthcare seekers" },
      { label: "💼 Internal Team & Operations Only", value: "Target Audience: Internal staff and company operations" },
    ];
  }

  // 4. Booking / Appointments
  if (
    q.includes("booking system") ||
    q.includes("how should clients book") ||
    q.includes("appointment booking") ||
    q.includes("schedule appointments") ||
    (q.includes("booking") && (q.includes("feature") || q.includes("allow") || q.includes("need")))
  ) {
    return [
      { label: "📅 Online Booking with Calendar Sync", value: "Booking: Online appointment booking with calendar sync" },
      { label: "📲 WhatsApp / Phone Direct Booking", value: "Booking: WhatsApp & Phone direct inquiry booking" },
      { label: "⚙️ External Tool Embed (Calendly / Acuity)", value: "Booking: Embed external booking system (Calendly)" },
      { label: "❌ No Booking Required", value: "Booking: No appointment booking needed" },
    ];
  }

  // 5. Payments & Billing
  if (
    q.includes("payment gateway") ||
    q.includes("how will you accept payment") ||
    q.includes("collect payments") ||
    q.includes("payment method") ||
    q.includes("stripe or paypal") ||
    (q.includes("payment") && (q.includes("accept") || q.includes("process") || q.includes("need")))
  ) {
    return [
      { label: "💳 Stripe Credit / Debit Card Checkout", value: "Payments: Online card payments via Stripe" },
      { label: "🔄 Recurring Monthly Subscriptions", value: "Payments: Automated monthly/annual recurring subscription" },
      { label: "🧾 Offline Bank Transfer / Cash on Delivery", value: "Payments: Manual bank wire transfer or COD" },
      { label: "❌ No Payments Needed", value: "Payments: No online payments required" },
    ];
  }

  // 6. User Accounts & Authentication
  if (
    q.includes("user login") ||
    q.includes("authentication") ||
    q.includes("create accounts") ||
    q.includes("sign up") ||
    q.includes("user accounts")
  ) {
    return [
      { label: "🔐 Email + Password & Google Social Login", value: "Auth: Email/password and Google OAuth sign-in" },
      { label: "📲 Phone Number OTP Verification", value: "Auth: Mobile phone OTP login" },
      { label: "🚫 No Login Needed (Public access)", value: "Auth: No user accounts or login required" },
    ];
  }

  // 7. Timeline / Launch
  if (
    q.includes("timeline") ||
    q.includes("target launch") ||
    q.includes("when do you need") ||
    q.includes("launch date") ||
    q.includes("deadline")
  ) {
    return [
      { label: "🚀 Urgent Launch (Within 2-4 Weeks)", value: "Timeline: Urgent launch within 2-4 weeks" },
      { label: "🗓️ Standard Schedule (1 - 2 Months)", value: "Timeline: Standard 1 to 2 months" },
      { label: "⏳ Flexible / Milestone-driven MVP", value: "Timeline: Flexible, prioritize functional MVP" },
    ];
  }

  // 8. Budget
  if (
    q.includes("budget range") ||
    q.includes("what is your budget") ||
    q.includes("estimated budget") ||
    q.includes("budget for this")
  ) {
    return [
      { label: "💰 Starter MVP (Under $2,000)", value: "Budget: Under $2,000" },
      { label: "💼 Growth ($2,000 - $5,000)", value: "Budget: $2,000 - $5,000" },
      { label: "🏢 Enterprise ($5,000 - $15,000+)", value: "Budget: $5,000 - $15,000+" },
      { label: "⚖️ Flexible / Recommend optimal cost", value: "Budget: Flexible, recommend the best cost-effective stack" },
    ];
  }

  // 9. Specific Yes / No inclusion questions
  if (
    q.startsWith("do you need") ||
    q.startsWith("should we include") ||
    q.startsWith("would you like to include") ||
    q.includes("multi-language") ||
    q.includes("admin dashboard")
  ) {
    return [
      { label: "✅ Yes, definitely include this", value: "Yes, this feature is required." },
      { label: "❌ No, keep it simple (exclude for now)", value: "No, exclude this to keep MVP focused." },
      { label: "💡 Recommend the standard approach", value: "Recommend the best standard approach for this." },
    ];
  }

  // For open-ended questions (e.g. clinic name, description, brand, story) -> NO DROPDOWN
  return null;
}

export function Conversation({
  messages,
  busy,
  onAnswer,
}: {
  messages: Project["messages"];
  busy: boolean;
  onAnswer?: (answer: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [answeredMap, setAnsweredMap] = useState<Record<string, string>>({});

  const scrollToBottom = (smooth = true) => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({
        behavior: smooth ? "smooth" : "auto",
        block: "end",
      });
    }
  };

  useEffect(() => {
    scrollToBottom(true);
  }, [messages, busy]);

  const handleScroll = () => {
    const el = container.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollBottom(distanceFromBottom > 160);
  };

  const handleDropdownSelect = (
    key: string,
    event: ChangeEvent<HTMLSelectElement>,
  ) => {
    const val = event.target.value;
    if (val && onAnswer) {
      setAnsweredMap((prev) => ({ ...prev, [key]: val }));
      onAnswer(val);
    }
  };

  return (
    <div className="conversation-wrapper">
      <div
        ref={container}
        className="conversation"
        onScroll={handleScroll}
      >
        <div className="conversation-intro">
          <div className="intro-badge">
            <Sparkles size={13} />
            <span>DISCOVERY NOTES</span>
          </div>
          <p>From your initial concept to verified architecture and project brief.</p>
        </div>

        {messages.map((message, msgIdx) => {
          const isLatestAssistant =
            message.role === "assistant" && msgIdx === messages.length - 1;

          return (
            <article
              className={`message message--${message.role}`}
              key={message.id}
              aria-label={
                message.role === "user" ? "Your message" : "Advisor response"
              }
            >
              <div className="message-author">
                <span
                  className={
                    message.role === "assistant"
                      ? "advisor-avatar"
                      : "user-avatar"
                  }
                >
                  {message.role === "assistant" ? (
                    <Bot size={13} />
                  ) : (
                    <User size={13} />
                  )}
                </span>
                <b>{message.role === "assistant" ? product.studio : "You"}</b>
                {message.role === "assistant" && (
                  <small className="author-role-tag">Advisor</small>
                )}
              </div>
              <div className="message-content-box">
                <p>{message.content}</p>
                {message.questions && message.questions.length > 0 && (
                  <div className="questions-container">
                    <span className="questions-header">Clarifying questions:</span>
                    <ol className="questions">
                      {message.questions.map((question, i) => {
                        const questionKey = `${message.id}-q-${i}`;
                        const options = getSmartOptionsForQuestion(question);
                        const selectedAnswer = answeredMap[questionKey];

                        return (
                          <li key={i} className="question-list-item">
                            <span className="question-text">{question}</span>

                            {/* Interactive Answer Dropdown for this Question (only rendered when categorical options exist) */}
                            {isLatestAssistant && onAnswer && options && options.length > 0 && (
                              <div className="question-dropdown-wrapper">
                                <div className="question-select-box">
                                  <select
                                    aria-label={`Select answer for: ${question}`}
                                    className="question-answer-select"
                                    value={selectedAnswer || ""}
                                    onChange={(e) =>
                                      handleDropdownSelect(questionKey, e)
                                    }
                                  >
                                    <option value="" disabled>
                                      ▾ Choose a quick answer…
                                    </option>
                                    {options.map((opt) => (
                                      <option key={opt.label} value={opt.value}>
                                        {opt.label}
                                      </option>
                                    ))}
                                  </select>
                                  <ChevronDown
                                    size={12}
                                    className="question-arrow"
                                  />
                                </div>
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ol>
                  </div>
                )}
              </div>
            </article>
          );
        })}

        {busy && (
          <div className="activity" role="status">
            <LoaderCircle size={15} className="spin" />
            <span>Reviewing your project specifications and requirements…</span>
          </div>
        )}

        <div ref={bottomRef} className="conversation-anchor" />
      </div>

      {showScrollBottom && (
        <button
          className="scroll-bottom-button"
          onClick={() => scrollToBottom(true)}
          aria-label="Scroll to newest messages"
          title="Scroll to bottom"
        >
          <ArrowDown size={13} />
          <span>Newest messages</span>
        </button>
      )}
    </div>
  );
}
