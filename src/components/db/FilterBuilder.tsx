import type { Column } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X, Plus } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

const operators = [
  "ILIKE",
  "=",
  "<>",
  ">",
  "<",
  ">=",
  "<=",
  "IS NULL",
  "IS NOT NULL",
];

export type RichFilter = {
  id: string;
  operator: string;
  value: string;
};

type FilterBuilderProps<TData> = {
  columns: Column<TData, unknown>[];
  filters: RichFilter[];
  onFiltersChange: (filters: RichFilter[]) => void;
  logicalOperator: "AND" | "OR";
  onLogicalOperatorChange: (operator: "AND" | "OR") => void;
  className?: string;
};

export function FilterBuilder<TData>({
  columns,
  filters,
  onFiltersChange,
  logicalOperator,
  onLogicalOperatorChange,
  className,
}: FilterBuilderProps<TData>) {
  const hasColumns = columns.length > 0;

  const handleAddFilter = () => {
    const firstColumn = columns[0];
    if (firstColumn) {
      onFiltersChange([
        ...filters,
        { id: firstColumn.id, operator: "ILIKE", value: "" },
      ]);
    }
  };

  const handleRemoveFilter = (index: number) => {
    onFiltersChange(filters.filter((_, i) => i !== index));
  };

  const handleColumnChange = (index: number, newColumnId: string) => {
    onFiltersChange(
      filters.map((filter, i) =>
        i === index ? { ...filter, id: newColumnId } : filter
      )
    );
  };

  const handleOperatorChange = (index: number, newOperator: string) => {
    onFiltersChange(
      filters.map((filter, i) =>
        i === index ? { ...filter, operator: newOperator, value: "" } : filter
      )
    );
  };

  const handleValueChange = (index: number, newValue: string) => {
    onFiltersChange(
      filters.map((filter, i) =>
        i === index ? { ...filter, value: newValue } : filter
      )
    );
  };

  return (
    <div className={cn("p-4 bg-background", className)}>
      <div className="flex items-center gap-2 mb-4">
        <Select
          value={logicalOperator}
          onValueChange={(value) =>
            onLogicalOperatorChange(value as "AND" | "OR")
          }
        >
          <SelectTrigger className="w-[100px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="AND">AND</SelectItem>
            <SelectItem value="OR">OR</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">
          Combine filters with this logical operator.
        </span>
      </div>
      <div className="space-y-2">
        {filters.map((filter, index) => {
          const operatorRequiresValue =
            filter.operator !== "IS NULL" && filter.operator !== "IS NOT NULL";
          return (
            <div key={index} className="flex items-center gap-2">
              <Select
                value={filter.id}
                onValueChange={(newColumnId) =>
                  handleColumnChange(index, newColumnId)
                }
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select column" />
                </SelectTrigger>
                <SelectContent>
                  {columns.map((column) => (
                    <SelectItem key={column.id} value={column.id}>
                      {column.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={filter.operator}
                onValueChange={(newOperator) =>
                  handleOperatorChange(index, newOperator)
                }
              >
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {operators.map((op) => (
                    <SelectItem key={op} value={op}>
                      {op}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={filter.value}
                onChange={(e) => handleValueChange(index, e.target.value)}
                placeholder="Filter value"
                className="flex-grow"
                disabled={!operatorRequiresValue}
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleRemoveFilter(index)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          );
        })}
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={handleAddFilter}
        disabled={!hasColumns}
        className="mt-4"
      >
        <Plus className="mr-2 h-4 w-4" />
        Add filter
      </Button>
    </div>
  );
}
