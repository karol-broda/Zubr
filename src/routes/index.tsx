import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { Store } from "tauri-plugin-store-api";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  type SortingState,
} from "@tanstack/react-table";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ThemeToggleButton } from "@/components/db/ThemeToggleButton";
import { ConnectionManager } from "@/components/db/ConnectionManager";
import { DbSidebar } from "@/components/db/DbSidebar";
import { TableDataView } from "@/components/db/TableDataView";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import DataCell from "@/components/db/DataCell";
import { FilterBuilder, type RichFilter } from "@/components/db/FilterBuilder";
import { CaretLeft, CaretRight, Funnel } from "@phosphor-icons/react";
import { ChangesDialog } from "@/components/db/ChangesDialog";

const connectionsStore = new Store(".connections.dat");

type ColumnInfo = {
  name: string;
  pg_type: string;
  is_nullable: boolean;
};

type TableData = {
  columns: ColumnInfo[];
  rows: any[][];
};

interface Change {
  pks: Record<string, any>;
  changes: Record<string, any>;
  original: Record<string, any>;
}

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const [uri, setUri] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [selectedSchema, setSelectedSchema] = useState<string | null>(null);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [limit, setLimit] = useState(100);
  const [offset, setOffset] = useState(0);
  const [draftFilters, setDraftFilters] = useState<RichFilter[]>([]);
  const [draftLogicalOperator, setDraftLogicalOperator] = useState<
    "AND" | "OR"
  >("AND");
  const [activeFilters, setActiveFilters] = useState<RichFilter[]>([]);
  const [activeLogicalOperator, setActiveLogicalOperator] = useState<
    "AND" | "OR"
  >("AND");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [isFilterPopoverOpen, setIsFilterPopoverOpen] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<Change[]>([]);
  const [isChangesDialogOpen, setChangesDialogOpen] = useState(false);
  const [savedConnections, setSavedConnections] = useState<
    Record<string, string>
  >({});

  useEffect(() => {
    const loadConnections = async () => {
      const connections =
        await connectionsStore.get<Record<string, string>>("connections");
      if (connections) {
        setSavedConnections(connections);
      }
    };
    loadConnections();
  }, []);

  const {
    data: schemas,
    mutate: fetchSchemas,
    isPending: schemasLoading,
    error: schemasError,
  } = useMutation<string[], Error, string>({
    mutationFn: (connectionUri: string) =>
      invoke("list_schemas", { uri: connectionUri }),
    onSuccess: () => {
      setIsConnected(true);
      setSelectedSchema(null);
      setSelectedTable(null);
    },
    onError: () => {
      setIsConnected(false);
    },
  });

  const {
    data: tables,
    refetch: fetchTables,
    isPending: tablesLoading,
  } = useQuery<string[], Error>({
    queryKey: ["tables", uri, selectedSchema],
    queryFn: () =>
      invoke("list_tables_by_schema", { uri, schema: selectedSchema }),
    enabled: !!selectedSchema,
  });

  const { data: primaryKeys, isPending: primaryKeysLoading } = useQuery<
    string[],
    Error
  >({
    queryKey: ["primaryKeys", uri, selectedSchema, selectedTable],
    queryFn: () =>
      invoke("get_primary_keys", {
        uri,
        schema: selectedSchema,
        table: selectedTable,
      }),
    enabled: !!selectedTable,
  });

  const {
    data: tableData,
    refetch: fetchTableData,
    isPending: tableDataLoading,
  } = useQuery<TableData, Error>({
    queryKey: [
      "tableData",
      uri,
      selectedSchema,
      selectedTable,
      limit,
      offset,
      activeFilters,
      activeLogicalOperator,
      sorting,
    ],
    queryFn: () => {
      const filtersForBackend = activeFilters.map((f) => ({
        column: f.id,
        operator: f.operator,
        value: f.value as string,
      }));
      const sortsForBackend = sorting.map((s) => ({
        column: s.id,
        direction: s.desc ? "desc" : "asc",
      }));
      return invoke("get_table_data", {
        uri,
        schema: selectedSchema,
        table: selectedTable,
        limit,
        offset,
        filters: filtersForBackend.length > 0 ? filtersForBackend : null,
        logicalOperator: activeLogicalOperator,
        sorts: sortsForBackend.length > 0 ? sortsForBackend : null,
      });
    },
    enabled: !!selectedTable,
  });

  const updateRowsMutation = useMutation({
    mutationFn: (changes: Change[]) => {
      if (!selectedSchema || !selectedTable) {
        throw new Error("no table selected");
      }
      console.log("Sending changes to backend:", changes);
      return invoke("update_rows", {
        uri,
        schema: selectedSchema,
        table: selectedTable,
        changes,
      });
    },
    onSuccess: () => {
      console.log("Update successful, refetching data...");
      setPendingChanges([]);
      fetchTableData();
    },
    onError: (error) => {
      console.error("Update failed:", error);
      // You might want to add a user-facing error message here
      // For example, using a toast notification library
      alert(`Failed to apply changes: ${error.message}`);
    },
  });

  const handleSaveConnection = async (name: string, connectionUri: string) => {
    const newConnections = { ...savedConnections, [name]: connectionUri };
    setSavedConnections(newConnections);
    await connectionsStore.set("connections", newConnections);
    await connectionsStore.save();
  };

  const handleDeleteConnection = async (name: string) => {
    const newConnections = { ...savedConnections };
    delete newConnections[name];
    setSavedConnections(newConnections);
    await connectionsStore.set("connections", newConnections);
    await connectionsStore.save();
  };

  useEffect(() => {
    if (selectedSchema) {
      fetchTables();
      setSelectedTable(null);
      setOffset(0);
    }
  }, [selectedSchema, fetchTables]);

  useEffect(() => {
    if (selectedTable) {
      setOffset(0);
      setActiveFilters([]);
      setDraftFilters([]);
      setPendingChanges([]);
      fetchTableData();
    }
  }, [selectedTable, fetchTableData]);

  const handleCellUpdate = (
    row: Record<string, any>,
    columnId: string,
    value: any,
  ) => {
    if (!primaryKeys) return;

    const pks: Record<string, any> = {};
    primaryKeys.forEach((pk) => {
      pks[pk] = row[pk];
    });

    const pkString = JSON.stringify(pks);

    setPendingChanges((prev) => {
      const existingChangeIndex = prev.findIndex(
        (c) => JSON.stringify(c.pks) === pkString,
      );

      if (existingChangeIndex !== -1) {
        const existingChange = prev[existingChangeIndex];
        const newChanges = { ...existingChange.changes, [columnId]: value };
        if (String(existingChange.original[columnId]) === String(value)) {
          delete newChanges[columnId];
        }
        if (Object.keys(newChanges).length === 0) {
          return prev.filter((_, i) => i !== existingChangeIndex);
        }
        const updatedChange = { ...existingChange, changes: newChanges };
        return [
          ...prev.slice(0, existingChangeIndex),
          updatedChange,
          ...prev.slice(existingChangeIndex + 1),
        ];
      } else {
        const originalRow = data.find((d) => {
          const rowPks: Record<string, any> = {};
          primaryKeys.forEach((pk) => {
            rowPks[pk] = d[pk];
          });
          return JSON.stringify(rowPks) === pkString;
        });

        return [
          ...prev,
          {
            pks,
            changes: { [columnId]: value },
            original: originalRow || {},
          },
        ];
      }
    });
  };

  const columns = useMemo<ColumnDef<any>[]>(() => {
    if (!tableData?.columns) return [];
    return tableData.columns.map((colInfo) => ({
      accessorKey: colInfo.name,
      header: colInfo.name,
      cell: ({ getValue, row, column }) => {
        const pks: Record<string, any> = {};
        if (primaryKeys) {
          primaryKeys.forEach((pk) => {
            pks[pk] = row.original[pk];
          });
        }
        const pkString = JSON.stringify(pks);

        const pendingChange = pendingChanges.find(
          (c) => JSON.stringify(c.pks) === pkString,
        );
        const isPending = !!pendingChange && column.id in pendingChange.changes;

        return (
          <DataCell
            value={getValue()}
            columnType={colInfo.pg_type}
            isNullable={colInfo.is_nullable}
            isPending={isPending}
            onUpdate={(newValue) =>
              handleCellUpdate(row.original, column.id, newValue)
            }
          />
        );
      },
    }));
  }, [tableData, primaryKeys, pendingChanges]);

  const data = useMemo(() => {
    if (!tableData?.rows) return [];

    const baseData = tableData.rows.map((row) => {
      const rowObj: { [key: string]: any } = {};
      tableData.columns.forEach((col, i) => {
        rowObj[col.name] = row[i];
      });
      return rowObj;
    });

    if (pendingChanges.length === 0) {
      return baseData;
    }

    if (!primaryKeys) return baseData;

    return baseData.map((row) => {
      const pks: Record<string, any> = {};
      primaryKeys.forEach((pk) => {
        pks[pk] = row[pk];
      });
      const pkString = JSON.stringify(pks);

      const correspondingChange = pendingChanges.find(
        (c) => JSON.stringify(c.pks) === pkString,
      );

      if (correspondingChange) {
        return { ...row, ...correspondingChange.changes };
      }
      return row;
    });
  }, [tableData, pendingChanges, primaryKeys]);

  const table = useReactTable({
    data,
    columns,
    state: {
      columnFilters: activeFilters,
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    manualFiltering: true,
    manualSorting: true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchSchemas(uri);
  };

  const handlePreviousPage = () => {
    setOffset((prev) => Math.max(0, prev - limit));
  };

  const handleNextPage = () => {
    setOffset((prev) => prev + limit);
  };

  const handleApplyFilters = () => {
    setActiveFilters(draftFilters);
    setActiveLogicalOperator(draftLogicalOperator);
    setIsFilterPopoverOpen(false);
  };

  const handleApplyChanges = () => {
    updateRowsMutation.mutate(pendingChanges);
    setChangesDialogOpen(false);
  };

  return (
    <SidebarProvider>
      {isConnected && (
        <DbSidebar
          schemas={schemas}
          selectedSchema={selectedSchema}
          setSelectedSchema={setSelectedSchema}
          schemasLoading={schemasLoading}
          tables={tables}
          selectedTable={selectedTable}
          setSelectedTable={setSelectedTable}
          tablesLoading={tablesLoading}
        />
      )}
      <SidebarInset className="min-w-0">
        <div className="bg-background text-foreground flex flex-col">
          <div className="p-4 border-b flex items-center gap-4 flex-shrink-0 justify-between">
            <ConnectionManager
              connections={savedConnections}
              onSelect={setUri}
              onSave={handleSaveConnection}
              onDelete={handleDeleteConnection}
              currentUri={uri}
            />
            <form
              onSubmit={handleSubmit}
              className="flex items-center gap-2 w-full"
            >
              <Input
                type="text"
                value={uri}
                onChange={(e) => setUri(e.target.value)}
                placeholder="postgresql://user:password@host:port/database"
                className="min-w-96"
              />
              <Button type="submit" disabled={isConnected || schemasLoading}>
                {schemasLoading
                  ? "Connecting..."
                  : isConnected
                    ? "Connected"
                    : "Connect"}
              </Button>
            </form>
            <ThemeToggleButton />
          </div>
          {schemasError && (
            <div className="text-destructive p-4 border-b flex-shrink-0">
              Error: {schemasError.message}
            </div>
          )}

          <div className="p-4 flex flex-col min-w-0 flex-1 overflow-hidden">
            {selectedTable ? (
              <>
                <div className="flex-shrink-0 flex items-center gap-4 mb-4">
                  <Popover
                    open={isFilterPopoverOpen}
                    onOpenChange={setIsFilterPopoverOpen}
                  >
                    <PopoverTrigger asChild>
                      <Button variant="outline">
                        <Funnel className="mr-2 h-4 w-4" />
                        Filter
                        {activeFilters.length > 0 && (
                          <span className="ml-2 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-primary-foreground bg-primary rounded-full">
                            {activeFilters.length}
                          </span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <FilterBuilder
                        columns={table.getAllLeafColumns()}
                        filters={draftFilters}
                        onFiltersChange={setDraftFilters}
                        logicalOperator={draftLogicalOperator}
                        onLogicalOperatorChange={setDraftLogicalOperator}
                      />
                      <div className="p-4 border-t flex justify-end">
                        <Button onClick={handleApplyFilters}>
                          Apply Filters
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>

                  <div className="flex items-center gap-2">
                    <label htmlFor="limit" className="text-sm font-medium">
                      Limit
                    </label>
                    <Input
                      id="limit"
                      type="number"
                      value={limit}
                      onChange={(e) => setLimit(Number(e.target.value))}
                      className="w-24"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label htmlFor="offset" className="text-sm font-medium">
                      Offset
                    </label>
                    <Input
                      id="offset"
                      type="number"
                      value={offset}
                      onChange={(e) => setOffset(Number(e.target.value))}
                      className="w-24"
                    />
                  </div>

                  {pendingChanges.length > 0 && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setChangesDialogOpen(true)}
                      >
                        Show Changes ({pendingChanges.length})
                      </Button>
                      <Button
                        onClick={handleApplyChanges}
                        disabled={updateRowsMutation.isPending}
                      >
                        {updateRowsMutation.isPending
                          ? "Applying..."
                          : "Apply Changes"}
                      </Button>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-h-0 border rounded-md overflow-hidden">
                  <TableDataView
                    table={table}
                    tableData={tableData}
                    isLoading={tableDataLoading || primaryKeysLoading}
                  />
                </div>
                <div className="flex items-center justify-end gap-2 mt-4 flex-shrink-0">
                  <Button onClick={handlePreviousPage} disabled={offset === 0}>
                    <CaretLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <Button
                    onClick={handleNextPage}
                    disabled={!tableData || tableData.rows.length < limit}
                  >
                    Next
                    <CaretRight className="h-4 w-4" />
                  </Button>
                </div>
              </>
            ) : (
              <div className="text-muted-foreground flex items-center justify-center flex-1">
                <p>Select a table to view its data</p>
              </div>
            )}
          </div>
        </div>
      </SidebarInset>
      <ChangesDialog
        isOpen={isChangesDialogOpen}
        onOpenChange={setChangesDialogOpen}
        changes={pendingChanges}
        onApply={handleApplyChanges}
      />
    </SidebarProvider>
  );
}
