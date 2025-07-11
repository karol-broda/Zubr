import { useState, useEffect, useMemo } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import JsonView from "@uiw/react-json-view";
import { vscodeTheme } from "@uiw/react-json-view/vscode";
import VectorVisualization from "./VectorVisualization";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "../ui/calendar";
import { format } from "date-fns";
import { CalendarIcon } from "@phosphor-icons/react";
import { Button } from "../ui/button";
import { JsonEditor } from "json-edit-react";
import { useTheme } from "@/components/theme-provider";

const catppuccinMocha = {
  displayName: "Catppuccin Mocha",
  styles: {
    container: {
      backgroundColor: "#1e1e2e",
      fontFamily: "monospace",
    },
    property: "#cdd6f4",
    bracket: "#cdd6f4",
    itemCount: "#a6adc8",
    string: "#fab387",
    number: "#89b4fa",
    boolean: "#cba6f7",
    null: "#f38ba8",
    input: ["#cdd6f4", { fontSize: "90%" }],
    inputHighlight: "#313244",
    error: "#f38ba8",
    iconCollection: "#cdd6f4",
    iconEdit: "#a6e3a1",
    iconDelete: "#f38ba8",
    iconAdd: "#a6e3a1",
    iconCopy: "#89b4fa",
    iconOk: "#a6e3a1",
    iconCancel: "#f38ba8",
  },
};

const catppuccinLatte = {
  displayName: "Catppuccin Latte",
  styles: {
    container: {
      backgroundColor: "#eff1f5",
      fontFamily: "monospace",
    },
    property: "#4c4f69",
    bracket: "#4c4f69",
    itemCount: "#6c6f85",
    string: "#fe640b",
    number: "#1e66f5",
    boolean: "#8839ef",
    null: "#d20f39",
    input: ["#4c4f69", { fontSize: "90%" }],
    inputHighlight: "#ccd0da",
    error: "#d20f39",
    iconCollection: "#4c4f69",
    iconEdit: "#40a02b",
    iconDelete: "#d20f39",
    iconAdd: "#40a02b",
    iconCopy: "#1e66f5",
    iconOk: "#40a02b",
    iconCancel: "#d20f39",
  },
};

function isJsonString(str: any) {
  if (typeof str !== "string") return false;
  try {
    const value = JSON.parse(str);
    return typeof value === "object" && value !== null;
  } catch (e) {
    return false;
  }
}

function isVector(value: any): value is number[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => typeof item === "number")
  );
}

const DateTimeEditor = ({
  value: initialValue,
  onUpdate,
  onCancel,
  columnType,
}: {
  value: string | null;
  onUpdate: (value: string | null) => void;
  onCancel: () => void;
  columnType: string;
}) => {
  const [date, setDate] = useState<Date | null>(
    initialValue ? new Date(initialValue) : null
  );

  const handleDateSelect = (selectedDate: Date | undefined) => {
    if (selectedDate) {
      const newDate = date ? new Date(date) : new Date();
      newDate.setFullYear(
        selectedDate.getFullYear(),
        selectedDate.getMonth(),
        selectedDate.getDate()
      );
      setDate(newDate);
    }
  };

  const handleTimeChange = (timeValue: string) => {
    if (!timeValue) return;
    const [hours, minutes] = timeValue.split(":").map(Number);
    const newDate = date ? new Date(date) : new Date();
    newDate.setHours(hours, minutes);
    setDate(newDate);
  };

  const handleApply = () => {
    if (date) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const hours = String(date.getHours()).padStart(2, "0");
      const minutes = String(date.getMinutes()).padStart(2, "0");
      const seconds = String(date.getSeconds()).padStart(2, "0");
      if (columnType === "date") {
        onUpdate(`${year}-${month}-${day}`);
      } else {
        onUpdate(`${year}-${month}-${day} ${hours}:${minutes}:${seconds}`);
      }
    } else {
      onUpdate(null);
    }
  };

  const isDateOnly = columnType === "date";

  return (
    <Popover open onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-start font-normal">
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? (
            isDateOnly ? (
              format(date, "PPP")
            ) : (
              format(date, "PPP p")
            )
          ) : (
            <span>pick a date</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <Calendar
          mode="single"
          selected={date || undefined}
          onSelect={handleDateSelect}
          initialFocus
        />
        {!isDateOnly && (
          <div className="p-3 border-t">
            <Input
              type="time"
              value={date ? format(date, "HH:mm") : ""}
              onChange={(e) => handleTimeChange(e.target.value)}
            />
          </div>
        )}
        <div className="p-2 border-t flex justify-end space-x-2">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            cancel
          </Button>
          <Button size="sm" onClick={handleApply}>
            apply
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

const JsonEditorDialog = ({
  open,
  initialValue,
  onUpdate,
  onCancel,
  theme,
}: {
  open: boolean;
  initialValue: any;
  onUpdate: (value: any) => void;
  onCancel: () => void;
  theme: "light" | "dark" | "system";
}) => {
  const [jsonData, setJsonData] = useState(initialValue);
  const editorTheme = theme === "dark" ? catppuccinMocha : catppuccinLatte;
  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <AlertDialogContent className="max-w-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>Edit JSON</AlertDialogTitle>
        </AlertDialogHeader>
        <div className="border rounded-md p-2 bg-background max-h-[60vh] overflow-auto">
          <JsonEditor
            data={jsonData}
            setData={setJsonData}
            theme={editorTheme}
          />
        </div>
        <AlertDialogFooter>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onUpdate(jsonData);
            }}
          >
            Apply
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

const DataCell = ({
  value: initialValue,
  columnType,
  isNullable,
  onUpdate,
  isPending,
}: {
  value: any;
  columnType: string;
  isNullable: boolean;
  onUpdate: (value: any) => void;
  isPending: boolean;
}) => {
  const [value, setValue] = useState(initialValue);
  const [isEditing, setIsEditing] = useState(false);
  const { theme } = useTheme();

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  const handleUpdate = () => {
    setIsEditing(false);
    if (value !== initialValue) {
      onUpdate(value);
    }
  };

  const handleCheckboxChange = (checked: boolean | null) => {
    setValue(checked);
    onUpdate(checked);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleUpdate();
    }
    if (e.key === "Escape") {
      setValue(initialValue);
      setIsEditing(false);
    }
  };

  const isEditable = true;

  const parsedValue = useMemo(() => {
    if (typeof value === "object") {
      return value;
    }
    if (isJsonString(value)) {
      try {
        return JSON.parse(value as string);
      } catch (e) {
        /* ignore */
      }
    }
    return value;
  }, [value]);

  const isVectorValue = useMemo(() => isVector(parsedValue), [parsedValue]);
  const isJsonObject = useMemo(
    () =>
      typeof parsedValue === "object" && parsedValue !== null && !isVectorValue,
    [parsedValue, isVectorValue]
  );

  const cellDisplay = (
    <div
      onDoubleClick={() => setIsEditing(isEditable)}
      className={`truncate h-full flex items-center max-w-[250px] ${
        isEditable ? "cursor-pointer" : ""
      } ${isPending ? "bg-yellow-200/50" : ""}`}
    >
      {value === null || value === undefined ? (
        <i className="text-muted-foreground">NULL</i>
      ) : typeof value === "boolean" ? (
        <div className="flex items-center h-full">
          <Checkbox checked={value} disabled />
        </div>
      ) : isJsonObject ? (
        <span className="font-mono">{JSON.stringify(value)}</span>
      ) : (
        String(value)
      )}
    </div>
  );

  if (isEditing) {
    if (columnType === "json" || columnType === "jsonb") {
      return (
        <>
          {cellDisplay}
          <JsonEditorDialog
            open={isEditing}
            initialValue={value}
            onUpdate={(newValue) => {
              onUpdate(newValue);
              setIsEditing(false);
            }}
            onCancel={() => setIsEditing(false)}
            theme={theme}
          />
        </>
      );
    }
    if (columnType === "bool") {
      return (
        <div className="flex items-center h-full">
          <Select
            value={value === null ? "null" : value ? "true" : "false"}
            onValueChange={(val) => {
              const updatedValue =
                val === "null" ? null : val === "true" ? true : false;
              handleCheckboxChange(updatedValue);
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="true">True</SelectItem>
              <SelectItem value="false">False</SelectItem>
              {isNullable && <SelectItem value="null">NULL</SelectItem>}
            </SelectContent>
          </Select>
        </div>
      );
    }
    if (columnType.startsWith("timestamp") || columnType === "date") {
      return (
        <DateTimeEditor
          value={value}
          onUpdate={(newValue) => {
            setValue(newValue);
            onUpdate(newValue);
            setIsEditing(false);
          }}
          onCancel={() => setIsEditing(false)}
          columnType={columnType}
        />
      );
    }

    if (
      columnType.startsWith("int") ||
      columnType.startsWith("float") ||
      columnType === "numeric" ||
      columnType === "decimal"
    ) {
      return (
        <Input
          type="number"
          value={value === null ? "" : value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={handleUpdate}
          onKeyDown={handleKeyDown}
          autoFocus
          className="h-full"
        />
      );
    }

    return (
      <Input
        value={value === null ? "" : String(value)}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleUpdate}
        onKeyDown={handleKeyDown}
        autoFocus
        className="h-full"
      />
    );
  }

  if (isVectorValue) {
    return (
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <div className="font-mono text-left truncate cursor-pointer hover:bg-muted p-1 rounded-sm w-full h-full max-w-[250px]">
            {`Vector (${parsedValue.length} dimensions)`}
          </div>
        </AlertDialogTrigger>
        <AlertDialogContent className="max-w-4xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Vector Visualization</AlertDialogTitle>
          </AlertDialogHeader>
          <VectorVisualization vector={parsedValue} />
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  const cellWithMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild className="select-none">
        {cellDisplay}
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={() => setIsEditing(true)}>
          Edit
        </DropdownMenuItem>
        {isJsonObject && (
          <AlertDialogTrigger asChild>
            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
              View JSON
            </DropdownMenuItem>
          </AlertDialogTrigger>
        )}
        {isNullable && (
          <DropdownMenuItem onClick={() => onUpdate(null)}>
            Set to NULL
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  if (isJsonObject) {
    return (
      <AlertDialog>
        {cellWithMenu}
        <AlertDialogContent className="max-w-4xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Cell Data</AlertDialogTitle>
          </AlertDialogHeader>
          <div className="max-h-[70vh] overflow-auto rounded-md bg-muted">
            <JsonView value={parsedValue} style={vscodeTheme} />
          </div>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  if (typeof value === "string" && value.length > 50) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{cellWithMenu}</TooltipTrigger>
          <TooltipContent
            side="bottom"
            align="start"
            className="max-w-md break-all"
          >
            {value}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return cellWithMenu;
};

export default DataCell;
