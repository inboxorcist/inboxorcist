import { CheckCircle2 } from "lucide-react";

export type ExorcismCardColor = "purple" | "yellow" | "green" | "pink" | "blue" | "orange";

interface ExorcismCardProps {
  icon: React.ElementType;
  title: string;
  description: string;
  count: number | string;
  color: ExorcismCardColor;
  onClick?: () => void;
  disabled?: boolean;
  selected?: boolean;
}

function formatNumber(num: number | null | undefined): string {
  if (num == null) return "0";
  return num.toLocaleString();
}

const colorStyles = {
  purple: {
    bg: "bg-purple-50 dark:bg-purple-950/30",
    icon: "bg-purple-500",
    hover: "hover:border-purple-300 dark:hover:border-purple-700 hover:shadow-purple-100 dark:hover:shadow-purple-900/20",
    selected: "border-purple-500 ring-2 ring-purple-500/20",
  },
  yellow: {
    bg: "bg-yellow-50 dark:bg-yellow-950/30",
    icon: "bg-yellow-500",
    hover: "hover:border-yellow-300 dark:hover:border-yellow-700 hover:shadow-yellow-100 dark:hover:shadow-yellow-900/20",
    selected: "border-yellow-500 ring-2 ring-yellow-500/20",
  },
  green: {
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    icon: "bg-emerald-500",
    hover: "hover:border-emerald-300 dark:hover:border-emerald-700 hover:shadow-emerald-100 dark:hover:shadow-emerald-900/20",
    selected: "border-emerald-500 ring-2 ring-emerald-500/20",
  },
  pink: {
    bg: "bg-pink-50 dark:bg-pink-950/30",
    icon: "bg-pink-500",
    hover: "hover:border-pink-300 dark:hover:border-pink-700 hover:shadow-pink-100 dark:hover:shadow-pink-900/20",
    selected: "border-pink-500 ring-2 ring-pink-500/20",
  },
  blue: {
    bg: "bg-blue-50 dark:bg-blue-950/30",
    icon: "bg-blue-500",
    hover: "hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-blue-100 dark:hover:shadow-blue-900/20",
    selected: "border-blue-500 ring-2 ring-blue-500/20",
  },
  orange: {
    bg: "bg-orange-50 dark:bg-orange-950/30",
    icon: "bg-orange-500",
    hover: "hover:border-orange-300 dark:hover:border-orange-700 hover:shadow-orange-100 dark:hover:shadow-orange-900/20",
    selected: "border-orange-500 ring-2 ring-orange-500/20",
  },
};

export function ExorcismCard({
  icon: Icon,
  title,
  description,
  count,
  color,
  onClick,
  disabled,
  selected,
}: ExorcismCardProps) {
  const styles = colorStyles[color];

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`relative text-left p-5 rounded-xl border-2 transition-all duration-200 ${styles.bg} ${
        selected ? styles.selected : "border-transparent"
      } ${
        disabled
          ? "cursor-not-allowed"
          : `cursor-pointer ${styles.hover} hover:shadow-lg`
      }`}
    >
      {disabled && (
        <div className="absolute inset-0 bg-white/60 dark:bg-black/50 rounded-xl backdrop-blur-[1px]" />
      )}
      {selected && (
        <div className="absolute top-3 right-3 z-10">
          <CheckCircle2 className="h-5 w-5 text-primary" />
        </div>
      )}
      <div className={`relative w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${styles.icon}`}>
        <Icon className="h-6 w-6 text-white" />
      </div>
      <h3 className={`relative font-semibold mb-1 text-foreground ${disabled ? "opacity-60" : ""}`}>{title}</h3>
      <p className={`relative text-sm mb-3 text-muted-foreground ${disabled ? "opacity-60" : ""}`}>{description}</p>
      <p className={`relative text-2xl font-bold text-foreground ${disabled ? "opacity-60" : ""}`}>
        {typeof count === "number" ? formatNumber(count) : count}
      </p>
    </button>
  );
}
