import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { flexRender, type Table as ReactTable } from "@tanstack/react-table";
import { cn } from "@/lib/utils";
import { ArrowUp, ArrowDown } from "@phosphor-icons/react";
import { ScrollArea, ScrollBar } from "../ui/scroll-area";

type TableDataViewProps = {
  table: ReactTable<any>;
  tableData: { rows: any[][] } | undefined;
  isLoading: boolean;
};

export function TableDataView({
  table,
  tableData,
  isLoading,
}: TableDataViewProps) {
  if (isLoading) {
    return (
      <div className="p-4 space-y-2">
        <Skeleton className="h-12 w-full" />
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    );
  }

  if (!tableData) {
    return (
      <div className="text-muted-foreground flex items-center justify-center h-full">
        <p>Select a table to view its data</p>
      </div>
    );
  }

  return (
    <ScrollArea className="w-full whitespace-nowrap">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className={cn(
                    "sticky top-0 z-10 bg-muted first:rounded-tl-md last:rounded-tr-md",
                    header.column.getCanSort() && "cursor-pointer select-none"
                  )}
                  onClick={header.column.getToggleSortingHandler()}
                >
                  <div className="flex items-center gap-2">
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                    {{
                      asc: <ArrowUp className="h-4 w-4" />,
                      desc: <ArrowDown className="h-4 w-4" />,
                    }[header.column.getIsSorted() as string] ?? null}
                  </div>
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
