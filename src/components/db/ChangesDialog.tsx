import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Change {
  pks: Record<string, any>;
  changes: Record<string, any>;
  original: Record<string, any>;
}

interface ChangesDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  changes: Change[];
  onApply: () => void;
}

export function ChangesDialog({
  isOpen,
  onOpenChange,
  changes,
  onApply,
}: ChangesDialogProps) {
  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-4xl h-full flex flex-col">
        <AlertDialogHeader>
          <AlertDialogTitle>Pending Changes</AlertDialogTitle>
          <AlertDialogDescription>
            Review the changes before applying them to the database.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <ScrollArea className="max-h-96 flex-grow">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Primary Key</TableHead>
                <TableHead>Column</TableHead>
                <TableHead>Old Value</TableHead>
                <TableHead>New Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {changes.flatMap((change) =>
                Object.entries(change.changes).map(([columnName, newValue]) => (
                  <TableRow key={`${JSON.stringify(change.pks)}-${columnName}`}>
                    <TableCell>
                      {Object.entries(change.pks)
                        .map(([key, value]) => `${key}: ${value}`)
                        .join(", ")}
                    </TableCell>
                    <TableCell>{columnName}</TableCell>
                    <TableCell>{String(change.original[columnName])}</TableCell>
                    <TableCell>{String(newValue)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onApply}>Apply Changes</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
