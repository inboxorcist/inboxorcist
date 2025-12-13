import * as React from "react";
import { X, Check, ChevronsUpDown } from "lucide-react";
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
            <div className="flex flex-wrap gap-1">
              {selected.map((value) => (
                <Badge
                  key={value}
                  variant="secondary"
                  className="text-xs max-w-[150px]"
                >
                  <span className="truncate">{value}</span>
                  <X
                    className="ml-1 h-3 w-3 cursor-pointer hover:text-destructive"
                    onClick={(e) => handleRemove(value, e)}
                  />
                </Badge>
              ))}
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
