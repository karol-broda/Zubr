import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CaretUpDown, Plus, Trash } from "@phosphor-icons/react";

interface ConnectionManagerProps {
  connections: Record<string, string>;
  onSelect: (uri: string) => void;
  onSave: (name: string, uri: string) => void;
  onDelete: (name: string) => void;
  currentUri: string;
}

export function ConnectionManager({
  connections,
  onSelect,
  onSave,
  onDelete,
  currentUri,
}: ConnectionManagerProps) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newConnectionName, setNewConnectionName] = useState("");

  const handleSave = () => {
    if (newConnectionName) {
      onSave(newConnectionName, currentUri);
      setNewConnectionName("");
      setDialogOpen(false);
    }
  };

  return (
    <>
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            className="w-56 justify-between"
          >
            {Object.entries(connections).find(
              ([_, uri]) => uri === currentUri
            )?.[0] || "Select Connection"}
            <CaretUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-0">
          <Command>
            <CommandInput placeholder="Search connections..." />
            <CommandList>
              <CommandEmpty>No connections found.</CommandEmpty>
              <CommandGroup>
                {Object.entries(connections).map(([name, uri]) => (
                  <CommandItem
                    key={name}
                    onSelect={() => {
                      onSelect(uri);
                      setPopoverOpen(false);
                    }}
                    className="flex justify-between items-center"
                  >
                    <span>{name}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(name);
                      }}
                    >
                      <Trash className="h-4 w-4 text-destructive" />
                    </Button>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
            <div className="p-2 border-t">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setDialogOpen(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Save Current Connection
              </Button>
            </div>
          </Command>
        </PopoverContent>
      </Popover>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Connection</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Input
              placeholder="Connection Name"
              value={newConnectionName}
              onChange={(e) => setNewConnectionName(e.target.value)}
            />
            <Input value={currentUri} readOnly disabled />
          </div>
          <DialogFooter>
            <Button onClick={handleSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
