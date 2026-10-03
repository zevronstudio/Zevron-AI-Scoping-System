"use client";
import { useState } from "react";
import { Check, CheckCircle2, CircleDot, HelpCircle, Layers, Sparkles } from "lucide-react";
import type { Project } from "@/types/project";

export function ContextPanel({ project }: { project: Project | null }) {
  const [activeTab, setActiveTab] = useState<"overview" | "requirements">("overview");
  const state = project?.state;

  const confirmedCount = state?.confirmed_requirements?.length || 0;
  const missingCount = state?.missing_requirements?.length || 0;
  const assumptionsCount = state?.assumptions?.length || 0;

  const currentStep = !project?.messages.length
    ? 1
    : project.scopes.length
      ? 3
      : project.stage === "requirement_confirmation"
        ? 2
        : 1;

  const progressPercent = currentStep === 1 ? 33 : currentStep === 2 ? 66 : 100;

  return (
    <div className="context-content">
      <div className="context-header">
        <div className="context-title-group">
          <Layers size={16} />
          <div>
            <h3>Project Intel</h3>
            <span className="context-subhead">Discovery status</span>
          </div>
        </div>
      </div>

      {/* Progress tracker in formal monochrome */}
      <div className="context-progress-card">
        <div className="progress-info">
          <span className="progress-label">Discovery Progress</span>
          <span className="progress-value">Phase {currentStep} of 3</span>
        </div>
        <div className="progress-bar-bg">
          <div
            className="progress-bar-fill"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="progress-steps-chips">
          <span className={`step-chip ${currentStep >= 1 ? "is-active" : ""}`}>
            1. Ideation
          </span>
          <span className={`step-chip ${currentStep >= 2 ? "is-active" : ""}`}>
            2. Clarify
          </span>
          <span className={`step-chip ${currentStep >= 3 ? "is-active" : ""}`}>
            3. Scope
          </span>
        </div>
      </div>

      {/* Segmented Tab */}
      <div className="context-tabs-nav">
        <button
          className={`context-tab-btn ${activeTab === "overview" ? "is-active" : ""}`}
          onClick={() => setActiveTab("overview")}
        >
          <span>Overview</span>
        </button>
        <button
          className={`context-tab-btn ${activeTab === "requirements" ? "is-active" : ""}`}
          onClick={() => setActiveTab("requirements")}
        >
          <span>Requirements</span>
          {confirmedCount > 0 && (
            <span className="tab-badge">{confirmedCount}</span>
          )}
        </button>
      </div>

      {activeTab === "overview" ? (
        <div className="context-tab-pane">
          <div className="context-card">
            <span className="card-label">SPECIFICATIONS</span>
            <div className="spec-row">
              <span className="spec-name">Business</span>
              <span className="spec-val">
                {state?.business_type || "Clarifying during chat..."}
              </span>
            </div>
            <div className="spec-row">
              <span className="spec-name">Type</span>
              <span className="spec-val">
                {state?.project_type || "Software / Web App"}
              </span>
            </div>
            <div className="spec-row">
              <span className="spec-name">Status</span>
              <span className="spec-badge">
                {project?.status || "Drafting"}
              </span>
            </div>
          </div>

          <div className="context-card">
            <span className="card-label">CORE GOAL</span>
            <p className="goal-text">
              {state?.business_goal ||
                "Start with the specific problem you want to solve."}
            </p>
          </div>

          <div className="context-stats-grid">
            <div className="stat-box">
              <span className="stat-number">{confirmedCount}</span>
              <span className="stat-title">Confirmed</span>
            </div>
            <div className="stat-box">
              <span className="stat-number">{missingCount}</span>
              <span className="stat-title">To Clarify</span>
            </div>
            <div className="stat-box">
              <span className="stat-number">{assumptionsCount}</span>
              <span className="stat-title">Assumptions</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="context-tab-pane">
          <div className="requirements-group">
            <div className="req-group-header">
              <CheckCircle2 size={14} />
              <h4>Confirmed Requirements</h4>
              <span className="req-count">{confirmedCount}</span>
            </div>
            {state?.confirmed_requirements && state.confirmed_requirements.length > 0 ? (
              <ul className="clean-req-list">
                {state.confirmed_requirements.map((req, i) => (
                  <li key={i} className="req-item req-item--confirmed">
                    <Check size={13} />
                    <span>{req}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="req-empty-box">
                <Sparkles size={14} />
                <span>Confirmed details will appear as you discuss them.</span>
              </div>
            )}
          </div>

          {state?.missing_requirements && state.missing_requirements.length > 0 && (
            <div className="requirements-group">
              <div className="req-group-header">
                <HelpCircle size={14} />
                <h4>Still to Clarify</h4>
                <span className="req-count">{missingCount}</span>
              </div>
              <ul className="clean-req-list">
                {state.missing_requirements.map((item, i) => (
                  <li key={i} className="req-item req-item--pending">
                    <CircleDot size={11} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {state?.assumptions && state.assumptions.length > 0 && (
            <div className="requirements-group">
              <div className="req-group-header">
                <Layers size={14} />
                <h4>Working Assumptions</h4>
                <span className="req-count">{assumptionsCount}</span>
              </div>
              <ul className="clean-req-list">
                {state.assumptions.map((item, i) => (
                  <li key={i} className="req-item">
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
