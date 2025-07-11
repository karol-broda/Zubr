const VectorVisualization = ({ vector }: { vector: number[] }) => {
  if (!vector || vector.length === 0) {
    return <div>no vector data</div>;
  }

  const stats = {
    min: Math.min(...vector).toFixed(4),
    max: Math.max(...vector).toFixed(4),
    avg: (vector.reduce((a, b) => a + b, 0) / vector.length).toFixed(4),
    dims: vector.length,
  };

  const maxAbs = Math.max(...vector.map((v) => Math.abs(v)));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-4 text-center p-2 rounded-md bg-muted">
        <div>
          <div className="text-sm font-medium text-muted-foreground">
            Dimensions
          </div>
          <div className="text-lg font-semibold">{stats.dims}</div>
        </div>
        <div>
          <div className="text-sm font-medium text-muted-foreground">Min</div>
          <div className="text-lg font-semibold">{stats.min}</div>
        </div>
        <div>
          <div className="text-sm font-medium text-muted-foreground">Max</div>
          <div className="text-lg font-semibold">{stats.max}</div>
        </div>
        <div>
          <div className="text-sm font-medium text-muted-foreground">Avg</div>
          <div className="text-lg font-semibold">{stats.avg}</div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-2">Heatmap</h3>
        <div className="flex flex-wrap gap-px p-2 rounded-md bg-muted/50 max-h-48 overflow-y-auto">
          {vector.map((value, index) => {
            const intensity = maxAbs > 0 ? Math.abs(value) / maxAbs : 0;
            const color =
              value >= 0
                ? `rgba(59, 130, 246, ${intensity})`
                : `rgba(239, 68, 68, ${intensity})`;
            return (
              <div
                key={index}
                className="w-3 h-3 rounded-sm"
                style={{ backgroundColor: color }}
                title={`Dim ${index + 1}: ${value.toFixed(4)}`}
              />
            );
          })}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-2">Values</h3>
        <div className="max-h-60 overflow-y-auto space-y-1 pr-2 rounded-md bg-muted/50 p-2">
          {vector.map((value, index) => (
            <div
              key={index}
              className="flex justify-between items-center font-mono text-xs"
            >
              <span className="text-muted-foreground">Dim {index + 1}</span>
              <span>{value.toFixed(6)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default VectorVisualization;
