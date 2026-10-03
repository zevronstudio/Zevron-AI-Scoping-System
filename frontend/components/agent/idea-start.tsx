import {
  ArrowUpRight,
  Building2,
  CalendarDays,
  Headset,
  House,
} from "lucide-react";
const starters = [
  {
    icon: Building2,
    label: "A website for my clinic",
    text: "I need a website for my clinic.",
  },
  {
    icon: House,
    label: "A better way to manage leads",
    text: "I want to automate real-estate leads.",
  },
  {
    icon: CalendarDays,
    label: "An appointment booking system",
    text: "I need an appointment booking system.",
  },
  {
    icon: Headset,
    label: "Help with customer support",
    text: "I want an AI solution for customer support.",
  },
];
export function IdeaStart({
  onChoose,
  disabled,
}: {
  onChoose: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="idea-start">
      <span className="eyebrow accent">PROJECT DISCOVERY / 01</span>
      <h1>
        Let’s give your idea
        <br />a clear direction.
      </h1>
      <p>
        Describe what you want to build, or the problem you want to solve. We’ll
        work through the details and shape a practical project brief.
      </p>
      <div className="start-divider">
        <span>A PLACE TO START</span>
      </div>
      <div className="starter-grid">
        {starters.map(({ icon: Icon, label, text }) => (
          <button
            key={label}
            disabled={disabled}
            onClick={() => onChoose(text)}
          >
            <Icon size={19} />
            <span>{label}</span>
            <ArrowUpRight size={15} />
          </button>
        ))}
      </div>
      <div className="expectations">
        <span>
          01 <b>Share your idea</b>
        </span>
        <span>
          02 <b>Work through the details</b>
        </span>
        <span>
          03 <b>Leave with a brief</b>
        </span>
      </div>
    </div>
  );
}
