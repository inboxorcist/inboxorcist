import * as React from "react";
import { X, Check, ChevronsUpDown, Globe, Mail } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface MultiSelectOption {
  value: string;
  label: string;
}

/**
 * Parse a prefixed value (e.g., "domain:github.com" or "email:user@example.com")
 * Returns type and display label
 */
function parseChipValue(value: string): { type: "domain" | "email" | "other"; displayLabel: string } {
  if (value.startsWith("domain:")) {
    const domain = value.slice(7);
    return { type: "domain", displayLabel: `@${domain}` };
  }
  if (value.startsWith("email:")) {
    const email = value.slice(6);
    return { type: "email", displayLabel: email };
  }
  return { type: "other", displayLabel: value };
}

interface MultiSelectProps {
  options: MultiSelectOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  className?: string;
  isLoading?: boolean;
  onSearchChange?: (search: string) => void;
  icon?: React.ReactNode;
}

export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  emptyMessage = "No results found.",
  className,
  isLoading = false,
  onSearchChange,
  icon,
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");

  const handleSearchChange = (value: string) => {
    setSearch(value);
    onSearchChange?.(value);
  };

  const handleSelect = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const handleRemove = (value: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(selected.filter((v) => v !== value));
  };

  const handleClearAll = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onChange([]);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "justify-between font-normal",
            selected.length === 0 && "text-muted-foreground",
            className
          )}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {icon && <span className="shrink-0">{icon}</span>}
            {selected.length === 0 ? (
              <span className="truncate">{placeholder}</span>
            ) : selected.length === 1 ? (
              <span className="truncate">{selected[0]}</span>
            ) : (
              <span className="truncate">{selected.length} selected</span>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0 ml-2">
            {selected.length > 0 && (
              <span
                role="button"
                tabIndex={0}
                className="cursor-pointer"
                onClick={handleClearAll}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                    onChange([]);
                    setOpen(false);
                  }
                }}
              >
                <X className="h-4 w-4 opacity-50 hover:opacity-100" />
              </span>
            )}
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command shouldFilter={!onSearchChange}>
          <CommandInput
            placeholder={searchPlaceholder}
            value={search}
            onValueChange={handleSearchChange}
          />
          <CommandList>
            {isLoading ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Loading...
              </div>
            ) : (
              <>
                <CommandEmpty>{emptyMessage}</CommandEmpty>
                <CommandGroup>
                  {options.map((option) => (
                    <CommandItem
                      key={option.value}
                      value={option.value}
                      onSelect={() => handleSelect(option.value)}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          selected.includes(option.value)
                            ? "opacity-100"
                            : "opacity-0"
                        )}
                      />
                      <span className="truncate">{option.label}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
        {selected.length > 0 && (
          <div className="border-t p-2">
            <div className="flex flex-wrap gap-1.5">
              {selected.map((value) => {
                const { type, displayLabel } = parseChipValue(value);
                return (
                  <Badge
                    key={value}
                    variant="secondary"
                    className={cn(
                      "text-xs max-w-[200px] gap-1 pr-1",
                      type === "domain" && "bg-purple-500/20 text-purple-300 hover:bg-purple-500/30",
                      type === "email" && "bg-blue-500/20 text-blue-300 hover:bg-blue-500/30"
                    )}
                  >
                    {type === "domain" && <Globe className="h-3 w-3 shrink-0" />}
                    {type === "email" && <Mail className="h-3 w-3 shrink-0" />}
                    <span className="truncate">{displayLabel}</span>
                    <span
                      role="button"
                      tabIndex={0}
                      className="ml-0.5 rounded-full p-0.5 hover:bg-background/50 cursor-pointer"
                      onClick={(e) => handleRemove(value, e)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          handleRemove(value, e as unknown as React.MouseEvent);
                        }
                      }}
                    >
                      <X className="h-3 w-3" />
                    </span>
                  </Badge>
                );
              })}
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
