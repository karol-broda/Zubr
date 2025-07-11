import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
} from "@/components/ui/sidebar";

type DbSidebarProps = {
  schemas: string[] | undefined;
  selectedSchema: string | null;
  setSelectedSchema: (schema: string) => void;
  schemasLoading: boolean;

  tables: string[] | undefined;
  selectedTable: string | null;
  setSelectedTable: (table: string) => void;
  tablesLoading: boolean;
};

export function DbSidebar({
  schemas,
  selectedSchema,
  setSelectedSchema,
  schemasLoading,
  tables,
  selectedTable,
  setSelectedTable,
  tablesLoading,
}: DbSidebarProps) {
  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup className="mt-6">
          <SidebarGroupLabel className="select-none">Schemas</SidebarGroupLabel>
          <SidebarGroupContent>
            <Select
              onValueChange={setSelectedSchema}
              value={selectedSchema ?? ""}
              disabled={schemasLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a schema" />
              </SelectTrigger>
              <SelectContent>
                {schemas?.map((schema) => (
                  <SelectItem key={schema} value={schema}>
                    {schema}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SidebarGroupContent>
        </SidebarGroup>

        {selectedSchema && (
          <SidebarGroup>
            <SidebarGroupLabel className="select-none">
              Tables
            </SidebarGroupLabel>
            <SidebarGroupContent>
              {tablesLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : (
                <SidebarMenu>
                  {tables?.map((table) => (
                    <SidebarMenuButton
                      key={table}
                      isActive={selectedTable === table}
                      onClick={() => setSelectedTable(table)}
                      className="select-none"
                    >
                      {table}
                    </SidebarMenuButton>
                  ))}
                </SidebarMenu>
              )}
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
