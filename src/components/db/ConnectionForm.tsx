import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Spinner } from "@phosphor-icons/react";

type ConnectionFormProps = {
  uri: string;
  setUri: (uri: string) => void;
  handleSubmit: (e: React.FormEvent) => void;
  isConnected: boolean;
  isLoading: boolean;
};

export function ConnectionForm({
  uri,
  setUri,
  handleSubmit,
  isConnected,
  isLoading,
}: ConnectionFormProps) {
  return (
    <form onSubmit={handleSubmit} className="flex-grow flex gap-2">
      <Input
        type="text"
        value={uri}
        onChange={(e) => setUri(e.target.value)}
        placeholder="PostgreSQL Connection URI"
        disabled={isConnected || isLoading}
      />
      <Button type="submit" disabled={isLoading} className="w-32">
        {isLoading && <Spinner className="mr-2 h-4 w-4 animate-spin" />}
        {isLoading ? "Connecting..." : "Connect"}
      </Button>
    </form>
  );
}
